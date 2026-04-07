import time
import requests
import threading
import signal
import sys
import socket
import random
import base64
import platform
import json
import psutil
import asyncio
import datetime
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any
from urllib.parse import urlparse
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms
from torch.utils.data import DataLoader, Subset
import grpc
import federated_pb2
import federated_pb2_grpc
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Gauge, Counter
import os
import he_manager
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, PrivateFormat, NoEncryption, load_pem_private_key

app = FastAPI()

# Prometheus Custom Metrics
FL_ROUND_DURATION = Gauge('fl_round_duration_seconds', 'Duration of the federated learning round', ['nodeId'])
MODELS_REJECTED = Counter('fl_models_rejected_total', 'Total number of models rejected by Multi-Krum', ['nodeId'])

# Instrument app and expose /metrics endpoint
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# =========================================================================
# LOCAL UI CONFIGURATION
# =========================================================================
ENABLE_LOCAL_UI = os.getenv("ENABLE_LOCAL_UI", "false").lower() == "true"
LOCAL_UI_PORT = int(os.getenv("LOCAL_UI_PORT", "8080"))

# =========================================================================
# NODE TELEMETRY — In-memory store for the local dashboard
# =========================================================================

@dataclass
class NodeTelemetry:
    """Thread-safe in-memory telemetry store for the local UI dashboard."""
    node_id: str = ""
    status: str = "initializing"
    current_round: int = 0
    he_enabled: bool = False
    dp_enabled: bool = False
    loss_history: List[Dict[str, Any]] = field(default_factory=list)
    accuracy_history: List[Dict[str, Any]] = field(default_factory=list)
    cpu_percent: float = 0.0
    ram_percent: float = 0.0
    ram_used_mb: float = 0.0
    ram_total_mb: float = 0.0
    logs: List[Dict[str, str]] = field(default_factory=list)
    uptime_seconds: float = 0.0
    start_time: float = field(default_factory=time.time)
    last_round_duration: float = 0.0
    fedprox_mu: float = 0.0
    dp_noise_multiplier: float = 0.0
    total_rounds_completed: int = 0
    current_batch: int = 0
    total_batches: int = 0

_telemetry = NodeTelemetry()
_telemetry_lock = threading.Lock()
_ws_clients: List[WebSocket] = []
_ws_clients_lock = threading.Lock()
_MAX_LOG_ENTRIES = 500
_ui_event_loop = None  # Set when UI server starts

def _update_telemetry(**kwargs):
    """Thread-safe update of telemetry fields."""
    with _telemetry_lock:
        for key, value in kwargs.items():
            if hasattr(_telemetry, key):
                setattr(_telemetry, key, value)

def _append_log(level: str, message: str):
    """Append a log entry to telemetry and broadcast to WebSocket clients."""
    entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "level": level,
        "message": message
    }
    with _telemetry_lock:
        _telemetry.logs.append(entry)
        if len(_telemetry.logs) > _MAX_LOG_ENTRIES:
            _telemetry.logs = _telemetry.logs[-_MAX_LOG_ENTRIES:]
    _broadcast_log_sync(entry)

def _broadcast_log_sync(entry: dict):
    """Queue a log broadcast to all connected WebSocket clients."""
    if _ui_event_loop is None:
        return
    with _ws_clients_lock:
        disconnected = []
        for ws in _ws_clients:
            try:
                asyncio.run_coroutine_threadsafe(
                    ws.send_json(entry),
                    _ui_event_loop
                )
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            _ws_clients.remove(ws)

def _update_hardware_metrics():
    """Snapshot current CPU and RAM usage."""
    try:
        cpu = psutil.cpu_percent(interval=0)
        mem = psutil.virtual_memory()
        _update_telemetry(
            cpu_percent=cpu,
            ram_percent=mem.percent,
            ram_used_mb=round(mem.used / (1024 * 1024), 1),
            ram_total_mb=round(mem.total / (1024 * 1024), 1),
            uptime_seconds=round(time.time() - _telemetry.start_time, 1)
        )
    except Exception:
        pass

def _hardware_monitor_loop():
    """Background thread that updates hardware metrics every 2 seconds."""
    while not _shutdown_flag.is_set():
        _update_hardware_metrics()
        time.sleep(2)

# Intercept print() to also feed the local dashboard log stream
_original_print = print
def _patched_print(*args, **kwargs):
    _original_print(*args, **kwargs)
    message = " ".join(str(a) for a in args)
    level = "INFO"
    msg_upper = message.upper()
    if "ERROR" in msg_upper or "FATAL" in msg_upper:
        level = "ERROR"
    elif "WARNING" in msg_upper or "WARN" in msg_upper:
        level = "WARN"
    elif "SUCCESS" in msg_upper or "REGISTERED SUCCESSFULLY" in msg_upper or "AUTHENTICATED SUCCESSFULLY" in msg_upper:
        level = "SUCCESS"
    _append_log(level, message)

if ENABLE_LOCAL_UI:
    import builtins
    builtins.print = _patched_print

# =========================================================================
# CONFIGURATION — K8s-native with Docker-compatible defaults
# =========================================================================

INTERNAL_AGGREGATOR_BASE_URL = os.getenv("AGGREGATOR_BASE_URL", "https://aggregator:8443")
INTERNAL_AGGREGATOR_GRPC_URL = os.getenv("AGGREGATOR_GRPC_URL", "aggregator:9443")
EXTERNAL_AGGREGATOR_BASE_URL = os.getenv("AGGREGATOR_EXTERNAL_BASE_URL", "").strip()
EXTERNAL_AGGREGATOR_GRPC_URL = os.getenv("AGGREGATOR_EXTERNAL_GRPC_URL", "").strip()
NODE_ENDPOINT_MODE = os.getenv("NODE_ENDPOINT_MODE", "internal").strip().lower()

if NODE_ENDPOINT_MODE == "external":
    AGGREGATOR_BASE_URL = EXTERNAL_AGGREGATOR_BASE_URL or INTERNAL_AGGREGATOR_BASE_URL
    AGGREGATOR_GRPC_URL = EXTERNAL_AGGREGATOR_GRPC_URL or INTERNAL_AGGREGATOR_GRPC_URL
elif NODE_ENDPOINT_MODE == "internal":
    AGGREGATOR_BASE_URL = INTERNAL_AGGREGATOR_BASE_URL
    AGGREGATOR_GRPC_URL = INTERNAL_AGGREGATOR_GRPC_URL
else:
    print(f"FATAL ERROR: Unsupported NODE_ENDPOINT_MODE='{NODE_ENDPOINT_MODE}'. Use 'internal' or 'external'.")
    sys.exit(1)

