import time
import requests
import threading
import signal
import sys
import socket
import random
import base64
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms
from torch.utils.data import DataLoader, Subset
import grpc
import federated_pb2
import federated_pb2_grpc
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Gauge, Counter
import os
import he_manager
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

app = FastAPI()

# Prometheus Custom Metrics
FL_ROUND_DURATION = Gauge('fl_round_duration_seconds', 'Duration of the federated learning round', ['nodeId'])
MODELS_REJECTED = Counter('fl_models_rejected_total', 'Total number of models rejected by Multi-Krum', ['nodeId'])

# Instrument app and expose /metrics endpoint
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# =========================================================================
# CONFIGURATION — K8s-native with Docker-compatible defaults
# =========================================================================

AGGREGATOR_BASE_URL = os.getenv("AGGREGATOR_BASE_URL", "http://aggregator:8080")
AGGREGATOR_GRPC_URL = os.getenv("AGGREGATOR_GRPC_URL", "aggregator:9090")
REGISTER_URL = f"{AGGREGATOR_BASE_URL}/api/nodes/register"
HEARTBEAT_URL = f"{AGGREGATOR_BASE_URL}/api/nodes/heartbeat"
UNREGISTER_URL = f"{AGGREGATOR_BASE_URL}/api/nodes/unregister"

# Dynamic identity: must be set from environment (e.g., downward API in K8s)
NODE_ID = os.getenv("NODE_ID")
if not NODE_ID:
    print("FATAL ERROR: NODE_ID environment variable is missing. It must be provided.")
    sys.exit(1)

DP_ENABLED = os.getenv("DP_ENABLED", "false").lower() == "true"
DP_NOISE_MULTIPLIER = float(os.getenv("DP_NOISE_MULTIPLIER", "0.01"))
FEDPROX_MU = float(os.getenv("FEDPROX_MU", "0.01"))
AUTH_URL = f"{AGGREGATOR_BASE_URL}/api/auth"
JWT_TOKEN = None
HEARTBEAT_INTERVAL = int(os.getenv("HEARTBEAT_INTERVAL", "20"))
ACTIVITY_URL = f"{AGGREGATOR_BASE_URL}/api/nodes/activity"
ACTIVITY_REPORT_BATCH_INTERVAL = int(os.getenv("ACTIVITY_REPORT_BATCH_INTERVAL", "100"))

NODE_PRIVATE_KEY = Ed25519PrivateKey.generate()
NODE_PUBLIC_KEY_B64 = base64.b64encode(
    NODE_PRIVATE_KEY.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
).decode("ascii")

def build_auth_signature():
    message = f"node-auth:{NODE_ID}".encode("utf-8")
    signature = NODE_PRIVATE_KEY.sign(message)
    return base64.b64encode(signature).decode("ascii")

# Homomorphic Encryption Config
HE_ENABLED = os.getenv("HE_ENABLED", "false").lower() == "true"
he_context = None
if HE_ENABLED:
    print(f"[{NODE_ID}] Homomorphic Encryption is ENABLED. Generating TenSEAL CKKS context...")
    he_context = he_manager.generate_context()

def get_auth_headers():
    if JWT_TOKEN:
        return {"Authorization": f"Bearer {JWT_TOKEN}"}
    return {}

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
                "signature": build_auth_signature()
            }, timeout=10)
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
        requests.post(UNREGISTER_URL, headers=get_auth_headers(), json={"nodeId": NODE_ID}, timeout=5)
        print(f"[{NODE_ID}] Successfully unregistered from aggregator.")
    except Exception as e:
        print(f"[{NODE_ID}] Failed to unregister: {e}")
    sys.exit(0)

