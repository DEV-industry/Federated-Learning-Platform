# TLS Certificates (Development)

This directory stores local TLS materials used by `docker-compose` and Kubernetes manifests.
Do not commit private keys.

## Generate a Local Dev CA and Server Certificate (OpenSSL)

Run these commands from the repository root:

```bash
mkdir -p certs

# 1) Create a local CA key + certificate
openssl genrsa -out certs/ca.key 4096
openssl req -x509 -new -nodes -key certs/ca.key -sha256 -days 3650 \
  -out certs/ca.crt -subj "/CN=fl-local-ca"

# 2) Create server key + CSR
openssl genrsa -out certs/aggregator-server.key 4096
openssl req -new -key certs/aggregator-server.key -out certs/aggregator-server.csr \
  -subj "/CN=aggregator"

# 3) SAN config for Docker and Kubernetes DNS names
cat > certs/aggregator-server.ext << 'EOF'
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = aggregator
DNS.2 = localhost
DNS.3 = fl-aggregator
DNS.4 = fl-aggregator.fl-platform.svc.cluster.local
IP.1 = 127.0.0.1
EOF

# 4) Sign server cert with local CA
openssl x509 -req -in certs/aggregator-server.csr -CA certs/ca.crt -CAkey certs/ca.key \
  -CAcreateserial -out certs/aggregator-server.crt -days 825 -sha256 -extfile certs/aggregator-server.ext
```

## Kubernetes TLS Secret

Create/update Kubernetes secret containing the server cert, key and CA cert:

```bash
kubectl -n fl-platform create secret generic fl-tls-certs \
  --from-file=aggregator-server.crt=certs/aggregator-server.crt \
  --from-file=aggregator-server.key=certs/aggregator-server.key \
  --from-file=ca.crt=certs/ca.crt \
  --dry-run=client -o yaml | kubectl apply -f -
```

If you use `fl-system` namespace manifests, replace `fl-platform` accordingly.

---

## Configuring for Public/External Nodes (Production)

### Step 1: Update SAN with Public FQDN

Edit `certs/aggregator-server.ext` and update `DNS.5` to your public domain:

```ini
[alt_names]
# ... internal DNS entries ...
DNS.5 = api.yourdomain.com    # << Replace with your public FQDN
```

### Step 2: Regenerate Server Certificate with New SAN

```bash
# Delete old server cert
rm -f certs/aggregator-server.crt certs/aggregator-server.csr

# Create new CSR
openssl req -new -key certs/aggregator-server.key -out certs/aggregator-server.csr \
  -subj "/CN=aggregator"

# Sign with new SAN
openssl x509 -req -in certs/aggregator-server.csr \
  -CA certs/ca.crt -CAkey certs/ca.key \
  -CAcreateserial -out certs/aggregator-server.crt \
  -days 825 -sha256 -extfile certs/aggregator-server.ext
```

### Step 3: Distribute CA Certificate to Physical Nodes

The client nodes must trust the CA certificate to validate server certificate chain:

1. Copy `certs/ca.crt` to each physical device (e.g., `/etc/fl-platform/ca.crt`)
2. Set environment variable on node client:
   ```bash
   export TLS_CA_CERT_PATH=/etc/fl-platform/ca.crt
   export TLS_VERIFY=true
   ```

### Step 4: Inject Cert/Key into Kubernetes Secret

After cert regeneration, update the K8s secret:

```bash
# Encode certs to base64
TLS_CERT=$(cat certs/aggregator-server.crt | base64 -w0)
TLS_KEY=$(cat certs/aggregator-server.key | base64 -w0)
TLS_CA=$(cat certs/ca.crt | base64 -w0)

# Create/patch the secret
kubectl -n fl-platform create secret generic fl-tls-certs \
  --from-file=aggregator-server.crt=certs/aggregator-server.crt \
  --from-file=aggregator-server.key=certs/aggregator-server.key \
  --from-file=ca.crt=certs/ca.crt \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Secret updated. Restart aggregator pod to pick up new cert:"
kubectl -n fl-platform rollout restart deployment/fl-aggregator
```

### Rotation Procedure

See [k8s/TLS-ROTATION-GUIDE.md](../k8s/TLS-ROTATION-GUIDE.md) for step-by-step certificate rotation without downtime.