TLS_VERIFY = os.getenv("TLS_VERIFY", "true").lower() == "true"
TLS_CA_CERT_PATH = os.getenv("TLS_CA_CERT_PATH", "")
GRPC_SSL_TARGET_NAME_OVERRIDE = os.getenv("GRPC_SSL_TARGET_NAME_OVERRIDE", "")


def _validate_transport_configuration():
    parsed = urlparse(AGGREGATOR_BASE_URL)
    scheme = parsed.scheme.lower()
    if scheme not in {"http", "https"}:
        print(f"FATAL ERROR: Unsupported AGGREGATOR_BASE_URL scheme '{scheme}'. Use http or https.")
        sys.exit(1)

    if scheme != "https":
        print("FATAL ERROR: AGGREGATOR_BASE_URL must use https://")
        sys.exit(1)


def _build_requests_verify_arg():
    if not TLS_VERIFY:
        return False
    if TLS_CA_CERT_PATH:
        return TLS_CA_CERT_PATH
    return True


def _build_grpc_channel():
    root_certificates = None
    if TLS_CA_CERT_PATH:
        with open(TLS_CA_CERT_PATH, "rb") as cert_file:
            root_certificates = cert_file.read()
    credentials = grpc.ssl_channel_credentials(root_certificates=root_certificates)
    options = [
        ("grpc.max_send_message_length", 100 * 1024 * 1024),
        ("grpc.max_receive_message_length", 100 * 1024 * 1024),
    ]
    if GRPC_SSL_TARGET_NAME_OVERRIDE:
        options.append(("grpc.ssl_target_name_override", GRPC_SSL_TARGET_NAME_OVERRIDE))
    return grpc.secure_channel(AGGREGATOR_GRPC_URL, credentials, options=options)


_validate_transport_configuration()
REQUESTS_VERIFY_ARG = _build_requests_verify_arg()
REGISTER_URL = f"{AGGREGATOR_BASE_URL}/api/nodes/register"
HEARTBEAT_URL = f"{AGGREGATOR_BASE_URL}/api/nodes/heartbeat"
UNREGISTER_URL = f"{AGGREGATOR_BASE_URL}/api/nodes/unregister"

# =========================================================================
# DEVICE RUNTIME CONFIGURATION — For Physical Nodes
# =========================================================================
# Supports both environment variables (priority 1) and config file (priority 2)
# Example: DEVICE_RUNTIME_CONFIG_PATH=/etc/fl-platform/node-config.json

DEVICE_RUNTIME_CONFIG_PATH = os.getenv("DEVICE_RUNTIME_CONFIG_PATH", "").strip()
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "/var/cache/fl-node/models").strip()
CHECKPOINT_DIR = os.getenv("CHECKPOINT_DIR", "/var/cache/fl-node/checkpoints").strip()
WATCHDOG_ENABLED = os.getenv("WATCHDOG_ENABLED", "true").lower() == "true"
WATCHDOG_CHECK_INTERVAL = int(os.getenv("WATCHDOG_CHECK_INTERVAL", "30"))
CONFIG_PRIORITY_ENV_FIRST = True  # Environment variables override config file

# Dynamic identity: must be set from environment (e.g., downward API in K8s)
NODE_ID = os.getenv("NODE_ID")
if not NODE_ID:
    print("FATAL ERROR: NODE_ID environment variable is missing. It must be provided.")
    sys.exit(1)

def load_device_runtime_config():
    """Load device runtime config from JSON file.
    Priority: env vars > config file > defaults
    Config file path: DEVICE_RUNTIME_CONFIG_PATH
    """
    config = {
        "model_cache_dir": MODEL_CACHE_DIR,
        "checkpoint_dir": CHECKPOINT_DIR,
        "watchdog_enabled": WATCHDOG_ENABLED,
        "watchdog_check_interval": WATCHDOG_CHECK_INTERVAL,
    }
    
    if DEVICE_RUNTIME_CONFIG_PATH and os.path.exists(DEVICE_RUNTIME_CONFIG_PATH):
        try:
            with open(DEVICE_RUNTIME_CONFIG_PATH, "r") as f:
                file_config = json.load(f)
            
            # Only override defaults if not set via env vars
            if "model_cache_dir" in file_config and not os.getenv("MODEL_CACHE_DIR"):
                config["model_cache_dir"] = file_config["model_cache_dir"]
            if "checkpoint_dir" in file_config and not os.getenv("CHECKPOINT_DIR"):
                config["checkpoint_dir"] = file_config["checkpoint_dir"]
            if "watchdog_enabled" in file_config and not os.getenv("WATCHDOG_ENABLED"):
                config["watchdog_enabled"] = file_config["watchdog_enabled"]
            if "watchdog_check_interval" in file_config and not os.getenv("WATCHDOG_CHECK_INTERVAL"):
                config["watchdog_check_interval"] = file_config["watchdog_check_interval"]
            
            print(f"[{NODE_ID}] Loaded device runtime config from {DEVICE_RUNTIME_CONFIG_PATH}")
        except Exception as e:
            print(f"[{NODE_ID}] Warning: Failed to load runtime config: {e}. Using env/defaults.")
    
    # Create directories
    try:
        os.makedirs(config["model_cache_dir"], exist_ok=True)
        os.makedirs(config["checkpoint_dir"], exist_ok=True)
    except Exception as e:
        print(f"[{NODE_ID}] Warning: Failed to create cache directories: {e}")
    
    return config

RUNTIME_CONFIG = load_device_runtime_config()

DP_ENABLED_DEFAULT = os.getenv("DP_ENABLED", "false").lower() == "true"
DP_NOISE_MULTIPLIER_DEFAULT = float(os.getenv("DP_NOISE_MULTIPLIER", "0.01"))
FEDPROX_MU_DEFAULT = float(os.getenv("FEDPROX_MU", "0.01"))
AUTH_URL = f"{AGGREGATOR_BASE_URL}/api/auth"
JWT_TOKEN = None
HEARTBEAT_INTERVAL = int(os.getenv("HEARTBEAT_INTERVAL", "20"))
ACTIVITY_URL = f"{AGGREGATOR_BASE_URL}/api/nodes/activity"
ACTIVITY_REPORT_BATCH_INTERVAL = int(os.getenv("ACTIVITY_REPORT_BATCH_INTERVAL", "100"))
AUTH_RECOVERY_LOCK = threading.Lock()
NODE_PRIVATE_KEY_PATH = os.getenv("NODE_PRIVATE_KEY_PATH", "/app/node_identity_ed25519.pem").strip()
NODE_ENROLLMENT_TOKEN = os.getenv("NODE_ENROLLMENT_TOKEN", "").strip()
CLIENT_VERSION = os.getenv("CLIENT_VERSION", "node-client-1.0.0").strip()
DEVICE_MODEL = os.getenv("DEVICE_MODEL", "").strip()
DEVICE_OS = os.getenv("DEVICE_OS", platform.platform()).strip()
DEVICE_CPU = os.getenv("DEVICE_CPU", platform.processor()).strip()
DEVICE_GPU = os.getenv("DEVICE_GPU", "").strip()
DEVICE_REGION = os.getenv("DEVICE_REGION", "").strip()

