from pathlib import Path
from tempfile import NamedTemporaryFile

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.ai_agent.claims_agent import answer_question
from src.explainability.explain_score import build_executive_explanation
from src.features.scoring import score_claims
from src.features.text_analysis import narrative_signals
from src.ingestion.load_data import DEFAULT_DATA_PATH, load_claims

app = FastAPI(
    title="FraudIA Claims API",
    description="Backend para detectar alertas de posible fraude en siniestros, con score explicable y agente IA.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_CLAIMS_CACHE: pd.DataFrame | None = None


class AgentQuery(BaseModel):
    question: str


def get_scored_claims() -> pd.DataFrame:
    """Obtiene datos puntuados y los cachea para que la demo responda rapido."""
    global _CLAIMS_CACHE
    if _CLAIMS_CACHE is None:
        _CLAIMS_CACHE = score_claims(load_claims(DEFAULT_DATA_PATH))
    return _CLAIMS_CACHE.copy()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "fraudia-claims"}


@app.post("/claims/upload")
async def upload_claims(file: UploadFile = File(...)) -> dict:
    """Permite cargar CSV estructurado o PDF como soporte narrativo.

    El CSV recalcula scores masivos. El PDF se analiza como documento de apoyo:
    extrae texto y devuelve senales narrativas sin reemplazar el dataset tabular.
    """
    global _CLAIMS_CACHE
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    if extension not in {".csv", ".pdf"}:
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos CSV o PDF.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="El archivo esta vacio.")

    if extension == ".pdf":
        text = _extract_pdf_text(content)
        signals = narrative_signals(text)
        return {
            "message": "PDF analizado como soporte documental. Para recalcular scores masivos carga un CSV.",
            "document_type": "pdf",
            "filename": filename,
            "text_preview": text[:800],
            "signals": signals,
        }

    with NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        _CLAIMS_CACHE = score_claims(load_claims(tmp_path))
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    return {"message": "Dataset cargado y puntuado correctamente.", "total_claims": int(len(_CLAIMS_CACHE))}


def _extract_pdf_text(content: bytes) -> str:
    try:
        from io import BytesIO

        from pypdf import PdfReader

        reader = PdfReader(BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"No fue posible leer el PDF: {exc}") from exc

    if not text.strip():
        raise HTTPException(status_code=400, detail="El PDF no contiene texto extraible.")
    return text.strip()


@app.get("/claims")
def list_claims(limit: int = 50) -> list[dict]:
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="El limite debe estar entre 1 y 500.")
    df = get_scored_claims().sort_values("score_riesgo", ascending=False).head(limit)
    columns = [
        "id_siniestro",
        "id_poliza",
        "id_asegurado",
        "ciudad",
        "cobertura",
        "beneficiario",
        "score_riesgo",
        "nivel_riesgo",
        "senales_narrativa",
        "explicacion",
    ]
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


@app.get("/claims/{id_siniestro}/explanation")
def claim_explanation(id_siniestro: str) -> dict:
    return build_executive_explanation(get_claim(id_siniestro))


@app.get("/alerts/top")
def top_alerts(limit: int = 10) -> list[dict]:
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="El limite debe estar entre 1 y 100.")
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


@app.get("/networks/providers")
def provider_networks(limit: int = 10) -> list[dict]:
    """Resume concentraciones relacionales entre proveedor, asegurado y vehiculo."""
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="El limite debe estar entre 1 y 100.")

    df = get_scored_claims()
    network = (
        df.groupby("beneficiario")
        .agg(
            total_casos=("id_siniestro", "count"),
            asegurados_unicos=("id_asegurado", "nunique"),
            vehiculos_unicos=("id_vehiculo", "nunique"),
            ciudades_unicas=("ciudad", "nunique"),
            alertas_rojas=("nivel_riesgo", lambda s: int((s == "rojo").sum())),
            score_promedio=("score_riesgo", "mean"),
        )
        .reset_index()
    )
    network["score_promedio"] = network["score_promedio"].round(2)
    network["indice_concentracion"] = (
        network["total_casos"]
        + network["alertas_rojas"] * 2
        + network["asegurados_unicos"]
        + network["vehiculos_unicos"]
    )
    network = network.sort_values(["indice_concentracion", "score_promedio"], ascending=False).head(limit)
    return network.to_dict(orient="records")


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
