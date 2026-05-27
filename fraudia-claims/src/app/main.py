from pathlib import Path
from tempfile import NamedTemporaryFile

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

from src.ai_agent.claims_agent import answer_question
from src.features.scoring import score_claims
from src.ingestion.load_data import DEFAULT_DATA_PATH, load_claims

app = FastAPI(
    title="FraudIA Claims API",
    description="Backend para detectar alertas de posible fraude en siniestros, con score explicable y agente IA.",
    version="0.1.0",
)

_CLAIMS_CACHE: pd.DataFrame | None = None


class AgentQuery(BaseModel):
    question: str


def get_scored_claims() -> pd.DataFrame:
    global _CLAIMS_CACHE
    if _CLAIMS_CACHE is None:
        _CLAIMS_CACHE = score_claims(load_claims(DEFAULT_DATA_PATH))
    return _CLAIMS_CACHE.copy()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "fraudia-claims"}


@app.post("/claims/upload")
async def upload_claims(file: UploadFile = File(...)) -> dict:
    global _CLAIMS_CACHE
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos CSV.")

    content = await file.read()
    with NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        _CLAIMS_CACHE = score_claims(load_claims(tmp_path))
    finally:
        tmp_path.unlink(missing_ok=True)

    return {"message": "Dataset cargado y puntuado correctamente.", "total_claims": int(len(_CLAIMS_CACHE))}


@app.get("/claims")
def list_claims(limit: int = 50) -> list[dict]:
    df = get_scored_claims().sort_values("score_riesgo", ascending=False).head(limit)
    columns = ["id_siniestro", "id_poliza", "id_asegurado", "ciudad", "cobertura", "beneficiario", "score_riesgo", "nivel_riesgo", "explicacion"]
    return df[columns].to_dict(orient="records")


@app.get("/claims/{id_siniestro}")
def get_claim(id_siniestro: str) -> dict:
    df = get_scored_claims()
    match = df[df["id_siniestro"].astype(str) == id_siniestro]
    if match.empty:
        raise HTTPException(status_code=404, detail="Siniestro no encontrado.")
    return match.iloc[0].to_dict()


@app.post("/claims/{id_siniestro}/score")
def score_claim(id_siniestro: str) -> dict:
    return get_claim(id_siniestro)


@app.get("/alerts/top")
def top_alerts(limit: int = 10) -> list[dict]:
    df = get_scored_claims().sort_values("score_riesgo", ascending=False).head(limit)
    return df[["id_siniestro", "score_riesgo", "nivel_riesgo", "alertas", "explicacion"]].to_dict(orient="records")


@app.get("/providers/ranking")
def providers_ranking() -> list[dict]:
    df = get_scored_claims()
    ranking = (
        df.groupby("beneficiario")
        .agg(
            total_casos=("id_siniestro", "count"),
            alertas_rojas=("nivel_riesgo", lambda s: int((s == "rojo").sum())),
            score_promedio=("score_riesgo", "mean"),
        )
        .sort_values(["alertas_rojas", "score_promedio"], ascending=False)
        .reset_index()
    )
    ranking["score_promedio"] = ranking["score_promedio"].round(2)
    return ranking.to_dict(orient="records")


@app.get("/stats/summary")
def stats_summary() -> dict:
    df = get_scored_claims()
    return {
        "total_siniestros": int(len(df)),
        "casos_rojos": int((df["nivel_riesgo"] == "rojo").sum()),
        "casos_amarillos": int((df["nivel_riesgo"] == "amarillo").sum()),
        "casos_verdes": int((df["nivel_riesgo"] == "verde").sum()),
        "score_promedio": round(float(df["score_riesgo"].mean()), 2),
    }


@app.post("/agent/query")
def agent_query(payload: AgentQuery) -> dict:
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacia.")
    return answer_question(payload.question, get_scored_claims())