def load_or_create_node_private_key():
    if not NODE_PRIVATE_KEY_PATH:
        print(f"[{NODE_ID}] NODE_PRIVATE_KEY_PATH is empty, using ephemeral identity key.")
        return Ed25519PrivateKey.generate()

    if os.path.exists(NODE_PRIVATE_KEY_PATH):
        try:
            with open(NODE_PRIVATE_KEY_PATH, "rb") as key_file:
                loaded_key = load_pem_private_key(key_file.read(), password=None)
            if not isinstance(loaded_key, Ed25519PrivateKey):
                raise ValueError("Loaded key is not Ed25519")
            print(f"[{NODE_ID}] Loaded persistent node identity key from {NODE_PRIVATE_KEY_PATH}")
            return loaded_key
        except Exception as e:
            print(f"FATAL ERROR: [{NODE_ID}] Failed to load node private key from {NODE_PRIVATE_KEY_PATH}: {e}")
            sys.exit(1)

    try:
        key_dir = os.path.dirname(NODE_PRIVATE_KEY_PATH)
        if key_dir:
            os.makedirs(key_dir, exist_ok=True)

        generated_key = Ed25519PrivateKey.generate()
        pem_bytes = generated_key.private_bytes(
            encoding=Encoding.PEM,
            format=PrivateFormat.PKCS8,
            encryption_algorithm=NoEncryption()
        )

        with open(NODE_PRIVATE_KEY_PATH, "wb") as key_file:
            key_file.write(pem_bytes)

        try:
            os.chmod(NODE_PRIVATE_KEY_PATH, 0o600)
        except Exception:
            # Best effort only (Windows may ignore chmod semantics).
            pass

        print(f"[{NODE_ID}] Generated persistent node identity key at {NODE_PRIVATE_KEY_PATH}")
        return generated_key
    except Exception as e:
        print(f"FATAL ERROR: [{NODE_ID}] Failed to create node private key at {NODE_PRIVATE_KEY_PATH}: {e}")
        sys.exit(1)


NODE_PRIVATE_KEY = load_or_create_node_private_key()
NODE_PUBLIC_KEY_B64 = base64.b64encode(
    NODE_PRIVATE_KEY.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
).decode("ascii")

def build_auth_signature():
    message = f"node-auth:{NODE_ID}".encode("utf-8")
    signature = NODE_PRIVATE_KEY.sign(message)
    return base64.b64encode(signature).decode("ascii")

def recover_auth_session():
    """Re-authenticate and re-register after token invalidation."""
    with AUTH_RECOVERY_LOCK:
        print(f"[{NODE_ID}] Attempting auth session recovery...")
        if not authenticate(max_retries=6, retry_delay=2):
            print(f"[{NODE_ID}] Auth recovery failed.")
            return False
        if not register_with_aggregator(max_retries=6, retry_delay=2):
            print(f"[{NODE_ID}] Re-registration failed after auth recovery.")
            return False
        print(f"[{NODE_ID}] Auth session recovered successfully.")
        return True

# Homomorphic Encryption Config
HE_ENABLED = os.getenv("HE_ENABLED", "false").lower() == "true"
HE_SHARED_CONTEXT_B64 = os.getenv("HE_SHARED_CONTEXT_B64", "").strip()
HE_SHARED_CONTEXT_FILE = os.getenv("HE_SHARED_CONTEXT_FILE", "/app/shared_he_context_private.b64").strip()
he_context = None
if HE_ENABLED:
    print(f"[{NODE_ID}] Homomorphic Encryption is ENABLED. Loading shared TenSEAL CKKS context...")
    try:
        if HE_SHARED_CONTEXT_B64:
            he_context = he_manager.load_context_from_base64(HE_SHARED_CONTEXT_B64)
        elif HE_SHARED_CONTEXT_FILE:
            with open(HE_SHARED_CONTEXT_FILE, "rb") as context_file:
                context_bytes = context_file.read()

            # Accept either raw context bytes or a base64 file payload.
            try:
                he_context = he_manager.load_context_from_base64(context_bytes.decode("ascii").strip())
            except Exception:
                he_context = he_manager.load_context_from_blob(context_bytes)
        else:
            print(f"FATAL ERROR: [{NODE_ID}] HE_ENABLED=true requires HE_SHARED_CONTEXT_B64 or HE_SHARED_CONTEXT_FILE.")
            sys.exit(1)
    except Exception as e:
        print(f"FATAL ERROR: [{NODE_ID}] Failed to load shared HE context: {e}")
        sys.exit(1)

def get_auth_headers():
    if JWT_TOKEN:
        return {"Authorization": f"Bearer {JWT_TOKEN}"}
    return {}

# =========================================================================
# MODEL CACHE & CHECKPOINT — Persistent local state for physical devices
# =========================================================================

def get_checkpoint_path(round_number):
    """Generate checkpoint file path for a given round."""
    return os.path.join(RUNTIME_CONFIG["checkpoint_dir"], f"model_round_{round_number}.pt")

def get_model_cache_path():
    """Get path for the most recent model cache file."""
    return os.path.join(RUNTIME_CONFIG["model_cache_dir"], "model_latest.pt")

def get_he_context_fingerprint_path():
    """Get path for stored HE context fingerprint (for validation)."""
    return os.path.join(RUNTIME_CONFIG["checkpoint_dir"], "he_context_fingerprint.txt")

