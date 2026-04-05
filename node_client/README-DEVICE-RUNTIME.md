# Device Runtime Layer – Physical Node Operation Guide

This document describes the device-runtime layer in the FL node client (`node_client/main.py`), which enables physical devices to operate reliably in production environments with features like persistent model caching, watchdog monitoring, and HE context validation.

## Overview

The device-runtime layer ensures that physical federated learning nodes can:
- **Persist state** across restarts (model cache, round checkpoints)
- **Auto-recover** from transient failures (watchdog monitoring)
- **Validate consistency** across the fleet (HE context fingerprinting)
- **Configure flexibly** via environment or config file

## Configuration

### Environment Variables (Priority 1 – Highest)

Set these before starting the node client:

```bash
# Device runtime directories
export MODEL_CACHE_DIR="/var/cache/fl-node/models"
export CHECKPOINT_DIR="/var/cache/fl-node/checkpoints"

# Watchdog settings
export WATCHDOG_ENABLED="true"
export WATCHDOG_CHECK_INTERVAL="30"  # seconds

# Config file path (optional)
export DEVICE_RUNTIME_CONFIG_PATH="/etc/fl-platform/node-config.json"
```

### Configuration File (Priority 2 – Optional)

If `DEVICE_RUNTIME_CONFIG_PATH` is set and file exists, these values augment env vars:

**Example: `/etc/fl-platform/node-config.json`**

```json
{
  "model_cache_dir": "/mnt/persistent/fl-cache/models",
  "checkpoint_dir": "/mnt/persistent/fl-cache/checkpoints",
  "watchdog_enabled": true,
  "watchdog_check_interval": 30
}
```

**Priority rule**: Environment variables (`MODEL_CACHE_DIR`, `CHECKPOINT_DIR`, etc.) override config file values. This allows operators to override via env without modifying files.

## Features

### 1. Model Cache & Checkpoint Management

**Purpose**: Recover training state after node restarts.

#### Automatic Behavior

- **On startup**: Attempts to load `model_latest.pt` from cache
- **Every successful round**: Saves checkpoint to `model_round_{N}.pt` and updates cache
- **On crash/restart**: Next boot loads from cache, skipping re-initialization

#### File Structure

```
/var/cache/fl-node/
├── models/
│   └── model_latest.pt              # Most recent working model
└── checkpoints/
    ├── model_round_0.pt
    ├── model_round_1.pt
    ├── model_round_2.pt
    └── he_context_fingerprint.txt   # HE context hash for validation
```

#### Implementation

```python
# Automatic on node startup
load_model_cache(model)  # Warm-start if cache exists

# Automatic after each successful training round
save_model_checkpoint(model, current_round)
save_model_cache(model)
```

### 2. Watchdog Monitoring & Auto-Recovery

**Purpose**: Detect and respond to process hangs, memory leaks, or infinite loops.

#### Mechanism

- Background thread samples process health every `WATCHDOG_CHECK_INTERVAL` seconds
- Tracks last activity time (recorded at start of each training round)
- If no activity detected for ≥ `5 × WATCHDOG_CHECK_INTERVAL`, triggers graceful shutdown
- Kubernetes/systemd automatically restarts the container

#### Watchdog Logs

```
[node-client-1] Watchdog started (check_interval=30s, max_stale=150s)
[node-client-1] Watchdog: Process possibly stuck (last activity 65s ago)
[node-client-1] WARNING: Watchdog detected stale process (155s inactive). CPU=0%, Memory=512MB
[node-client-1] Setting shutdown flag for graceful restart...
```

#### Configuration

```bash
export WATCHDOG_ENABLED="true"           # Enable/disable
export WATCHDOG_CHECK_INTERVAL="30"      # How often to check (seconds)
                                          # Max stale time = 5 × interval
```

### 3. HE Context Fingerprint Validation

**Purpose**: Ensure all physical nodes use identical Homomorphic Encryption shared context for aggregation correctness.

#### Mechanism

- On first run with `HE_ENABLED=true`: Computes SHA256 of HE context and saves to `he_context_fingerprint.txt`
- On each subsequent run: Verifies fingerprint matches; fails if divergence detected
- Prevents silent model corruption from mismatched encryption parameters

