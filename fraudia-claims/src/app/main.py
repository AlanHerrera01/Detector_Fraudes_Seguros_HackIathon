from pathlib import Path
from io import StringIO
from tempfile import NamedTemporaryFile

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.ai_agent.claims_agent import answer_question
from src.explainability.explain_score import build_executive_explanation
from src.features.scoring import score_claims
from src.features.text_analysis import narrative_signals
from src.ingestion.load_data import DEFAULT_DATA_PATH, load_claims
from src.models.metrics import model_metrics
from src.db.postgres import (
    database_status,
    db_enabled,
    initialize_database,
    load_claims_from_db,
    upsert_claims,
)

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
_DB_READY = False
_DB_STARTUP_ERROR: str | None = None


class AgentQuery(BaseModel):
    question: str


@app.on_event("startup")
def startup() -> None:
    global _DB_READY, _DB_STARTUP_ERROR
    if db_enabled():
        try:
            initialize_database(DEFAULT_DATA_PATH)
            _DB_READY = True
            _DB_STARTUP_ERROR = None
        except Exception as exc:
            _DB_READY = False
            _DB_STARTUP_ERROR = str(exc)


def get_scored_claims() -> pd.DataFrame:
    """Obtiene datos puntuados y los cachea para que la demo responda rapido."""
    global _CLAIMS_CACHE
    if _CLAIMS_CACHE is None:
        source = load_claims_from_db() if _DB_READY else load_claims(DEFAULT_DATA_PATH)
        _CLAIMS_CACHE = score_claims(source)
    return _CLAIMS_CACHE.copy()


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "fraudia-claims",
        "storage": "postgresql" if _DB_READY else "csv",
        "db_error": _DB_STARTUP_ERROR,
    }


@app.get("/db/status")
def db_status() -> dict:
    status = database_status()
    if _DB_STARTUP_ERROR and not _DB_READY:
        status["startup_error"] = _DB_STARTUP_ERROR
        status["fallback_storage"] = "csv"
    return status


@app.post("/db/init")
def db_init() -> dict:
    global _DB_READY, _DB_STARTUP_ERROR, _CLAIMS_CACHE
    try:
        result = initialize_database(DEFAULT_DATA_PATH)
    except Exception as exc:
        _DB_READY = False
        _DB_STARTUP_ERROR = str(exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    _DB_READY = True
    _DB_STARTUP_ERROR = None
    _CLAIMS_CACHE = None
    return {"message": "Base PostgreSQL inicializada.", **result}


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
        uploaded = load_claims(tmp_path)
        if _DB_READY:
            upsert_claims(uploaded)
            uploaded = load_claims_from_db()
        _CLAIMS_CACHE = score_claims(uploaded)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    storage = "postgresql" if _DB_READY else "memory"
    return {"message": "Dataset cargado y puntuado correctamente.", "storage": storage, "total_claims": int(len(_CLAIMS_CACHE))}


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
        "ramo",
        "cobertura",
        "fecha_ocurrencia",
        "fecha_reporte",
        "monto_reclamado",
        "beneficiario",
        "score_riesgo",
        "nivel_riesgo",
        "alertas",
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


@app.get("/model/metrics")
def get_model_metrics() -> dict:
    """Metricas sugeridas para evaluar modelo, reglas, anomalias y NLP."""
    return model_metrics(get_scored_claims())


def _audit_report_df(limit: int = 500) -> pd.DataFrame:
    if limit < 1 or limit > 5000:
        raise HTTPException(status_code=400, detail="El limite debe estar entre 1 y 5000.")

    df = get_scored_claims().sort_values("score_riesgo", ascending=False).head(limit).copy()
    report = pd.DataFrame(
        {
            "id_siniestro": df["id_siniestro"],
            "id_poliza": df["id_poliza"],
            "id_asegurado": df["id_asegurado"],
            "beneficiario": df["beneficiario"],
            "ciudad": df["ciudad"],
            "cobertura": df["cobertura"],
            "monto_reclamado": df["monto_reclamado"],
            "score_riesgo": df["score_riesgo"],
            "nivel_riesgo": df["nivel_riesgo"],
            "codigos_alerta": df["alertas"].apply(lambda alerts: ", ".join(alert.get("code", "") for alert in alerts)),
            "senales_narrativa": df["senales_narrativa"].apply(lambda signals: ", ".join(signals)),
            "explicacion": df["explicacion"],
            "nota_etica": "Alerta para revision humana; no confirma fraude ni decide rechazos automaticamente.",
        }
    )
    return report


@app.get("/reports/audit")
def audit_report(limit: int = 500) -> list[dict]:
    """Reporte JSON de auditoria para integraciones o revision del jurado."""
    return _audit_report_df(limit).to_dict(orient="records")


@app.get("/reports/audit.csv")
def audit_report_csv(limit: int = 500) -> StreamingResponse:
    """Reporte CSV descargable para auditoria."""
    output = StringIO()
    _audit_report_df(limit).to_csv(output, index=False)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=fraudia_audit_report.csv"},
    )


@app.post("/agent/query")
def agent_query(payload: AgentQuery) -> dict:
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacia.")
    return answer_question(payload.question, get_scored_claims())