def validate_he_context_consistency():
    """
    Validates that the loaded HE context matches the stored fingerprint.
    This ensures all physical devices use identical HE context for aggregation.
    """
    if not HE_ENABLED or not he_context:
        return True
    
    try:
        import hashlib
        # Get fingerprint of current context (convert to base64 and hash)
        context_b64 = he_manager.export_context_to_base64(he_context) if hasattr(he_manager, 'export_context_to_base64') else HE_SHARED_CONTEXT_B64
        current_fingerprint = hashlib.sha256(context_b64.encode() if isinstance(context_b64, str) else context_b64).hexdigest()
        
        fingerprint_path = get_he_context_fingerprint_path()
        
        if os.path.exists(fingerprint_path):
            with open(fingerprint_path, "r") as f:
                stored_fingerprint = f.read().strip()
            
            if current_fingerprint != stored_fingerprint:
                print(f"[{NODE_ID}] ERROR: HE context fingerprint mismatch!")
                print(f"  Stored:  {stored_fingerprint}")
                print(f"  Current: {current_fingerprint}")
                print(f"  This indicates HE context divergence across physical nodes. Cannot proceed.")
                return False
        else:
            # First time: store fingerprint
            os.makedirs(os.path.dirname(fingerprint_path), exist_ok=True)
            with open(fingerprint_path, "w") as f:
                f.write(current_fingerprint)
            print(f"[{NODE_ID}] Stored HE context fingerprint: {current_fingerprint}")
        
        return True
    except Exception as e:
        print(f"[{NODE_ID}] Warning: Could not validate HE context consistency: {e}")
        # Don't fail if fingerprinting fails - continue training
        return True

def save_model_checkpoint(model, round_number):
    """Save model state dict to checkpoint after successful training round."""
    try:
        checkpoint_path = get_checkpoint_path(round_number)
        torch.save(model.state_dict(), checkpoint_path)
        print(f"[{NODE_ID}] Saved model checkpoint for round {round_number} to {checkpoint_path}")
        return True
    except Exception as e:
        print(f"[{NODE_ID}] Warning: Failed to save checkpoint: {e}")
        return False

def load_model_checkpoint(model, round_number):
    """Load model state dict from checkpoint if it exists."""
    try:
        checkpoint_path = get_checkpoint_path(round_number)
        if os.path.exists(checkpoint_path):
            model.load_state_dict(torch.load(checkpoint_path))
            print(f"[{NODE_ID}] Loaded model checkpoint for round {round_number} from {checkpoint_path}")
            return True
    except Exception as e:
        print(f"[{NODE_ID}] Warning: Failed to load checkpoint for round {round_number}: {e}")
    return False

def save_model_cache(model):
    """Save latest model to cache for quick recovery on restart."""
    try:
        cache_path = get_model_cache_path()
        torch.save(model.state_dict(), cache_path)
        return True
    except Exception as e:
        print(f"[{NODE_ID}] Warning: Failed to save model cache: {e}")
        return False

def load_model_cache(model):
    """Attempt to load model from cache on startup."""
    try:
        cache_path = get_model_cache_path()
        if os.path.exists(cache_path):
            model.load_state_dict(torch.load(cache_path))
            print(f"[{NODE_ID}] Loaded model from cache {cache_path} on startup")
            return True
    except Exception as e:
        print(f"[{NODE_ID}] Warning: Failed to load model from cache: {e}")
    return False

def authenticate(max_retries=60, retry_delay=5):
    global JWT_TOKEN
    print(f"[{NODE_ID}] Authenticating with aggregator at {AUTH_URL}...")
    hostname = socket.gethostname()
    for attempt in range(max_retries):
        if _shutdown_flag.is_set():
            return False
        try:
            response = requests.post(AUTH_URL, json={
                "nodeId": NODE_ID,
                "hostname": hostname,
                "publicKey": NODE_PUBLIC_KEY_B64,
                "signature": build_auth_signature(),
                "enrollmentToken": NODE_ENROLLMENT_TOKEN,
                "clientVersion": CLIENT_VERSION,
                "deviceModel": DEVICE_MODEL,
                "deviceOs": DEVICE_OS,
                "deviceCpu": DEVICE_CPU,
                "deviceGpu": DEVICE_GPU,
                "deviceRegion": DEVICE_REGION
            }, timeout=10, verify=REQUESTS_VERIFY_ARG)
            if response.status_code == 200:
                JWT_TOKEN = response.json().get("token")
                print(f"[{NODE_ID}] Authenticated successfully. JWT obtained.")
                return True
            else:
                print(f"[{NODE_ID}] Auth failed (HTTP {response.status_code}): {response.text}")
                # If it's a 401, maybe the secret is wrong - we still retry in case it's a startup race
        except requests.exceptions.ConnectionError:
            print(f"[{NODE_ID}] ConnectionError: Aggregator at {AGGREGATOR_BASE_URL} not reachable. Retry {attempt + 1}/{max_retries}...")
        except Exception as e:
            print(f"[{NODE_ID}] Unexpected auth error ({type(e).__name__}): {e}")
        
        time.sleep(retry_delay)
    return False

# =========================================================================
# SHUTDOWN HANDLER — Graceful K8s pod termination
# =========================================================================

_shutdown_flag = threading.Event()

def _graceful_shutdown(signum, frame):
    """Handle SIGTERM/SIGINT for graceful K8s pod termination."""
    print(f"[{NODE_ID}] Received shutdown signal ({signum}). Unregistering...")
    _shutdown_flag.set()
    try:
        requests.post(UNREGISTER_URL, headers=get_auth_headers(), json={"nodeId": NODE_ID}, timeout=5, verify=REQUESTS_VERIFY_ARG)
        print(f"[{NODE_ID}] Successfully unregistered from aggregator.")
    except Exception as e:
        print(f"[{NODE_ID}] Failed to unregister: {e}")
    sys.exit(0)

signal.signal(signal.SIGTERM, _graceful_shutdown)
signal.signal(signal.SIGINT, _graceful_shutdown)

# =========================================================================
# WATCHDOG — Health monitoring and auto-recovery for physical devices
# =========================================================================

_last_heartbeat_time = time.time()
_watchdog_check_enabled = RUNTIME_CONFIG["watchdog_enabled"]

def record_heartbeat():
    """Record that the process is alive (called periodically by main loop)."""
    global _last_heartbeat_time
    _last_heartbeat_time = time.time()

