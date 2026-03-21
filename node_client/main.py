import time
import requests
import threading
import torch
import torch.nn as nn
from fastapi import FastAPI
import os

app = FastAPI()

AGGREGATOR_URL = os.getenv("AGGREGATOR_URL", "http://aggregator:8080/api/weights")
GLOBAL_MODEL_URL = AGGREGATOR_URL.replace("/weights", "/global-model")
NODE_ID = os.getenv("NODE_ID", "node-1")

class SimpleModel(nn.Module):
    def __init__(self):
        super(SimpleModel, self).__init__()
        self.fc = nn.Linear(10, 1)
        
    def forward(self, x):
        return self.fc(x)

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

def train_and_send():
    """Main training loop for the Federated Learning client."""
    model = SimpleModel()
    
    while True:
        # 1. Fetch the latest global model before starting a training round
        current_round, global_weights = fetch_global_model()
        
        # 2. Update local model with global weights if the server has a valid model
        if current_round > 0 and global_weights:
            try:
                with torch.no_grad():
                    # Convert the flat list of floats back into a PyTorch tensor
                    weights_tensor = torch.tensor(global_weights, dtype=torch.float32).view_as(model.fc.weight)
                    # Apply the global weights to our local PyTorch model
                    model.fc.weight.copy_(weights_tensor)
                print(f"[{NODE_ID}] Downloaded and applied model from round {current_round}")
            except Exception as e:
                print(f"[{NODE_ID}] Failed to load global weights into PyTorch: {e}")
        else:
            print(f"[{NODE_ID}] Round 0: Using initial random local weights.")

        # 3. Simulate local training step (adding small random noise to represent learning)
        print(f"[{NODE_ID}] Training locally...")
        time.sleep(2) # Simulate computation time
        
        with torch.no_grad():
            model.fc.weight += torch.randn_like(model.fc.weight) * 0.05
            trained_weights = model.fc.weight.flatten().tolist()

        # 4. Send updated weights back to the aggregator
        print(f"[{NODE_ID}] Sending updated weights to Aggregator...")
        try:
            response = requests.post(AGGREGATOR_URL, json={"nodeId": NODE_ID, "weights": trained_weights})
            print(f"[{NODE_ID}] Aggregator response: {response.json()}")
        except Exception as e:
            print(f"[{NODE_ID}] Failed to send weights: {e}")
            
        # 5. Delay to observe the rounds progressing cleanly in the logs
        print("-" * 50)
        time.sleep(5)

@app.on_event("startup")
def startup_event():
    print(f"Starting Federated Learning Node: {NODE_ID}")
    # Start the training loop in the background
    thread = threading.Thread(target=train_and_send, daemon=True)
    thread.start()

@app.get("/")
def read_root():
    return {"status": "Node running", "nodeId": NODE_ID}
