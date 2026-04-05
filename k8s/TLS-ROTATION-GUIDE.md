# TLS Certificate Rotation Guide

This guide describes how to rotate the aggregator's TLS certificates without downtime or disrupting active federated learning rounds.

## Prerequisites

- Access to the repository root directory (certs/)
- kubectl access to the fl-platform namespace
- Active aggregator and node clients connected
- OpenSSL tool installed

## Overview

The aggregator serves HTTPS (port 8443) for REST and gRPC (port 9443) with TLS. Both use the same server certificate from `certs/aggregator-server.crt` and key `certs/aggregator-server.key`.

**During rotation:**
- Old certificate remains valid during transition
- New certificate is applied via rolling pod restart
- Node clients with cached CA cert continue to trust the chain
- No round interruption if heartbeat timeout is > pod restart duration (typically 30-60s)

---

## Step-by-Step Rotation

### Phase 1: Generate New Certificate (Offline, No Downtime Yet)

Run these commands on your local machine (or CI/CD pipeline):

```bash
cd /path/to/Federated-Learning-Platform

# 1. Create new CSR (Certificate Signing Request)
#    Keep the same private key (aggregator-server.key) to avoid key rotation complexity
openssl req -new -key certs/aggregator-server.key \
  -out certs/aggregator-server-new.csr \
  -subj "/CN=aggregator"

# 2. Sign with local CA to create new certificate
openssl x509 -req -in certs/aggregator-server-new.csr \
  -CA certs/ca.crt -CAkey certs/ca.key \
  -CAcreateserial -out certs/aggregator-server-new.crt \
  -days 825 -sha256 -extfile certs/aggregator-server.ext

# 3. Verify new cert is valid and has correct SAN
openssl x509 -in certs/aggregator-server-new.crt -text -noout | grep -A5 "Subject Alternative Name"

# Expected output:
#   DNS:aggregator, DNS:localhost, DNS:fl-aggregator, DNS:fl-aggregator.fl-platform.svc.cluster.local, DNS:aggregator-api.example.com
```

### Phase 2: Apply New Certificate to Kubernetes Secret

The new certificate is now ready. Update the K8s secret, which will trigger a rolling restart:

```bash
# Backup current secret (optional but recommended)
kubectl -n fl-platform get secret fl-tls-certs -o yaml > fl-tls-certs-backup-$(date +%s).yaml

# Update secret with new cert
kubectl -n fl-platform create secret generic fl-tls-certs \
  --from-file=aggregator-server.crt=certs/aggregator-server-new.crt \
  --from-file=aggregator-server.key=certs/aggregator-server.key \
  --from-file=ca.crt=certs/ca.crt \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Secret updated. Waiting for pods to reload cert..."
```

### Phase 3: Rolling Restart of Aggregator

The pod will mount the new certificate automatically:

```bash
# Force rolling restart (graceful, respects gracePeriodSeconds)
kubectl -n fl-platform rollout restart deployment/fl-aggregator

# Monitor restart progress
kubectl -n fl-platform rollout status deployment/fl-aggregator --timeout=5m

# Verify new cert is loaded (optional)
kubectl -n fl-platform get deployment fl-aggregator -o jsonpath='{.spec.template.metadata.resourceVersion}'
```

### Phase 4: Verify Certificate Rotation

Confirm the new certificate is in place:

```bash
# From outside cluster, test HTTPS connection:
curl -v --cacert certs/ca.crt https://aggregator-api.example.com:8443/api/status

# From inside cluster:
kubectl -n fl-platform exec -it deployment/fl-aggregator -- \
  openssl s_client -connect localhost:8443 -showcerts < /dev/null 2>/dev/null | \
  openssl x509 -noout -dates

# Expected output: notBefore and notAfter dates matching the new cert
```

### Phase 5: Cleanup

After verifying the rotation is successful:

```bash
# Remove temporary CSR and old cert files (keep backup of old cert for 30 days)
rm -f certs/aggregator-server-new.csr
mv certs/aggregator-server-old.crt certs/aggregator-server-old-$(date +%Y%m%d).crt 2>/dev/null || true

# Verify no stale files in certs/
ls -la certs/
```

---

## Rotation During Active Federated Learning

If you are rotating during an active training round:

1. **Before rotation**: Check current round status
   ```bash
   kubectl -n fl-platform exec -it deployment/fl-aggregator -- \
     curl -s -k https://localhost:8443/api/rounds/current | jq '.id, .status'
   ```