def watchdog_monitor():
    """Background thread that monitors process health and triggers recovery if needed."""
    if not _watchdog_check_enabled:
        print(f"[{NODE_ID}] Watchdog is disabled.")
        return
    
    check_interval = RUNTIME_CONFIG["watchdog_check_interval"]
    max_stale_time = check_interval * 5  # If no activity for 5 check intervals, restart
    
    print(f"[{NODE_ID}] Watchdog started (check_interval={check_interval}s, max_stale={max_stale_time}s)")
    
    while not _shutdown_flag.is_set():
        try:
            current_time = time.time()
            time_since_last_activity = current_time - _last_heartbeat_time
            
            # Get CPU/Memory usage
            try:
                process = psutil.Process()
                cpu_percent = process.cpu_percent(interval=1)
                memory_info = process.memory_info()
                memory_mb = memory_info.rss / (1024 * 1024)
            except:
                cpu_percent = 0
                memory_mb = 0
            
            if time_since_last_activity > max_stale_time:
                print(f"[{NODE_ID}] WARNING: Watchdog detected stale process ({time_since_last_activity:.0f}s inactive). CPU={cpu_percent}%, Memory={memory_mb:.0f}MB")
                print(f"[{NODE_ID}] Setting shutdown flag for graceful restart...")
                _shutdown_flag.set()
            else:
                if time_since_last_activity > check_interval * 2:
                    print(f"[{NODE_ID}] Watchdog: Process possibly stuck (last activity {time_since_last_activity:.0f}s ago)")
        
        except Exception as e:
            print(f"[{NODE_ID}] Watchdog error: {e}")
        
        # Sleep in intervals to respond to shutdown quickly
        for _ in range(check_interval):
            if _shutdown_flag.is_set():
                return
            time.sleep(1)

# =========================================================================
# MODEL DEFINITION
# =========================================================================

class MNISTModel(nn.Module):
    def __init__(self):
        super(MNISTModel, self).__init__()
        self.fc1 = nn.Linear(28 * 28, 128)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(128, 10)
        
    def forward(self, x):
        x = x.view(-1, 28 * 28)
        x = self.relu(self.fc1(x))
        x = self.fc2(x)
        return x

def flatten_weights(model):
    """Extracts PyTorch parameters and flattens them into a single 1D Python list of floats."""
    flat_weights = []
    for param in model.parameters():
        flat_weights.extend(param.data.flatten().tolist())
    return flat_weights

def unflatten_weights(model, flat_list):
    """Takes a 1D list from Java and reshapes it back into the PyTorch model's parameter shapes."""
    current_index = 0
    for param in model.parameters():
        num_elements = param.numel()
        param_data = torch.tensor(flat_list[current_index : current_index + num_elements], dtype=torch.float32)
        param.data.copy_(param_data.view_as(param))
        current_index += num_elements

# =========================================================================
# REGISTRATION — Dynamic node registration with retry
# =========================================================================

def register_with_aggregator(max_retries=30, retry_delay=5):
    """Register this node with the aggregator. Retries until successful."""
    hostname = socket.gethostname()
    print(f"[{NODE_ID}] Registering with aggregator at {REGISTER_URL}...")
    
    for attempt in range(max_retries):
        if _shutdown_flag.is_set():
            return False
        try:
            response = requests.post(REGISTER_URL, headers=get_auth_headers(), json={
                "nodeId": NODE_ID,
                "hostname": hostname
            }, timeout=10, verify=REQUESTS_VERIFY_ARG)
            
            if response.status_code == 200:
                data = response.json()
                print(f"[{NODE_ID}] Registered successfully! "
                      f"Current round: {data.get('currentRound', 0)}, "
                      f"Active nodes: {data.get('activeNodes', '?')}, "
                      f"Min quorum: {data.get('minQuorum', '?')}")
                return True
            else:
                print(f"[{NODE_ID}] Registration failed (HTTP {response.status_code}): {response.text}")
        except requests.exceptions.ConnectionError:
            print(f"[{NODE_ID}] Aggregator not ready. Retry {attempt + 1}/{max_retries} in {retry_delay}s...")
        except Exception as e:
            print(f"[{NODE_ID}] Registration error: {e}")
        
        time.sleep(retry_delay)
    
    print(f"[{NODE_ID}] Failed to register after {max_retries} attempts. Exiting.")
    return False

# =========================================================================
# HEARTBEAT — Background thread for K8s liveness
# =========================================================================

def heartbeat_loop():
    """Send periodic heartbeats to the aggregator."""
    while not _shutdown_flag.is_set():
        try:
            response = requests.post(HEARTBEAT_URL, headers=get_auth_headers(), json={"nodeId": NODE_ID}, timeout=5, verify=REQUESTS_VERIFY_ARG)
            if response.status_code != 200:
                print(f"[{NODE_ID}] Heartbeat failed (HTTP {response.status_code})")
                if response.status_code == 401:
                    recover_auth_session()
        except Exception as e:
            print(f"[{NODE_ID}] Heartbeat error: {e}")
        
        # Sleep in small intervals to respond to shutdown quickly
        for _ in range(HEARTBEAT_INTERVAL):
            if _shutdown_flag.is_set():
                return
            time.sleep(1)

# =========================================================================
# NETWORK COMMUNICATION
# =========================================================================

def fetch_global_model():
    """Fetches the latest global model weights from the Aggregator via gRPC."""
    if not JWT_TOKEN:
        return 0, [], default_round_hyperparams()
        
    try:
        channel = _build_grpc_channel()
        stub = federated_pb2_grpc.FederatedServiceStub(channel)
        metadata = (('authorization', f'Bearer {JWT_TOKEN}'),)
        request = federated_pb2.GlobalModelRequest(node_id=NODE_ID)
        response = stub.GetGlobalModel(request, metadata=metadata, timeout=15)
        round_hyperparams = parse_round_hyperparams(response)
        
        if response.he_enabled and response.encrypted_global_weights:
            report_activity("DOWNLOADING", "Decrypting HE global model")
            try:
                decrypted_weights = he_manager.decrypt_weights(he_context, response.encrypted_global_weights)
                return response.current_round, decrypted_weights, round_hyperparams
            except Exception as e:
                print(f"[{NODE_ID}] Failed to decrypt global model: {e}")
                return response.current_round, [], round_hyperparams
        else:
            return response.current_round, list(response.global_weights), round_hyperparams
            
    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.UNAUTHENTICATED:
            print(f"[{NODE_ID}] Unauthorized! Invalid token for global model fetch.")
            recover_auth_session()
        else:
            print(f"[{NODE_ID}] gRPC error fetching global model: {e.code()} - {e.details()}")
    except Exception as e:
        print(f"[{NODE_ID}] Error fetching global model: {e}")
    return 0, [], default_round_hyperparams()


def default_round_hyperparams():
    return {
        "dp_enabled": DP_ENABLED_DEFAULT,
        "fedprox_mu": FEDPROX_MU_DEFAULT,
        "dp_noise_multiplier": DP_NOISE_MULTIPLIER_DEFAULT,
    }


def parse_round_hyperparams(response):
    # Backward compatibility: if server does not provide dynamic fields, keep env defaults.
    has_dynamic_payload = response.fedprox_mu > 0 and response.dp_noise_multiplier > 0
    fedprox_mu = response.fedprox_mu if has_dynamic_payload else FEDPROX_MU_DEFAULT
    dp_noise_multiplier = response.dp_noise_multiplier if has_dynamic_payload else DP_NOISE_MULTIPLIER_DEFAULT
    dp_enabled = response.dp_enabled if has_dynamic_payload else DP_ENABLED_DEFAULT
    return {
        "dp_enabled": dp_enabled,
        "fedprox_mu": fedprox_mu,
        "dp_noise_multiplier": dp_noise_multiplier,
    }

