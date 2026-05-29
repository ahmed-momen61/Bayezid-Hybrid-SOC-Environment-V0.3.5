import torch
import torch.nn as nn
from torch_geometric.nn import SAGEConv
from fastapi import FastAPI, Request
import uvicorn
app = FastAPI()
class GraphSAGEOracle(nn.Module):
    def __init__(self, in_channels=16, hidden=64, out=1):
        super().__init__()
        self.conv1 = SAGEConv(in_channels, hidden)
        self.conv2 = SAGEConv(hidden, hidden)
        self.head  = nn.Linear(hidden, out)
        self.relu  = nn.ReLU()
        self.sig   = nn.Sigmoid()
    def forward(self, x, edge_index):
        x = self.relu(self.conv1(x, edge_index))
        x = self.relu(self.conv2(x, edge_index))
        return self.sig(self.head(x))
model = GraphSAGEOracle(in_channels=16)
@app.post("/api/v1/gnn/predict-lateral")
async def predict_lateral(req: Request):
    body = await req.json()
    if not body.get('nodes') or not body.get('edges'):
        return {"risk_scores": []}
    x = torch.tensor(body['nodes'], dtype=torch.float)
    ei = torch.tensor(body['edges'], dtype=torch.long).t().contiguous()
    with torch.no_grad():
        risk_scores = model(x, ei).squeeze().tolist()
    if isinstance(risk_scores, float):
        risk_scores = [risk_scores]
    return {"risk_scores": risk_scores}
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="warning")