signal.signal(signal.SIGTERM, _graceful_shutdown)
signal.signal(signal.SIGINT, _graceful_shutdown)

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
            }, timeout=10)
            
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
            response = requests.post(HEARTBEAT_URL, headers=get_auth_headers(), json={"nodeId": NODE_ID}, timeout=5)
            if response.status_code != 200:
                print(f"[{NODE_ID}] Heartbeat failed (HTTP {response.status_code})")
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
        return 0, []
        
    try:
        channel = grpc.insecure_channel(AGGREGATOR_GRPC_URL)
        stub = federated_pb2_grpc.FederatedServiceStub(channel)
        metadata = (('authorization', f'Bearer {JWT_TOKEN}'),)
        request = federated_pb2.GlobalModelRequest(node_id=NODE_ID)
        response = stub.GetGlobalModel(request, metadata=metadata, timeout=15)
        
        if response.he_enabled and response.encrypted_global_weights:
            report_activity("DOWNLOADING", "Decrypting HE global model")
            try:
                decrypted_weights = he_manager.decrypt_weights(he_context, response.encrypted_global_weights)
                return response.current_round, decrypted_weights
            except Exception as e:
                print(f"[{NODE_ID}] Failed to decrypt global model: {e}")
                return response.current_round, []
        else:
            return response.current_round, list(response.global_weights)
            
    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.UNAUTHENTICATED:
            print(f"[{NODE_ID}] Unauthorized! Invalid token for global model fetch.")
        else:
            print(f"[{NODE_ID}] gRPC error fetching global model: {e.code()} - {e.details()}")
    except Exception as e:
        print(f"[{NODE_ID}] Error fetching global model: {e}")
    return 0, []

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
        }, timeout=3)
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
    
    # Step 0: Authenticate
    if not authenticate():
        print(f"[{NODE_ID}] Cannot proceed without authentication. Shutting down.")
        return
        
    # Step 1: Register with aggregator (blocks until successful)
    if not register_with_aggregator():
        print(f"[{NODE_ID}] Cannot proceed without registration. Shutting down.")
        return
    
    # Step 2: Start heartbeat background thread
    heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    heartbeat_thread.start()
    
    # Step 3: Initialize model and data
    print(f"[{NODE_ID}] Initializing model and downloading dataset...")
    model = MNISTModel()
    dataloader = get_data_loader()
    criterion = nn.CrossEntropyLoss()
    
    last_trained_round = -1

    while not _shutdown_flag.is_set():
        # 1. Fetch the latest global model
        report_activity("DOWNLOADING", "Fetching global model")
        current_round, global_weights = fetch_global_model()
        
        if current_round < last_trained_round:
            print(f"[{NODE_ID}] Aggregator reset detected! Wiping local learning memory.")
            model = MNISTModel()
            last_trained_round = -1
            
        if current_round <= last_trained_round and current_round != 0:
            print(f"[{NODE_ID}] Round {current_round} already trained. Waiting for aggregator to advance to round {current_round + 1}...")
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
            loss += (FEDPROX_MU / 2.0) * proximal_term

            loss.backward()
            optimizer.step()
            running_loss += loss.item()
            
            if batch_idx % 150 == 0:
                print(f"[{NODE_ID}] Batch {batch_idx}/{len(dataloader)}\tLoss: {loss.item():.4f}")
            if batch_idx % ACTIVITY_REPORT_BATCH_INTERVAL == 0:
                report_activity("TRAINING", f"Batch {batch_idx}/{len(dataloader)}, Loss: {loss.item():.4f}")
                
        avg_loss = running_loss / len(dataloader)
        print(f"[{NODE_ID}] Finished epoch. Average Loss: {avg_loss:.4f}")

        # 4. Flatten, compute update delta, apply DP, then send updated weights back to aggregator
        trained_weights_list = flatten_weights(model)
        
        if DP_ENABLED:
            t_trained = torch.tensor(trained_weights_list)
            t_start = torch.tensor(starting_weights)
            update_tensor = t_trained - t_start
            
            max_norm = 1.0
            l2_norm = torch.norm(update_tensor, p=2)
            if l2_norm > max_norm:
                update_tensor = update_tensor * (max_norm / l2_norm)
                
            noise = torch.normal(mean=0.0, std=DP_NOISE_MULTIPLIER * max_norm, size=update_tensor.size())
            noisy_update = update_tensor + noise
            
            final_weights_tensor = t_start + noisy_update
            trained_weights = final_weights_tensor.tolist()
            
            print(f"[{NODE_ID}] Applied Local DP: clipped update L2 norm={l2_norm:.4f}, noise std={DP_NOISE_MULTIPLIER * max_norm}")
        else:
            trained_weights = trained_weights_list

        # Homomorphic Encryption (encrypting the combined DP+updated weights)
        encrypted_blob = b""
        pub_ctx_blob = b""
        
        if HE_ENABLED:
            print(f"[{NODE_ID}] Encrypting weights via TenSEAL CKKS...")
            report_activity("ENCRYPTING", "Homomorphic encryption of weights")
            try:
                encrypted_blob, pub_ctx_blob = he_manager.encrypt_weights(he_context, trained_weights)
            except Exception as e:
                print(f"[{NODE_ID}] Failed to encrypt weights: {e}")
                # Fallback to no HE if encryption crashes for some reason
                pass
                
        print(f"[{NODE_ID}] Sending updated weights to Aggregator via gRPC (Loss: {avg_loss:.4f})...")
        report_activity("UPLOADING", f"Sending weights (Loss: {avg_loss:.4f})")
        try:
            channel = grpc.insecure_channel(AGGREGATOR_GRPC_URL)
            stub = federated_pb2_grpc.FederatedServiceStub(channel)
            metadata = (('authorization', f'Bearer {JWT_TOKEN}'),)
            
            if HE_ENABLED and encrypted_blob and pub_ctx_blob:
                request = federated_pb2.WeightRequest(
                    node_id=NODE_ID,
                    loss=avg_loss,
                    dp_enabled=DP_ENABLED,
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
                    dp_enabled=DP_ENABLED,
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
                
        except grpc.RpcError as e:
            if e.code() == grpc.StatusCode.UNAUTHENTICATED:
                print(f"[{NODE_ID}] Unauthorized! Invalid token for sending weights.")
                register_with_aggregator(max_retries=5)
            else:
                print(f"[{NODE_ID}] Failed to send weights via gRPC: {e.code()} - {e.details()}")
        except Exception as e:
            print(f"[{NODE_ID}] Failed to send weights: {e}")
            
        # 5. Track state and delay to observe the rounds progressing cleanly
        last_trained_round = current_round
        
        round_duration = time.time() - round_start_time
        FL_ROUND_DURATION.labels(nodeId=NODE_ID).set(round_duration)
        
        report_activity("IDLE", f"Completed round {current_round}")
        print("-" * 50)
        time.sleep(5)

# =========================================================================
# FASTAPI LIFECYCLE
# =========================================================================

@app.on_event("startup")
def startup_event():
    print(f"Starting Federated Learning Node: {NODE_ID}")
    print(f"  Aggregator: {AGGREGATOR_BASE_URL}")
    print(f"  DP Enabled: {DP_ENABLED}")
    print(f"  HE Enabled: {HE_ENABLED}")
    print(f"  FedProx μ: {FEDPROX_MU}")
    thread = threading.Thread(target=train_and_send, daemon=True)
    thread.start()

@app.get("/")
def read_root():
    return {"status": "Node running", "nodeId": NODE_ID}

@app.get("/health")
def health_check():
    return {"status": "healthy", "nodeId": NODE_ID, "shutdown": _shutdown_flag.is_set()}