def evaluate_global_model(model):
    """Evaluates the global model on the full MNIST test set to determine true global accuracy."""
    transform = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,))])
    test_dataset = datasets.MNIST('./data', train=False, download=True, transform=transform)
    test_loader = DataLoader(test_dataset, batch_size=1000, shuffle=False)
    
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for data, target in test_loader:
            outputs = model(data)
            _, predicted = torch.max(outputs.data, 1)
            total += target.size(0)
            correct += (predicted == target).sum().item()
            
    return correct / total

def report_activity(status, detail=""):
    """Report node activity status to the aggregator for live dashboard visualization."""
    try:
        requests.post(ACTIVITY_URL, headers=get_auth_headers(), json={
            "nodeId": NODE_ID,
            "status": status,
            "detail": detail
        }, timeout=3, verify=REQUESTS_VERIFY_ARG)
    except Exception:
        pass  # Non-critical, don't let reporting failures affect training

# =========================================================================
# DATA LOADING — Hash-based dynamic partitioning (no more hardcoded splits)
# =========================================================================

def get_data_loader():
    """Creates a data loader with a reproducible random partition based on NODE_ID hash.
    
    Unlike the old approach (splitting digits 0-4 vs 5-9 by node name),
    this uses the NODE_ID as a seed to create a random subset of the
    training data. Each node gets a unique, reproducible partition.
    """
    transform = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,))])
    dataset = datasets.MNIST('./data', train=True, download=True, transform=transform)
    
    # Use NODE_ID hash as seed for reproducible random partitioning
    seed = hash(NODE_ID) % (2**32)
    rng = random.Random(seed)
    
    # Each node gets a random ~50% subset (configurable via env var)
    partition_fraction = float(os.getenv("DATA_PARTITION_FRACTION", "0.5"))
    num_samples = int(len(dataset) * partition_fraction)
    all_indices = list(range(len(dataset)))
    indices = rng.sample(all_indices, k=num_samples)
    
    subset = Subset(dataset, indices)
    return DataLoader(subset, batch_size=64, shuffle=True)

# =========================================================================
# TRAINING LOOP
# =========================================================================

