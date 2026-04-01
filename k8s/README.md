# Kubernetes Deployment Guide — Federated Learning Platform

This guide covers deploying the FL Platform on a local Minikube cluster. The same manifests work on any K8s cluster (GKE, EKS, AKS) with minor registry changes.

---

## Prerequisites

### 1. Install Required Tools

```bash
# Install Minikube (Windows - PowerShell as Admin)
winget install Kubernetes.minikube

# Install kubectl
winget install Kubernetes.kubectl

# Verify installations
minikube version
kubectl version --client
docker --version
```

### 2. Start Minikube Cluster

```bash
# Start with sufficient resources for ML workloads
minikube start \
  --cpus=4 \
  --memory=8192 \
  --disk-size=30g \
  --driver=docker

# Enable required addons
minikube addons enable ingress
minikube addons enable metrics-server
minikube addons enable storage-provisioner
```

---

## Build & Push Docker Images

### Option A: Minikube's Built-in Docker (Recommended for Local Dev)

```bash
# Point your shell's Docker client to Minikube's Docker daemon
# PowerShell:
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# Bash/WSL:
eval $(minikube docker-env)

# Build all images (they'll be available directly in the cluster)
docker build -t fl-aggregator:latest ./aggregator
docker build -t fl-node-client:latest ./node_client
docker build --build-arg NEXT_PUBLIC_API_URL=http://fl.local -t fl-frontend:latest ./frontend

# Verify images exist
docker images | grep fl-
```

> **Important:** After building with Minikube's Docker, update the image names in the K8s manifests:
> Change `your-registry/fl-aggregator:latest` → `fl-aggregator:latest` (etc.)
> And set `imagePullPolicy: Never` to prevent K8s from trying to pull from a remote registry.

### Option B: Docker Hub / Remote Registry

```bash
# Build and push
docker build -t yourusername/fl-aggregator:latest ./aggregator
docker push yourusername/fl-aggregator:latest

docker build -t yourusername/fl-node-client:latest ./node_client
docker push yourusername/fl-node-client:latest

docker build --build-arg NEXT_PUBLIC_API_URL=http://fl.local -t yourusername/fl-frontend:latest ./frontend
docker push yourusername/fl-frontend:latest

# Update image names in k8s/*.yaml to match your registry
```

---

## Deploy to Kubernetes

### Ordered Startup

Apply manifests in numbered order to respect dependencies:

```bash
# 1. Infrastructure (Namespace, Secrets, ConfigMap)
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-secrets.yaml
kubectl apply -f k8s/02-configmap.yaml

# 2. Database (must be ready before Aggregator)
kubectl apply -f k8s/10-postgres-statefulset.yaml
kubectl apply -f k8s/11-postgres-service.yaml

# Wait for Postgres to be ready
kubectl wait --for=condition=ready pod -l app=fl-postgres -n fl-platform --timeout=120s

# 3. Aggregator (must be ready before Node Clients)
kubectl apply -f k8s/20-aggregator-deployment.yaml
kubectl apply -f k8s/21-aggregator-service.yaml

# Wait for Aggregator to be ready
kubectl wait --for=condition=ready pod -l app=fl-aggregator -n fl-platform --timeout=180s

# 4. Node Clients (dynamic replicas; each pod generates its own identity)
kubectl apply -f k8s/30-node-client-statefulset.yaml

# 5. Frontend + Ingress
kubectl apply -f k8s/40-frontend-deployment.yaml
kubectl apply -f k8s/41-frontend-service.yaml
kubectl apply -f k8s/42-ingress.yaml
```

### Quick Deploy (All at Once)

If you prefer to let init containers handle ordering:

```bash
kubectl apply -f k8s/
```

---

## Verification

### Check Pod Status

```bash
# All pods should show Running
kubectl get pods -n fl-platform -o wide

# Expected output:
# NAME                              READY   STATUS    RESTARTS   AGE
# fl-postgres-0                     1/1     Running   0          2m
# fl-aggregator-xxx-xxx             1/1     Running   0          1m
# fl-node-client-xxx-xxx            1/1     Running   0          45s
# fl-node-client-xxx-yyy            1/1     Running   0          45s
# fl-node-client-xxx-zzz            1/1     Running   0          45s
# fl-frontend-xxx-xxx               1/1     Running   0          30s
# fl-frontend-xxx-yyy               1/1     Running   0          30s
```

### Test DNS Resolution

```bash
# From inside a pod, verify service DNS
kubectl exec -it deploy/fl-node-client -n fl-platform -- \
  nslookup fl-aggregator.fl-platform.svc.cluster.local
```