2. **During rotation**: The pod restarts in ~30-60 seconds
   - Aggregator gRPC server briefly stops accepting requests
   - Nodes retry submission/fetch with exponential backoff
   - Round timer continues; late submissions may be rejected

3. **After rotation**: Verify round is still active and nodes reconnect
   ```bash
   # Check node heartbeats
   kubectl -n fl-platform exec -it deployment/fl-aggregator -- \
     curl -s -k https://localhost:8443/api/nodes | jq '.[] | {nodeId, lastHeartbeat, status}'
   ```

---

## Rollback Procedure

If the new certificate causes issues:

```bash
# Restore previous secret from backup
kubectl -n fl-platform apply -f fl-tls-certs-backup-XXXXXXXXXX.yaml

# Restart aggregator with old cert
kubectl -n fl-platform rollout restart deployment/fl-aggregator

# Verify old cert is loaded
kubectl -n fl-platform rollout status deployment/fl-aggregator --timeout=5m
```

---

## Scheduled Rotation (Automation)

For regular certificate rotation (e.g., 30 days before expiry):

### Option 1: CronJob in Kubernetes

Create a K8s CronJob that generates and applies new certs automatically:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: tls-cert-rotator
  namespace: fl-platform
spec:
  schedule: "0 2 * * 0"  # Every Sunday at 02:00 UTC
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: tls-rotator  # Requires RBAC
          containers:
          - name: rotator
            image: alpine:latest
            command:
            - /bin/bash
            - -c
            - |
              # Fetch current cert, check expiry, trigger rotation if < 30 days
              # This requires openssl, kubectl, and git in the image
              # Implementation TBD based on exact cert storage/provisioning strategy
              echo "CronJob-based rotation not yet implemented; see manual procedure"
          restartPolicy: OnFailure
```

### Option 2: External CI/CD Pipeline

Integrate rotation into your GitOps or CI/CD pipeline (e.g., GitHub Actions):

```yaml
# .github/workflows/cert-rotation.yml (example)
name: Quarterly TLS Rotation
on:
  schedule:
    - cron: '0 0 1 */3 *'  # First of every 3 months

jobs:
  rotate:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Generate new cert
      run: |
        # Steps from Phase 1 above
        ...
    - name: Create PR
      # Commit new cert and create PR for review
```

---

## Troubleshooting

### Certificate Validation Errors on Node Clients

**Symptom:** Clients cannot connect after rotation with error like "certificate verify failed".

**Cause:** Client CA cert cache is stale or missing.

**Solution:**
```bash
# On each physical node, update CA cert:
sudo cp certs/ca.crt /etc/fl-platform/ca.crt
sudo chmod 644 /etc/fl-platform/ca.crt

# Restart node client
systemctl restart fl-node-client
```

### gRPC Connection Refused After Rotation

**Symptom:** gRPC clients timeout or refuse connection immediately after rotation.

**Cause:** gRPC interceptor or netty transport layer not reloaded.

**Solution:**
```bash
# Full pod restart (not rolling, causes brief downtime)
kubectl -n fl-platform delete pod -l app=fl-aggregator
# Deployment will auto-recreate with new cert

# Or check aggregator logs for TLS errors:
kubectl -n fl-platform logs -f deployment/fl-aggregator --tail=100 | grep -i tls
```

### Key Mismatch Between cert and key

**Symptom:** Aggregator startup fails with "key and cert do not match".

**Cause:** Key file and certificate file are misaligned after partial rotation.

**Solution:**
```bash
# Verify cert and key are in sync
openssl x509 -in certs/aggregator-server.crt -noout -modulus | openssl md5
openssl rsa -in certs/aggregator-server.key -noout -modulus | openssl md5

# Hashes should match. If not, restore from backup:
kubectl apply -f fl-tls-certs-backup-XXXXXXXXXX.yaml
kubectl -n fl-platform rollout restart deployment/fl-aggregator
```

---

## Monitoring & Alerts

Consider setting up alerts for certificate expiry:

```bash
# Check current cert expiry
kubectl -n fl-platform exec -it deployment/fl-aggregator -- \
  openssl x509 -in /certs/aggregator-server.crt -noout -dates | grep notAfter

# Parse as date for alert logic:
# If expiry < 30 days, trigger rotation job
```

For Prometheus/Grafana integration, add a probing alert that checks certificate expiry via TLS handshake.