def train_and_send():
    """Main training loop for the Federated Learning client."""
    # Initialize telemetry
    _update_telemetry(
        node_id=NODE_ID,
        he_enabled=HE_ENABLED,
        dp_enabled=DP_ENABLED_DEFAULT,
        status="initializing",
        fedprox_mu=FEDPROX_MU_DEFAULT,
        dp_noise_multiplier=DP_NOISE_MULTIPLIER_DEFAULT
    )
    
    print(f"[{NODE_ID}] ================================================")
    print(f"[{NODE_ID}] FL Node Client Starting (Device Runtime Layer)")
    print(f"[{NODE_ID}] Mode: NODE_ENDPOINT_MODE={NODE_ENDPOINT_MODE}")
    print(f"[{NODE_ID}] Device Runtime: model_cache={RUNTIME_CONFIG['model_cache_dir']}, checkpoint_dir={RUNTIME_CONFIG['checkpoint_dir']}")
    print(f"[{NODE_ID}] Watchdog: enabled={RUNTIME_CONFIG['watchdog_enabled']}, check_interval={RUNTIME_CONFIG['watchdog_check_interval']}s")
    if HE_ENABLED:
        print(f"[{NODE_ID}] HE Status: ENABLED, will validate context consistency")
    print(f"[{NODE_ID}] ================================================")
    
    # Step 0: Validate HE context consistency (if enabled)
    if HE_ENABLED:
        if not validate_he_context_consistency():
            print(f"[{NODE_ID}] HE context validation failed. Exiting.")
            return
    
    # Step 0b: Authenticate
    _update_telemetry(status="connecting")
    if not authenticate():
        print(f"[{NODE_ID}] Cannot proceed without authentication. Shutting down.")
        _update_telemetry(status="disconnected")
        return
        
    # Step 1: Register with aggregator (blocks until successful)
    if not register_with_aggregator():
        print(f"[{NODE_ID}] Cannot proceed without registration. Shutting down.")
        _update_telemetry(status="disconnected")
        return
    
    _update_telemetry(status="connected")
    
    # Step 2: Start heartbeat background thread
    heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    heartbeat_thread.start()
    
    # Step 2b: Start watchdog monitor thread (for physical device auto-recovery)
    if RUNTIME_CONFIG["watchdog_enabled"]:
        watchdog_thread = threading.Thread(target=watchdog_monitor, daemon=True)
        watchdog_thread.start()
    
    # Step 3: Initialize model and data
    print(f"[{NODE_ID}] Initializing model and downloading dataset...")
    model = MNISTModel()
    
    # Try to restore model from cache if available (useful for restart recovery)
    load_model_cache(model)
    
    dataloader = get_data_loader()
    criterion = nn.CrossEntropyLoss()
    
    last_trained_round = -1

    while not _shutdown_flag.is_set():
        # Record that we're alive (for watchdog monitoring)
        record_heartbeat()
        
        # 1. Fetch the latest global model
        _update_telemetry(status="waiting")
        report_activity("DOWNLOADING", "Fetching global model")
        current_round, global_weights, round_hparams = fetch_global_model()
        round_dp_enabled = round_hparams["dp_enabled"]
        round_fedprox_mu = round_hparams["fedprox_mu"]
        round_dp_noise = round_hparams["dp_noise_multiplier"]
        _update_telemetry(
            current_round=current_round,
            dp_enabled=round_dp_enabled,
            fedprox_mu=round_fedprox_mu,
            dp_noise_multiplier=round_dp_noise
        )
        print(
            f"[{NODE_ID}] Round {current_round} hyperparams from aggregator: "
            f"dp_enabled={round_dp_enabled}, fedprox_mu={round_fedprox_mu:.6f}, dp_noise_multiplier={round_dp_noise:.6f}"
        )

        if current_round < last_trained_round:
            print(f"[{NODE_ID}] Aggregator reset detected! Wiping local learning memory.")
            model = MNISTModel()
            last_trained_round = -1
            
        if current_round <= last_trained_round and current_round != 0:
            print(f"[{NODE_ID}] Round {current_round} already trained. Waiting for aggregator to advance to round {current_round + 1}...")
            _update_telemetry(status="waiting")
            time.sleep(5)
            continue

        round_start_time = time.time()

        # 2. Update local model with global weights if available
        if current_round > 0 and global_weights:
            try:
                unflatten_weights(model, global_weights)
                print(f"[{NODE_ID}] Loaded model from global round {current_round}")
            except Exception as e:
                print(f"[{NODE_ID}] Failed to load global weights: {e}")
        else:
            print(f"[{NODE_ID}] Round 0: Using initial local random weights.")

        # Evaluate true global accuracy BEFORE local training
        report_activity("EVALUATING", "Running accuracy test on full MNIST")
        true_accuracy = evaluate_global_model(model)
        print(f"[{NODE_ID}] True Global Accuracy on full test set: {true_accuracy * 100:.2f}%")

        # Capture starting weights to compute the update delta later
        starting_weights = flatten_weights(model)
        global_weights_copy = [param.clone().detach() for param in model.parameters()]

        # 3. Train on local MNIST subset for 1 epoch
        report_activity("TRAINING", "Starting epoch")
        _update_telemetry(status="training", total_batches=len(dataloader), current_batch=0)
        print(f"[{NODE_ID}] Starting local training (1 epoch)...")
        model.train()
        optimizer = optim.SGD(model.parameters(), lr=0.01, momentum=0.9)
        running_loss = 0.0
        
        for batch_idx, (data, target) in enumerate(dataloader):
            if _shutdown_flag.is_set():
                return
                
            optimizer.zero_grad()
            output = model(data)
            loss = criterion(output, target)
            
            # Proximal term for FedProx
            proximal_term = 0.0
            for param, global_param in zip(model.parameters(), global_weights_copy):
                proximal_term += ((param - global_param) ** 2).sum()
            loss += (round_fedprox_mu / 2.0) * proximal_term

            loss.backward()
            optimizer.step()
            running_loss += loss.item()
            _update_telemetry(current_batch=batch_idx)
            
            if batch_idx % 150 == 0:
                print(f"[{NODE_ID}] Batch {batch_idx}/{len(dataloader)}\tLoss: {loss.item():.4f}")
            if batch_idx % ACTIVITY_REPORT_BATCH_INTERVAL == 0:
                report_activity("TRAINING", f"Batch {batch_idx}/{len(dataloader)}, Loss: {loss.item():.4f}")
                
        avg_loss = running_loss / len(dataloader)
        print(f"[{NODE_ID}] Finished epoch. Average Loss: {avg_loss:.4f}")
        
        # Record loss and accuracy in telemetry for local dashboard charts
        with _telemetry_lock:
            _telemetry.loss_history.append({
                "round": current_round,
                "loss": round(avg_loss, 6)
            })
            _telemetry.accuracy_history.append({
                "round": current_round,
                "accuracy": round(true_accuracy, 6)
            })

        # 4. Flatten, compute update delta, apply DP, then send updated weights back to aggregator
        trained_weights_list = flatten_weights(model)
        
        if round_dp_enabled:
            t_trained = torch.tensor(trained_weights_list)
            t_start = torch.tensor(starting_weights)
            update_tensor = t_trained - t_start
            
            max_norm = 1.0
            l2_norm = torch.norm(update_tensor, p=2)
            if l2_norm > max_norm:
                update_tensor = update_tensor * (max_norm / l2_norm)
                
            noise = torch.normal(mean=0.0, std=round_dp_noise * max_norm, size=update_tensor.size())
            noisy_update = update_tensor + noise
            
            final_weights_tensor = t_start + noisy_update
            trained_weights = final_weights_tensor.tolist()
            
            print(f"[{NODE_ID}] Applied Local DP: clipped update L2 norm={l2_norm:.4f}, noise std={round_dp_noise * max_norm}")
        else:
            trained_weights = trained_weights_list

        # Homomorphic Encryption (encrypting the combined DP+updated weights)
        encrypted_blob = b""
        pub_ctx_blob = b""
        
        if HE_ENABLED:
            print(f"[{NODE_ID}] Encrypting weights via TenSEAL CKKS...")
            _update_telemetry(status="encrypting")
            report_activity("ENCRYPTING", "Homomorphic encryption of weights")
            try:
                encrypted_blob, pub_ctx_blob = he_manager.encrypt_weights(he_context, trained_weights)
            except Exception as e:
                print(f"[{NODE_ID}] Failed to encrypt weights: {e}")
                pass
                
        print(f"[{NODE_ID}] Sending updated weights to Aggregator via gRPC (Loss: {avg_loss:.4f})...")
        _update_telemetry(status="uploading")
        report_activity("UPLOADING", f"Sending weights (Loss: {avg_loss:.4f})")
        submission_successful = False
        for attempt in range(5):
            try:
                channel = _build_grpc_channel()
                stub = federated_pb2_grpc.FederatedServiceStub(channel)
                metadata = (('authorization', f'Bearer {JWT_TOKEN}'),)

                if HE_ENABLED and encrypted_blob and pub_ctx_blob:
                    request = federated_pb2.WeightRequest(
                        node_id=NODE_ID,
                        loss=avg_loss,
                        dp_enabled=round_dp_enabled,
                        accuracy=true_accuracy,
                        round_number=current_round,
                        he_enabled=True,
                        encrypted_weights=encrypted_blob,
                        he_context_public=pub_ctx_blob
                    )
                else:
                    request = federated_pb2.WeightRequest(
                        node_id=NODE_ID,
                        weights=trained_weights,
                        loss=avg_loss,
                        dp_enabled=round_dp_enabled,
                        accuracy=true_accuracy,
                        round_number=current_round,
                        he_enabled=False
                    )

                response = stub.SubmitWeights(request, metadata=metadata, timeout=180)

                if response.status == "error":
                    print(f"[{NODE_ID}] Aggregator rejected weights: {response.message}")
                    MODELS_REJECTED.labels(nodeId=NODE_ID).inc()
                else:
                    print(f"[{NODE_ID}] Aggregator response: {response.message}")
                    submission_successful = True
                break
            except grpc.RpcError as e:
                if e.code() == grpc.StatusCode.UNAUTHENTICATED:
                    print(f"[{NODE_ID}] Unauthorized! Invalid token for sending weights.")
                    recover_auth_session()
                    break
                print(f"[{NODE_ID}] gRPC submit attempt {attempt + 1}/5 failed: {e.code()} - {e.details()}")
                if attempt < 4:
                    time.sleep(2)
            except Exception as e:
                print(f"[{NODE_ID}] Failed to send weights: {e}")
                break

        if not submission_successful:
            print(f"[{NODE_ID}] Submission failed for round {current_round}; will retry this round on the next loop.")
            time.sleep(5)
            continue
            
        # 5. Track state and delay to observe the rounds progressing cleanly
        last_trained_round = current_round
        
        # Save model checkpoint and cache for recovery (physical device resilience)
        save_model_checkpoint(model, current_round)
        save_model_cache(model)
        
        round_duration = time.time() - round_start_time
        FL_ROUND_DURATION.labels(nodeId=NODE_ID).set(round_duration)
        
        _update_telemetry(
            status="idle",
            last_round_duration=round(round_duration, 2),
            total_rounds_completed=last_trained_round
        )
        
        report_activity("IDLE", f"Completed round {current_round}")
        print("-" * 50)
        time.sleep(5)

