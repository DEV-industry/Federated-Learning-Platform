import time
import requests
import threading
import torch
import torch.nn as nn
from fastapi import FastAPI
import os

app = FastAPI()

AGGREGATOR_URL = os.getenv("AGGREGATOR_URL", "http://aggregator:8080/api/weights")
NODE_ID = os.getenv("NODE_ID", "node-1")

class SimpleModel(nn.Module):
    def __init__(self):
        super(SimpleModel, self).__init__()
        self.fc = nn.Linear(10, 1)
        
    def forward(self, x):
        return self.fc(x)

def train_and_send():
    model = SimpleModel()
    while True:
        # Simulate local training time
        time.sleep(10)
        
        # Simulate training: just take the current weights of the mock model
        with torch.no_grad():
            weights = model.fc.weight.flatten().tolist()
            
        print(f"[{NODE_ID}] Sending weights to {AGGREGATOR_URL}...")
        try:
            response = requests.post(AGGREGATOR_URL, json={"nodeId": NODE_ID, "weights": weights})
            print(f"[{NODE_ID}] Aggregator response: {response.json()}")
        except Exception as e:
            print(f"[{NODE_ID}] Failed to send weights: {e}")

@app.on_event("startup")
def startup_event():
    print(f"Starting Federated Learning Node: {NODE_ID}")
    thread = threading.Thread(target=train_and_send, daemon=True)
    thread.start()

@app.get("/")
def read_root():
    return {"status": "Node running", "nodeId": NODE_ID}
