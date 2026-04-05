# External Physical Node Staging Checklist

This checklist is for the first production-like rollout where a real physical device joins the same FL rounds as simulated nodes.

## 1. Infrastructure readiness

- [ ] Aggregator deployment is healthy.
- [ ] Internal service exists: `fl-aggregator` (ClusterIP).
- [ ] External gRPC service exists: `fl-aggregator-grpc-external` (LoadBalancer).
- [ ] Ingress is healthy and serves `api.fl.local`.
- [ ] DNS resolves:
  - [ ] `api.fl.local` -> ingress endpoint
  - [ ] `grpc.fl.local` -> load balancer endpoint

Commands:

```bash
kubectl get pods -n fl-platform
kubectl get svc -n fl-platform fl-aggregator fl-aggregator-grpc-external
kubectl get ingress -n fl-platform fl-ingress
```

## 2. TLS readiness

- [ ] Aggregator cert SAN includes external hostnames.
- [ ] Device trusts the CA used by the aggregator cert.
- [ ] Device uses strict TLS verification (`TLS_VERIFY=true`).

Quick checks:

```bash
curl -vk https://api.fl.local/api/health
openssl s_client -connect grpc.fl.local:9443 -servername grpc.fl.local
```

## 3. Device environment

Required env vars on physical device:

```bash
NODE_ID=<unique-physical-node-id>
NODE_ENDPOINT_MODE=external
AGGREGATOR_EXTERNAL_BASE_URL=https://api.fl.local
AGGREGATOR_EXTERNAL_GRPC_URL=grpc.fl.local:9443
TLS_VERIFY=true
TLS_CA_CERT_PATH=/path/to/ca.crt
NODE_PRIVATE_KEY_PATH=/var/lib/fl-node/node_identity_ed25519.pem
NODE_ENROLLMENT_TOKEN=<first-join-enrollment-token>
DP_ENABLED=true
HE_ENABLED=true
HE_SHARED_CONTEXT_FILE=/path/to/shared_he_context_private.b64
```

Optional strict onboarding mode on aggregator:

```bash
FL_SECURITY_ENROLLMENT_REQUIRED_FOR_NEW_NODES=true
FL_SECURITY_ENROLLMENT_TOKEN=<first-join-enrollment-token>
```

## 4. First join sequence

Expected order on device logs:

1. Auth success (`/api/auth`) and JWT received.
1.1. First-time node accepted only with valid enrollment token (if strict onboarding enabled).
2. Register success (`/api/nodes/register`).
3. Heartbeat loop starts (`/api/nodes/heartbeat`).
4. Global model fetch over gRPC (`GetGlobalModel`).
5. Local train epoch starts.
6. Submit weights over gRPC (`SubmitWeights`).

## 5. Dashboard verification (admin)

- [ ] Node appears in node list with the configured `NODE_ID`.
- [ ] Status becomes `ACTIVE`.
- [ ] `lastHeartbeat` updates continuously.
- [ ] Live activity transitions are visible (`DOWNLOADING`, `TRAINING`, `UPLOADING`, `IDLE`).

API checks:

```bash
curl -ks https://api.fl.local/api/nodes | python -m json.tool
curl -ks https://api.fl.local/api/status | python -m json.tool
```

## 6. FL parity checks (simulated vs physical)

- [ ] Physical node receives same round hyperparams (`dp_enabled`, `fedprox_mu`, `dp_noise_multiplier`).
- [ ] Round completion still respects quorum.
- [ ] Accuracy/loss trend stays in expected band versus simulated-only baseline.

## 7. Rollback criteria

Trigger rollback to simulated-only mode if any of the following hold for 3 consecutive rounds:

- External node cannot keep heartbeat stable.
- gRPC submit from external node fails repeatedly.
- Round completion drops below agreed SLO.
- Security alert indicates invalid signature or suspicious key behavior.

Rollback action:

- Stop external device process.
- Keep internal nodes with `NODE_ENDPOINT_MODE=internal`.
- Remove external DNS route or firewall open path until issue is fixed.
