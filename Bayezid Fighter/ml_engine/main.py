from fastapi import FastAPI, Request
import uvicorn
import numpy as np
from sklearn.ensemble import IsolationForest
import math
import joblib
import os
import torch
import torch.nn as nn
from transformers import AutoModel, AutoTokenizer
import warnings
warnings.filterwarnings('ignore')

print("[⚙️] Loading INT8 Quantized Transformer Encoder...")
tokenizer = AutoTokenizer.from_pretrained("prajjwal1/bert-tiny")
transformer_encoder = AutoModel.from_pretrained("prajjwal1/bert-tiny")

transformer_encoder = torch.quantization.quantize_dynamic(
    transformer_encoder, {nn.Linear}, dtype=torch.qint8
)
transformer_encoder.eval()

def generate_latent_vector(payload: str):
    """ Converts raw live bytes/strings into a 128-dim embedding space via INT8 Transformer """
    inputs = tokenizer(payload, return_tensors="pt", truncation=True, max_length=128, padding='max_length')
    with torch.no_grad():
        outputs = transformer_encoder(**inputs)
    vector = outputs.last_hidden_state.mean(dim=1).squeeze().numpy()
    return vector.reshape(1, -1)

app = FastAPI(title="Bayezid ML Sniper - Persistent Hybrid Engine")

MODEL_FILE = 'bayezid_model.pkl'
DATA_FILE = 'normal_traffic.npy'
MALICIOUS_FILE = 'malicious_traffic.npy'

print("\n[🧠] Initializing Neural ML Engine...")

if os.path.exists(MODEL_FILE) and os.path.exists(DATA_FILE):
    temp_traffic = np.load(DATA_FILE)
    if temp_traffic.shape[1] != 128:
        print("[⚡] Dimension change detected (4->128). Purging legacy baseline.")
        os.remove(MODEL_FILE)
        os.remove(DATA_FILE)
        raise FileNotFoundError
    normal_traffic = np.load(DATA_FILE)
    clf = joblib.load(MODEL_FILE)
    if normal_traffic.shape[1] != 128:
        print("[⚠️] Dimension mismatch detected. Forcing re-initialization of baseline.")
        raise FileNotFoundError
    print(f"[💾] Memory Loaded: Recovered {len(normal_traffic)} baseline patterns.")
else:
    print("[🌱] Generating initial baseline samples...")
    np.random.seed(42)
    normal_traffic = np.random.normal(loc=0.0, scale=0.5, size=(500, 128))
    clf = IsolationForest(contamination=0.01, random_state=42)
    clf.fit(normal_traffic)
    np.save(DATA_FILE, normal_traffic)
    joblib.dump(clf, MODEL_FILE)
    print(f"[✔] Initial Model Trained and SAVED.")

if os.path.exists(MALICIOUS_FILE):
    malicious_traffic = np.load(MALICIOUS_FILE)
    print(f"[☠️] Swarm Memory Loaded: {len(malicious_traffic)} Zero-Day signatures.")
    if malicious_traffic.shape[1] != 128:
        print("[⚡] Swarm Memory dimension mismatch (4->128). Purging legacy signatures.")
        os.remove(MALICIOUS_FILE)
        malicious_traffic = np.empty((0, 128))
else:
    malicious_traffic = np.empty((0, 128))


def extract_features(payload: str):
    return generate_latent_vector(payload)
@app.post("/api/v1/ml/predict")
async def predict_anomaly(req: Request):
    data = await req.json()
    payload = data.get("payload", "")
    features = extract_features(payload)
    ui_projection = features[0][:4].tolist()
    if malicious_traffic.size > 0:
        distances = np.linalg.norm(malicious_traffic - features, axis=1)
        if np.any(distances < 1.5):
            print(f"\n[☠️] ML SWARM MATCH: Payload features align with assimilated Zero-Day!")
            return {
                "is_malicious": True,
                "confidence": 99.99,
                "engine": "ML-Swarm-Memory",
    "features_extracted": {
        "v0": float(ui_projection[0]),
        "v1": float(ui_projection[1]),
        "v2": float(ui_projection[2]),
        "v3": float(ui_projection[3])
    }
            }
            
    prediction = clf.predict(features) 
    score = clf.decision_function(features)[0] 
    is_anomaly = bool(prediction[0] == -1)
    
    confidence = float(abs(score) * 200) if is_anomaly else 0
    print(f"\n[🔍] ML Analyzing Payload: Latent Vector Projection complete (Dim: {features.shape[1]}).")
    print(f"[🧠] Verdict: {'☠️ ANOMALY' if is_anomaly else '✅ NORMAL'} (Score: {score:.3f})")

    return {
        "is_malicious": is_anomaly,
        "confidence": min(round(confidence, 2), 99.99),
        "engine": "IsolationForest-Anomaly",
    "features_extracted": {
        "v0": float(ui_projection[0]),
        "v1": float(ui_projection[1]),
        "v2": float(ui_projection[2]),
        "v3": float(ui_projection[3])
    }
    }

@app.post("/api/v1/ml/feedback")
async def update_model(req: Request):
    global normal_traffic, clf
    data = await req.json()
    new_payload = data.get("payload", "")
    if new_payload:
        new_features = extract_features(new_payload)
        if any(np.allclose(new_features, row, atol=1e-5) for row in normal_traffic):
            return {"status": "ignored", "message": "Pattern already known."}
        normal_traffic = np.vstack([normal_traffic, new_features])
        clf.fit(normal_traffic)
        np.save(DATA_FILE, normal_traffic)
        joblib.dump(clf, MODEL_FILE)
        print(f"\n[🔄] FEEDBACK RECEIVED: Normal traffic baseline expanded.")
        return {"status": "success", "message": "Model updated."}
    return {"status": "error", "message": "No payload"}

@app.post("/api/v1/ml/swarm_feedback")
async def swarm_update(req: Request):
    global malicious_traffic
    data = await req.json()
    payload = data.get("payload") 
    if payload:
        try:
            new_features = extract_features(payload)
            malicious_traffic = np.vstack([malicious_traffic, new_features]) if malicious_traffic.size else new_features
            np.save(MALICIOUS_FILE, malicious_traffic)
            print(f"\n[🐝] SWARM ASSIMILATION: ML Engine memorized new Zero-Day feature signature.")
            return {"status": "success", "message": "Zero-Day assimilated."}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    return {"status": "failed", "message": "No payload provided"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")