#### Log Example

```
[node-client-1] Homomorphic Encryption is ENABLED. Loading shared TenSEAL CKKS context...
[node-client-1] Stored HE context fingerprint: a1b2c3d4e5f6...7890abcdef
[node-client-2] Homomorphic Encryption is ENABLED. Loading shared TenSEAL CKKS context...
[node-client-2] Validated HE context fingerprint matches (a1b2c3d4e5f6...7890abcdef)
```

#### Failure Scenario

```
[node-client-3] ERROR: HE context fingerprint mismatch!
  Stored:  a1b2c3d4e5f6...7890abcdef
  Current: x9y8z7w6v5u4...3210fedcba
This indicates HE context divergence across physical nodes. Cannot proceed.
```

## Startup Sequence

```
1. Load environment variables & config file
2. Display runtime config summary:
   [node-client-1] ================================================
   [node-client-1] FL Node Client Starting (Device Runtime Layer)
   [node-client-1] Mode: NODE_ENDPOINT_MODE=external
   [node-client-1] Device Runtime: model_cache=/var/cache/fl-node/models, checkpoint_dir=/var/cache/fl-node/checkpoints
   [node-client-1] Watchdog: enabled=true, check_interval=30s
   [node-client-1] HE Status: ENABLED, will validate context consistency
   [node-client-1] ================================================

3. Authenticate with aggregator
4. Register with aggregator
5. Start heartbeat background thread
6. Start watchdog monitor thread (if enabled)
7. Initialize model
8. Load model from cache if available
9. Validate HE context fingerprint (if HE enabled)
10. Enter training loop:
    - Fetch global model
    - Train locally
    - Save checkpoint & cache
    - Submit weights
    - Record heartbeat (for watchdog)
```

## Operational Scenarios

### Scenario 1: Clean Restart

```
Device is gracefully shut down (SIGTERM from Kubernetes/systemd):

1. Training loop detects shutdown signal
2. Calls unregister endpoint
3. Exits cleanly
4. Container stops
5. Kubernetes/systemd auto-restarts container
6. Node client boots, loads model from cache
7. Resumes training from last checkpoint
```

**Result**: Training resumes from exact round where it left off. No duplicate submissions.

### Scenario 2: Process Hang (Network Timeout in Training Loop)

```
Device training loop stuck in blocking socket call (no timeout):

1. Main thread: blocked on network socket
2. Watchdog thread: records no activity for >150s
3. Watchdog: Sets _shutdown_flag
4. Watchdog: Logs "Setting shutdown flag for graceful restart..."
5. OS/Container manager: Detects exit code, restarts
6. Device boots, loads model cache, resumes training
```

**Result**: Automatic recovery. No manual intervention needed.

### Scenario 3: Out-of-Memory (OOM)

```
Device runs out of memory (rare if checkpoint/cache dirs are large):

1. Process crashes (OS kills or exception)
2. Container manager restarts
3. Node boots, attempts load_model_cache()
4. If cache load fails: uses fresh model + env DP/FedProx defaults
5. Continues training (possible loss of local state, but converges)
```

**Result**: Degraded but functional. Operator should investigate disk space.

### Scenario 4: Network Partition (Stable Disconnection)

```
Device loses network connectivity to aggregator:

1. fetch_global_model() times out (15s timeout)
2. logs error, returns empty model (round=0)
3. Training loop sleeps 5s, retries
4. Watchdog: still sees heartbeat record updates (loop is running)
5. No false restart triggered
6. When network recovers: auto-reconnect, resume

[node-client-1] gRPC error fetching global model: ...
[node-client-1] Aggregator not ready. Retry 2/30 in 5s...
(waits until network recovers)
```

**Result**: Graceful degradation. Training pauses, no data loss.

## Monitoring & Debugging

### Check Node Health

```bash
# SSH to physical device
curl http://localhost:8000/health

# Returns:
{
  "status": "healthy",
  "nodeId": "node-client-1",
  "shutdown": false
}
```

### View Model Cache

```bash
ls -lh /var/cache/fl-node/models/
# model_latest.pt (size depends on model)

ls -lh /var/cache/fl-node/checkpoints/
# model_round_0.pt
# model_round_1.pt
# model_round_2.pt
# he_context_fingerprint.txt
```

