import time
import requests
import threading
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms
from torch.utils.data import DataLoader, Subset
from fastapi import FastAPI
import os

app = FastAPI()

AGGREGATOR_URL = os.getenv("AGGREGATOR_URL", "http://aggregator:8080/api/weights")
GLOBAL_MODEL_URL = AGGREGATOR_URL.replace("/weights", "/global-model")
NODE_ID = os.getenv("NODE_ID", "node-1")
DP_ENABLED = os.getenv("DP_ENABLED", "false").lower() == "true"
DP_NOISE_MULTIPLIER = float(os.getenv("DP_NOISE_MULTIPLIER", "0.01"))
API_KEY = os.getenv("API_KEY")

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

def fetch_global_model():
    """Fetches the latest global model weights from the Aggregator."""
    try:
        response = requests.get(GLOBAL_MODEL_URL, headers={"X-API-Key": API_KEY}, timeout=5)
        if response.status_code == 401:
            print(f"[{NODE_ID}] Unauthorized! Invalid API_KEY for global model fetch.")
            return 0, []
        elif response.status_code == 200:
            data = response.json()
            return data.get("currentRound", 0), data.get("globalWeights", [])
    except Exception as e:
        print(f"[{NODE_ID}] Error fetching global model: {e}")
    return 0, []

def get_data_loader():
    transform = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,))])
    # Download locally within the container
    dataset = datasets.MNIST('./data', train=True, download=True, transform=transform)
    
    # Split dataset based on NODE_ID
    total_len = len(dataset)
    half_len = total_len // 2
    
    if "1" in NODE_ID:
        indices = list(range(0, half_len))
    else:
        indices = list(range(half_len, total_len))
        
    subset = Subset(dataset, indices)
    return DataLoader(subset, batch_size=64, shuffle=True)

def train_and_send():
    """Main training loop for the Federated Learning client."""
    print(f"[{NODE_ID}] Initializing model and downloading dataset...")
    model = MNISTModel()
    dataloader = get_data_loader()
    criterion = nn.CrossEntropyLoss()
    
    last_trained_round = -1

    while True:
        # 1. Fetch the latest global model
        current_round, global_weights = fetch_global_model()
        
        if current_round < last_trained_round:
            print(f"[{NODE_ID}] Aggregator reset detected! Wiping local learning memory.")
            model = MNISTModel()
            last_trained_round = -1
            
        if current_round <= last_trained_round and current_round != 0:
            print(f"[{NODE_ID}] Round {current_round} already trained. Waiting for aggregator to advance to round {current_round + 1}...")
            time.sleep(5)
            continue

        # 2. Update local model with global weights if available
        if current_round > 0 and global_weights:
            try:
                unflatten_weights(model, global_weights)
                print(f"[{NODE_ID}] Loaded model from global round {current_round}")
            except Exception as e:
                print(f"[{NODE_ID}] Failed to load global weights: {e}")
        else:
            print(f"[{NODE_ID}] Round 0: Using initial local random weights.")

        # Capture starting weights to compute the update delta later
        starting_weights = flatten_weights(model)

        # 3. Train on local MNIST subset for 1 epoch
        print(f"[{NODE_ID}] Starting local training (1 epoch)...")
        model.train()
        optimizer = optim.SGD(model.parameters(), lr=0.01, momentum=0.9)
        running_loss = 0.0
        
        for batch_idx, (data, target) in enumerate(dataloader):
            optimizer.zero_grad()
            output = model(data)
            loss = criterion(output, target)
            loss.backward()
            optimizer.step()
            running_loss += loss.item()
            
            if batch_idx % 150 == 0:
                print(f"[{NODE_ID}] Batch {batch_idx}/{len(dataloader)}\tLoss: {loss.item():.4f}")
                
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

        print(f"[{NODE_ID}] Sending updated weights to Aggregator (Loss: {avg_loss:.4f})...")
        try:
            response = requests.post(AGGREGATOR_URL, headers={"X-API-Key": API_KEY}, json={
                "nodeId": NODE_ID, 
                "weights": trained_weights, 
                "loss": avg_loss,
                "dpEnabled": DP_ENABLED
            })
            if response.status_code == 401:
                print(f"[{NODE_ID}] Unauthorized! Invalid API_KEY for sending weights.")
            else:
                print(f"[{NODE_ID}] Aggregator response: {response.json()}")
        except Exception as e:
            print(f"[{NODE_ID}] Failed to send weights: {e}")
            
        # 5. Track state and delay to observe the rounds progressing cleanly
        last_trained_round = current_round
        print("-" * 50)
        time.sleep(5)

@app.on_event("startup")
def startup_event():
    print(f"Starting Federated Learning Node: {NODE_ID}")
    thread = threading.Thread(target=train_and_send, daemon=True)
    thread.start()

@app.get("/")
def read_root():
    return {"status": "Node running", "nodeId": NODE_ID}