# =========================================================================
# FASTAPI LIFECYCLE — Prometheus/Health (port 8000)
# =========================================================================

@app.on_event("startup")
def startup_event():
    print(f"Starting Federated Learning Node: {NODE_ID}")
    print(f"  Endpoint mode: {NODE_ENDPOINT_MODE}")
    print(f"  Aggregator: {AGGREGATOR_BASE_URL}")
    print(f"  Aggregator gRPC: {AGGREGATOR_GRPC_URL}")
    print(f"  Client version: {CLIENT_VERSION}")
    print(f"  Node key path: {NODE_PRIVATE_KEY_PATH if NODE_PRIVATE_KEY_PATH else 'ephemeral'}")
    print(f"  DP Enabled (default): {DP_ENABLED_DEFAULT}")
    print(f"  HE Enabled: {HE_ENABLED}")
    print(f"  FedProx μ (default): {FEDPROX_MU_DEFAULT}")
    print(f"  DP noise (default): {DP_NOISE_MULTIPLIER_DEFAULT}")
    print(f"  Local UI: {'ENABLED on port ' + str(LOCAL_UI_PORT) if ENABLE_LOCAL_UI else 'DISABLED'}")
    thread = threading.Thread(target=train_and_send, daemon=True)
    thread.start()
    
    # Start hardware monitoring background thread
    hw_thread = threading.Thread(target=_hardware_monitor_loop, daemon=True)
    hw_thread.start()

@app.get("/")
def read_root():
    return {"status": "Node running", "nodeId": NODE_ID}

@app.get("/health")
def health_check():
    return {"status": "healthy", "nodeId": NODE_ID, "shutdown": _shutdown_flag.is_set()}

# =========================================================================
# LOCAL UI DASHBOARD — FastAPI app on port 8080 (conditional)
# =========================================================================

ui_app = FastAPI(title="FL Node Local Dashboard")
ui_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@ui_app.get("/api/status")
def ui_status():
    """Full telemetry snapshot for the local dashboard."""
    with _telemetry_lock:
        return JSONResponse({
            "nodeId": _telemetry.node_id or NODE_ID,
            "status": _telemetry.status,
            "currentRound": _telemetry.current_round,
            "heEnabled": _telemetry.he_enabled,
            "dpEnabled": _telemetry.dp_enabled,
            "uptimeSeconds": round(time.time() - _telemetry.start_time, 1),
            "lastRoundDuration": _telemetry.last_round_duration,
            "totalRoundsCompleted": _telemetry.total_rounds_completed,
            "fedproxMu": _telemetry.fedprox_mu,
            "dpNoiseMultiplier": _telemetry.dp_noise_multiplier,
            "currentBatch": _telemetry.current_batch,
            "totalBatches": _telemetry.total_batches,
        })

@ui_app.get("/api/metrics")
def ui_metrics():
    """Training loss and accuracy history for chart rendering."""
    with _telemetry_lock:
        return JSONResponse({
            "lossHistory": list(_telemetry.loss_history),
            "accuracyHistory": list(_telemetry.accuracy_history),
        })

@ui_app.get("/api/hardware")
def ui_hardware():
    """Current CPU and RAM usage."""
    _update_hardware_metrics()
    with _telemetry_lock:
        return JSONResponse({
            "cpuPercent": _telemetry.cpu_percent,
            "ramPercent": _telemetry.ram_percent,
            "ramUsedMb": _telemetry.ram_used_mb,
            "ramTotalMb": _telemetry.ram_total_mb,
        })

@ui_app.get("/api/logs")
def ui_logs():
    """Return buffered log entries (for initial page load)."""
    with _telemetry_lock:
        return JSONResponse(list(_telemetry.logs))

@ui_app.websocket("/ws/logs")
async def ws_logs(websocket: WebSocket):
    """Real-time log streaming via WebSocket."""
    await websocket.accept()
    with _ws_clients_lock:
        _ws_clients.append(websocket)
    try:
        # Send buffered logs on connect
        with _telemetry_lock:
            for entry in _telemetry.logs:
                await websocket.send_json(entry)
        # Keep alive — wait for client disconnect
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        with _ws_clients_lock:
            if websocket in _ws_clients:
                _ws_clients.remove(websocket)

def _run_local_ui_server():
    """Run the local UI server on a separate thread (port 8080)."""
    global _ui_event_loop
    import uvicorn
    
    # Mount the static Next.js export if available
    ui_static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui", "out")
    if os.path.isdir(ui_static_dir):
        # Serve static files, with index.html as the SPA fallback
        ui_app.mount("/", StaticFiles(directory=ui_static_dir, html=True), name="static-ui")
        print(f"[{NODE_ID}] Local UI static files mounted from {ui_static_dir}")
    else:
        @ui_app.get("/")
        def ui_fallback():
            return JSONResponse({
                "error": "UI not built",
                "message": "Run 'npm run build' in node_client/ui/ to generate the static dashboard.",
                "api": "The API endpoints (/api/status, /api/metrics, /api/hardware) are still available."
            })
        print(f"[{NODE_ID}] WARNING: ui/out/ directory not found. Dashboard will show API-only fallback.")
    
    config = uvicorn.Config(ui_app, host="0.0.0.0", port=LOCAL_UI_PORT, log_level="warning")
    server = uvicorn.Server(config)
    _ui_event_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_ui_event_loop)
    _ui_event_loop.run_until_complete(server.serve())

if __name__ == "__main__":
    import uvicorn
    
    # Start local UI server if enabled
    if ENABLE_LOCAL_UI:
        ui_thread = threading.Thread(target=_run_local_ui_server, daemon=True)
        ui_thread.start()
        print(f"[{NODE_ID}] ✦ Local Dashboard: http://localhost:{LOCAL_UI_PORT}")
    
    print(f"[{NODE_ID}] Starting FastAPI server on port 8000 for Prometheus metrics and health checks...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