### Verify HE Context Consistency

```bash
# On each physical device:
cat /var/cache/fl-node/checkpoints/he_context_fingerprint.txt

# All nodes should output identical hash:
# a1b2c3d4e5f6...7890abcdef
```

### Monitor Watchdog

```bash
# Follow logs (use your container logging system, e.g., journalctl)
journalctl -u fl-node-client -f

# Look for:
# - "Watchdog started" (good)
# - "Watchdog: Process possibly stuck" (degraded, but recovering)
# - "WARNING: Watchdog detected stale process" (about to restart)
```

### Disk Space Requirements

```
Per device (estimate):

Model cache:              ~50-200 MB (MNIST model ~20 KB per round)
Round checkpoints:        ~50-200 MB each (keep ~10 rounds = 500 MB - 2 GB)
HE context fingerprint:   ~1 KB
Total:                    ~1-3 GB recommended persistent storage

Cleanup (optional):
find /var/cache/fl-node/checkpoints -name "model_round_0*.pt" -delete  # Keep only recent
```

## Integration with Container Orchestration

### Kubernetes

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: fl-node-client-1
spec:
  containers:
  - name: fl-node-client
    image: fl-node-client:latest
    volumeMounts:
    - name: cache-storage
      mountPath: /var/cache/fl-node
    env:
    - name: MODEL_CACHE_DIR
      value: "/var/cache/fl-node/models"
    - name: CHECKPOINT_DIR
      value: "/var/cache/fl-node/checkpoints"
    - name: WATCHDOG_ENABLED
      value: "true"
    livenessProbe:
      httpGet:
        path: /health
        port: 8000
      initialDelaySeconds: 60
      periodSeconds: 30
      failureThreshold: 3  # After 3 failures, kill & restart
  volumes:
  - name: cache-storage
    emptyDir: {}  # or persistentVolumeClaim for persistent storage
```

### systemd (Physical Machines)

```ini
[Unit]
Description=FL Node Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=fl-node
WorkingDirectory=/opt/fl-node
EnvironmentFile=/etc/fl-platform/node-config.env
ExecStart=/usr/bin/python /opt/fl-node/main.py
Restart=on-failure
RestartSec=10

# After watchdog triggers graceful shutdown, systemd restarts within 10s
[Install]
WantedBy=multi-user.target
```

## Troubleshooting

### Issue: Model cache not persisting across restarts

**Cause**: `MODEL_CACHE_DIR` points to ephemeral storage (e.g., `/tmp`).

**Solution**:
```bash
export MODEL_CACHE_DIR="/mnt/persistent/fl-cache"
```

### Issue: "HE context fingerprint mismatch" error

**Cause**: Different physical nodes received different HE context files.

**Solution**:
1. Verify aggregator provisioned same context to all nodes
2. Delete fingerprint file from all nodes: `rm /var/cache/fl-node/checkpoints/he_context_fingerprint.txt`
3. Restart all nodes simultaneously to re-sync context

### Issue: Watchdog keeps triggering restarts (process constantly dying)

**Cause**: Training loop crashing (OOM, CUDA error, network timeout without retry).

**Solution**:
1. Check node logs: `journalctl -u fl-node-client -n 100`
2. Increase `WATCHDOG_CHECK_INTERVAL` if it's normal (e.g., long training epochs)
3. Verify GPU/CPU resources available

### Issue: Disk full error for checkpoints

**Cause**: Too many round checkpoints saved.

**Solution**:
```bash
# Keep only last N rounds
find /var/cache/fl-node/checkpoints -name "model_round_*.pt" -printf '%T@ %p\n' | sort -n | head -n -5 | cut -d' ' -f2- | xargs rm
```

## Summary

The device-runtime layer transforms the FL node client from a stateless containerized service into a **resilient, production-ready federated learner**. Physical devices can now:

✅ Survive transient failures (watchdog)  
✅ Resume training from last checkpoint (cache)  
✅ Maintain fleet consistency (HE fingerprinting)  
✅ Be configured flexibly (env + config file)  
✅ Integrate with orchestration (K8s, systemd)

**Definition of Done**: Physical device restarts and recovers training within 60 seconds without operator intervention.
