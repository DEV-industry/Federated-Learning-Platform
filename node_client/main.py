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
        response = requests.get(GLOBAL_MODEL_URL, timeout=5)
        if response.status_code == 200:
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
    
    while True:
        # 1. Fetch the latest global model
        current_round, global_weights = fetch_global_model()
        
        # 2. Update local model with global weights if available
        if current_round > 0 and global_weights:
            try:
                unflatten_weights(model, global_weights)
                print(f"[{NODE_ID}] Loaded model from global round {current_round}")
            except Exception as e:
                print(f"[{NODE_ID}] Failed to load global weights: {e}")
        else:
            print(f"[{NODE_ID}] Round 0: Using initial local random weights.")

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

        # 4. Flatten and send updated weights back to aggregator
        trained_weights = flatten_weights(model)
        print(f"[{NODE_ID}] Sending updated weights to Aggregator...")
        try:
            response = requests.post(AGGREGATOR_URL, json={"nodeId": NODE_ID, "weights": trained_weights})
            print(f"[{NODE_ID}] Aggregator response: {response.json()}")
        except Exception as e:
            print(f"[{NODE_ID}] Failed to send weights: {e}")
            
        # 5. Delay to observe the rounds progressing cleanly
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
