import warnings
warnings.filterwarnings('ignore')
import pandas as pd
from pgmpy.models import BayesianNetwork
from pgmpy.inference import CausalInference
from pgmpy.estimators import PC
from fastapi import FastAPI, Request
import uvicorn
app = FastAPI()
@app.post("/api/v1/causal/build-dag")
async def build_dag(req: Request):
    body = await req.json()
    events = body.get('events', [])
    if not events:
        return {"edges": [], "nodes": []}
    df = pd.DataFrame(events)
    pc = PC(data=df)
    dag = pc.estimate(ci_test='chi_square', significance_level=0.05)
    edges = list(dag.edges())
    nodes = list(dag.nodes())
    return {"edges": edges, "nodes": nodes}
@app.post("/api/v1/causal/do-calculus")
async def do_calc(req: Request):
    body = await req.json()
    dag_edges = body.get('dag_edges', [])
    intervention = body.get('intervention', {})
    query_var = body.get('query_var')
    if not dag_edges or not query_var or not intervention:
        return {"error": "Missing parameters"}
    model = BayesianNetwork(dag_edges)
    ci = CausalInference(model)
    try:
        result = ci.query(variables=[query_var],
                          do={intervention['var']: intervention['val']})
        return {"distribution": result.values.tolist(), "states": result.state_names}
    except Exception as e:
        return {"error": str(e)}
@app.post("/api/v1/causal/verify-action")
async def verify_action(req: Request):
    body = await req.json()
    action_type = body.get('action_type', 'UNKNOWN')
    target_node = body.get('target_node', '')
    events = body.get('service_dependency_events', [])
    if not events or len(events) < 2:
        return {"safe": True, "downtime_risk": 0.1, "affected_services": [],
                "recommendation": "PROCEED", "confidence": "LOW",
                "reason": "Insufficient dependency data for causal analysis"}
    df = pd.DataFrame(events)
    required_cols = ['node', 'is_critical']
    for col in required_cols:
        if col not in df.columns:
            df[col] = 0
    try:
        critical_nodes = df[df['is_critical'] == 1]['node'].tolist()
        target_is_critical = target_node in critical_nodes
        critical_dependents = len(critical_nodes)
        if action_type == 'ISOLATE_NODE' and target_is_critical:
            downtime_risk = min(0.95, 0.6 + 0.1 * critical_dependents)
        elif action_type == 'ISOLATE_NODE' and not target_is_critical:
            downtime_risk = min(0.40, 0.1 * critical_dependents)
        elif action_type == 'BLOCK_IP':
            downtime_risk = 0.05 if not target_is_critical else 0.20
        elif action_type == 'ROTATE_TOKENS':
            downtime_risk = 0.15  
        else:
            downtime_risk = 0.10
        safe = downtime_risk < 0.30
        recommendation = "PROCEED" if safe else "DOWNGRADE_TO_DECEPTIVE_PROBE"
        affected = critical_nodes if not safe else []
        return {
            "safe": safe,
            "downtime_risk": round(downtime_risk, 3),
            "affected_services": affected,
            "recommendation": recommendation,
            "confidence": "HIGH",
            "action_type": action_type,
            "target_node": target_node
        }
    except Exception as e:
        return {"safe": True, "downtime_risk": 0.0, "error": str(e),
                "recommendation": "PROCEED", "confidence": "ERROR"}
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="warning")
