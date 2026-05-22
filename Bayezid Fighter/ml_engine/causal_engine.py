import pandas as pd
from pgmpy.models import BayesianNetwork
from pgmpy.inference import CausalInference
from pgmpy.estimators import PC
from fastapi import FastAPI, Request
import uvicorn
import warnings

warnings.filterwarnings('ignore')
app = FastAPI()

@app.post("/api/v1/causal/build-dag")
async def build_dag(req: Request):
    body = await req.json()
    events = body.get('events', [])
    if not events:
        return {"edges": [], "nodes": []}

    df = pd.DataFrame(events)
    # PC algorithm: constraint-based causal discovery
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

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="warning")
