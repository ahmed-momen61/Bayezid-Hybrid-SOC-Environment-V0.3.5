import numpy as np
import httpx
from fastapi import FastAPI, Request

app = FastAPI(title="FGSM Evasion Engine")

# Mock feature extraction and reverse mapping for illustration
def extract_features(payload: str) -> list[float]:
    # In reality, this matches the defensive model's exact feature extraction
    return [
        float(len(payload)) / 1000.0,
        float(payload.count(';')) / 10.0,
        float(payload.count("'")) / 10.0,
        float(payload.count('exec')) / 5.0,
        float(payload.count('eval')) / 5.0
    ]

def features_to_payload(original_payload: str, features: np.ndarray) -> str:
    # This is a complex mapping problem. For simplicity, we inject 
    # obfuscating characters if features indicate we need to "lower" the signal
    perturbed = original_payload
    # Example heuristic: if feature 1 (semicolons) is forced down by gradient, replace with alternatives
    if features[1] < 0.1 and ';' in perturbed:
        # Not logically identical but simulates feature space translation
        pass

    # Simple obfuscation injection to simulate perturbation
    obfuscators = ['/*p*/', '""+""', 'chr(0)*0']
    injection_count = int(np.sum(features) * 2) % 3
    if injection_count > 0:
        perturbed = perturbed + obfuscators[injection_count]

    return perturbed

@app.post("/api/v1/fgsm/attack")
async def fgsm_attack(req: Request):
    body = await req.json()
    payload = body.get('payload', '')
    classifier_url = body.get('classifier_url', 'http://127.0.0.1:8001/api/v1/ml/classify') # default local path
    epsilon = float(body.get('epsilon', 0.01))
    max_iter = int(body.get('max_iter', 20))

    x = np.array(extract_features(payload), dtype=np.float32)

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(classifier_url, json={"payload": payload})
            data = r.json()
            orig_conf = data.get('confidence', 0.0)
            orig_malicious = data.get('is_malicious', True)

            if not orig_malicious:
                return {"status": "already_evading", "payload": payload}

            x_adv = x.copy()
            for iteration in range(max_iter):
                grad = np.zeros_like(x_adv)
                for i in range(len(x_adv)):
                    x_plus = x_adv.copy()
                    x_plus[i] += 1e-4

                    perturbed_payload = features_to_payload(payload, x_plus)
                    r_plus = await client.post(classifier_url, json={"payload": perturbed_payload})
                    loss_plus = r_plus.json().get('confidence', 0.0)

                    grad[i] = (loss_plus - orig_conf) / 1e-4

                # Move in direction that INCREASES loss (reduces confidence of maliciousness)
                x_adv = x_adv + epsilon * np.sign(grad)
                x_adv = np.clip(x_adv, 0, 1)

                evaded_payload = features_to_payload(payload, x_adv)
                r_check = await client.post(classifier_url, json={"payload": evaded_payload})

                if not r_check.json().get('is_malicious', True):
                    return {
                        "status": "evaded", 
                        "iterations": iteration+1,
                        "payload": evaded_payload,
                        "confidence_drop": orig_conf - r_check.json().get('confidence', 0.0)
                    }

            return {"status": "failed", "best_payload": features_to_payload(payload, x_adv)}

    except Exception as e:
        # Fallback if no local classifier is running
        return {
            "status": "heuristic_fallback",
            "payload": payload + "/*fgsm_fallback*/",
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8004)
