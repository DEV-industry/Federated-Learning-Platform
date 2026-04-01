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