### Check Aggregator Status

```bash
# Via port-forward
kubectl port-forward svc/fl-aggregator 8443:8443 -n fl-platform &
curl -k https://localhost:8443/api/status | python -m json.tool

# Check registered nodes
curl -k https://localhost:8443/api/nodes | python -m json.tool
```

### View Training Logs

```bash
# Aggregator logs (watch for FedAvg completions)
kubectl logs -f deploy/fl-aggregator -n fl-platform

# A specific node client
kubectl logs -f deploy/fl-node-client -n fl-platform

# All node clients
kubectl logs -l app=fl-node-client -n fl-platform --tail=20
```

### Access the Frontend Dashboard

```bash
# Get Minikube's IP
minikube ip

# Add to hosts file (PowerShell as Admin):
Add-Content C:\Windows\System32\drivers\etc\hosts "$(minikube ip) fl.local"

# Or use minikube tunnel (alternative, no hosts edit needed):
minikube tunnel

# Open in browser:
# http://fl.local
```

---

## Scaling Tests

### Manual Scaling

```bash
# Scale the node-client deployment as needed.
# Watch the existing node pods
kubectl get pods -n fl-platform -w -l app=fl-node-client

# Verify all new nodes auto-registered with the aggregator
kubectl exec -it deploy/fl-aggregator -n fl-platform -- \
  curl -ks https://localhost:8443/api/nodes | python3 -m json.tool

# Verify training continues uninterrupted
kubectl logs -f deploy/fl-aggregator -n fl-platform --since=1m | grep "FedAvg"
```

### Extreme Scale Test

```bash
# Create additional node-client replicas (requires sufficient cluster resources)

# Monitor resource usage
kubectl top pods -n fl-platform

# Check HPA status
kubectl get hpa -n fl-platform
```

### Simulate Node Failure

```bash
# Delete a random node pod (K8s auto-recreates with new UUID)
kubectl delete pod -l app=fl-node-client -n fl-platform --field-selector=status.phase=Running --wait=false | head -1

# Watch recovery
kubectl get pods -n fl-platform -w -l app=fl-node-client
```

---

## Configuration Updates (No Rebuild Required)

```bash
# Update quorum size
kubectl patch configmap fl-config -n fl-platform \
  --type merge -p '{"data":{"FL_MIN_QUORUM":"10"}}'

# Restart aggregator to pick up changes
kubectl rollout restart deployment fl-aggregator -n fl-platform

# Update DP noise multiplier
kubectl patch configmap fl-config -n fl-platform \
  --type merge -p '{"data":{"DP_NOISE_MULTIPLIER":"0.05"}}'

# Restart node clients to pick up changes
kubectl rollout restart deployment fl-node-client -n fl-platform
```

---

## Teardown

```bash
# Delete all FL platform resources
kubectl delete namespace fl-platform

# Stop Minikube
minikube stop

# Delete Minikube cluster entirely
minikube delete
```

---

## Architecture Diagram

```
                    ┌──────────────────────────────────────────────┐
                    │              Kubernetes Cluster               │
                    │                                              │
    ┌──────────┐    │  ┌───────────┐    ┌──────────────────────┐   │
    │  Users   │────┼─▶│  Ingress  │───▶│  fl-frontend (x2)    │   │
    │ Browser  │    │  │ (NGINX)   │    │  Next.js Dashboard   │   │
    └──────────┘    │  │           │    └──────────────────────┘   │
                    │  │   /api/* ─┼───▶┌──────────────────────┐   │
                    │  │   /ws/*   │    │  fl-aggregator (x1)  │   │
                    │  └───────────┘    │  Spring Boot + JPA   │   │
                    │                   │  Dynamic Registration │   │
                    │                   └──────────┬───────────┘   │
                    │                              │               │
                    │            ┌─────────────────┼────────┐      │
                    │            │                 │        │      │
                    │   ┌────────▼───┐  ┌──────────▼──┐     │      │
                    │   │ fl-node    │  │ fl-postgres  │     │      │
                    │   │ client     │  │ StatefulSet  │     │      │
                    │   │ (x5→1000) │  │ + PVC (5Gi)  │     │      │
                    │   │ PyTorch    │  └─────────────┘     │      │
                    │   │ UUID IDs   │                      │      │
                    │   │ Auto-reg   │    ◀── HPA scales    │      │
                    │   └────────────┘        based on CPU  │      │
                    │                                       │      │
                    └───────────────────────────────────────┘      │
                                                                   │
```
