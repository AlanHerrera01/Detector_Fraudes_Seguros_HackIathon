from pathlib import Path
from io import StringIO
from tempfile import NamedTemporaryFile
from datetime import datetime, timezone

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
    list_upload_batches,
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
    provider: str | None = None
    claim_id: str | None = None


SUPPORTED_AI_PROVIDERS = {
    "gemini",
    "google",
    # FUTURA IMPLEMENTACION:
    # "github",
    # "github_models",
    # "github-models",
    # "openai",
    # "openai_api",
    # "openai-api",
    # "gpt",
    # "chatgpt",
    # "local",
    # "local_fallback",
    # "fallback",
}


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
            uploaded_at = datetime.now(timezone.utc)
            batch_id = f"{uploaded_at.strftime('%Y%m%d%H%M%S')}_{Path(filename).stem or 'upload'}"
            upsert_claims(uploaded, source_filename=filename, upload_batch_id=batch_id, uploaded_at=uploaded_at)
        _CLAIMS_CACHE = score_claims(uploaded)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    storage = "postgresql" if _DB_READY else "memory"
    return {
        "message": "Dataset cargado y puntuado correctamente.",
        "storage": storage,
        "total_claims": int(len(_CLAIMS_CACHE)),
        "source_filename": filename,
        "uploaded_at": uploaded_at.isoformat() if _DB_READY else None,
        "active_dataset": "ultimo_csv_subido" if _DB_READY else "memoria",
    }


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
        "clasificacion_riesgo",
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
    critical = df["clasificacion_riesgo"].eq("critico") if "clasificacion_riesgo" in df.columns else df["score_riesgo"].ge(90)
    priority = df["nivel_riesgo"].isin(["rojo", "amarillo"])
    ahorro_potencial = float((df.loc[priority, "monto_reclamado"].fillna(0) * 0.12).sum())
    return {
        "total_siniestros": int(len(df)),
        "casos_rojos": int((df["nivel_riesgo"] == "rojo").sum()),
        "casos_amarillos": int((df["nivel_riesgo"] == "amarillo").sum()),
        "casos_verdes": int((df["nivel_riesgo"] == "verde").sum()),
        "casos_criticos": int(critical.sum()),
        "score_promedio": round(float(df["score_riesgo"].mean()), 2),
        "ahorro_potencial": round(ahorro_potencial, 2),
    }


@app.get("/model/metrics")
def get_model_metrics() -> dict:
    """Metricas sugeridas para evaluar modelo, reglas, anomalias y NLP."""
    return model_metrics(get_scored_claims())


def _report_scored_claims(
    upload_batch_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    provider: str | None = None,
) -> pd.DataFrame:
    source = load_claims_from_db(upload_batch_id) if _DB_READY else get_scored_claims()
    scored = score_claims(source)

    if date_from:
        start = pd.to_datetime(date_from, errors="coerce")
        if pd.notna(start):
            scored = scored[pd.to_datetime(scored["fecha_reporte"], errors="coerce") >= start]

    if date_to:
        end = pd.to_datetime(date_to, errors="coerce")
        if pd.notna(end):
            scored = scored[pd.to_datetime(scored["fecha_reporte"], errors="coerce") <= end]

    if provider:
        normalized_provider = provider.strip().lower()
        scored = scored[scored["beneficiario"].astype(str).str.lower() == normalized_provider]

    return scored


def _audit_report_df(
    limit: int = 500,
    upload_batch_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    provider: str | None = None,
) -> pd.DataFrame:
    if limit < 1 or limit > 5000:
        raise HTTPException(status_code=400, detail="El limite debe estar entre 1 y 5000.")

    df = _report_scored_claims(upload_batch_id, date_from, date_to, provider).sort_values("score_riesgo", ascending=False).head(limit).copy()
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
            "clasificacion_riesgo": df.get("clasificacion_riesgo", pd.Series([""] * len(df), index=df.index)),
            "codigos_alerta": df["alertas"].apply(lambda alerts: ", ".join(alert.get("code", "") for alert in alerts)),
            "senales_narrativa": df["senales_narrativa"].apply(lambda signals: ", ".join(signals)),
            "explicacion": df["explicacion"],
            "nota_etica": "Alerta para revision humana; no confirma fraude ni decide rechazos automaticamente.",
        }
    )
    return report


@app.get("/reports/audit")
def audit_report(
    limit: int = 500,
    upload_batch_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    provider: str | None = None,
) -> list[dict]:
    """Reporte JSON de auditoria para integraciones o revision del jurado."""
    return _audit_report_df(limit, upload_batch_id, date_from, date_to, provider).to_dict(orient="records")


@app.get("/reports/audit.csv")
def audit_report_csv(
    limit: int = 500,
    upload_batch_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    provider: str | None = None,
) -> StreamingResponse:
    """Reporte CSV descargable para auditoria."""
    output = StringIO()
    _audit_report_df(limit, upload_batch_id, date_from, date_to, provider).to_csv(output, index=False)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=fraudia_audit_report.csv"},
    )


@app.get("/reports/audit.pdf")
def audit_report_pdf(
    limit: int = 500,
    upload_batch_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    provider: str | None = None,
) -> StreamingResponse:
    """Reporte PDF descargable para comite o auditoria."""
    report = _audit_report_df(limit, upload_batch_id, date_from, date_to, provider)
    pdf = _build_simple_pdf(report)
    return StreamingResponse(
        iter([pdf]),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=fraudia_audit_report.pdf"},
    )


@app.get("/reports/filters")
def report_filters() -> dict:
    """Opciones para filtrar reportes desde el frontend."""
    df = load_claims_from_db() if _DB_READY else get_scored_claims()
    return {
        "uploads": list_upload_batches() if _DB_READY else [],
        "providers": sorted(df["beneficiario"].dropna().astype(str).unique().tolist()),
        "date_min": pd.to_datetime(df["fecha_reporte"], errors="coerce").min().date().isoformat() if len(df) else None,
        "date_max": pd.to_datetime(df["fecha_reporte"], errors="coerce").max().date().isoformat() if len(df) else None,
    }


def _build_simple_pdf(report: pd.DataFrame) -> bytes:
    total = len(report)
    red = int((report["nivel_riesgo"] == "rojo").sum()) if total else 0
    yellow = int((report["nivel_riesgo"] == "amarillo").sum()) if total else 0
    green = int((report["nivel_riesgo"] == "verde").sum()) if total else 0
    avg_score = round(float(report["score_riesgo"].mean()), 2) if total else 0
    alert_counts: dict[str, int] = {}
    for value in report.get("codigos_alerta", pd.Series(dtype=str)).fillna(""):
        for code in str(value).split(","):
            clean = code.strip()
            if clean:
                alert_counts[clean] = alert_counts.get(clean, 0) + 1
    top_alerts = sorted(alert_counts.items(), key=lambda item: item[1], reverse=True)[:10]

    lines = [
        "FraudIA - Reporte de auditoria",
        f"Generado: {datetime.now(timezone.utc).astimezone().strftime('%Y-%m-%d %H:%M')}",
        "Alerta para revision humana; no confirma fraude ni decide rechazos automaticamente.",
        "",
        "Resumen ejecutivo",
        f"- Registros incluidos: {total}",
        f"- Score promedio: {avg_score}",
        f"- Semaforo: {red} rojo | {yellow} amarillo | {green} verde",
        f"- Casos prioritarios: {red + yellow}",
        "",
        "Tipos de alertas mas frecuentes",
    ]
    if top_alerts:
        for code, count in top_alerts:
            lines.append(f"- {code}: {count} caso(s) - {_alert_description(code)}")
    else:
        lines.append("- Sin alertas activadas en el filtro seleccionado.")
    lines.extend(["", "Casos prioritarios"])
    for _, row in report.head(60).iterrows():
        if row.get("nivel_riesgo") == "verde" and len(report) > 12:
            continue
        lines.extend(
            [
                f"{row.get('id_siniestro')} | {str(row.get('nivel_riesgo')).upper()} | score {row.get('score_riesgo')} | {row.get('beneficiario')}",
                f"Cobertura/ciudad: {row.get('cobertura')} - {row.get('ciudad')} | Monto: {row.get('monto_reclamado')}",
                f"Alertas: {str(row.get('codigos_alerta') or 'Sin alertas')[:105]}",
                f"Lectura: {str(row.get('explicacion') or '')[:125]}",
                "",
            ]
        )
    lines.extend(
        [
            "Notas de lectura",
            "- Rojo: requiere revision especializada y validacion documental prioritaria.",
            "- Amarillo: requiere revision dirigida antes de cierre operativo.",
            "- Verde: flujo normal salvo que auditoria solicite validacion adicional.",
            "- Este reporte orienta priorizacion; no confirma fraude ni recomienda rechazo automatico.",
        ]
    )
    return _pdf_from_lines(lines)


def _alert_description(code: str) -> str:
    descriptions = {
        "RF-01": "perdida total por robo",
        "RF-02": "documentos inconsistentes",
        "RF-03": "proveedor en lista restrictiva",
        "RF-04": "dinamica sospechosa",
        "RF-05": "borde extremo de vigencia",
        "RF-06": "demora en denuncia por robo",
        "S-01": "borde cercano de vigencia",
        "S-02": "reporte tardio",
        "S-03": "frecuencia del asegurado",
        "S-04": "frecuencia del vehiculo",
        "S-05": "reclamos solo RC recurrentes",
        "S-06": "proveedor recurrente",
        "S-07": "documentos incompletos",
        "S-08": "sin tercero identificado",
        "S-09": "monto cercano a suma asegurada",
        "S-10": "frecuencia del conductor",
        "NLP-01": "narrativa inconsistente",
        "NLP-02": "narrativa poco detallada",
        "NLP-03": "narrativa de alto riesgo",
    }
    return descriptions.get(code, "senal de revision")


def _pdf_from_lines(lines: list[str]) -> bytes:
    escaped_lines = [_pdf_escape(line) for line in lines]
    pages = [escaped_lines[i : i + 42] for i in range(0, len(escaped_lines), 42)] or [[]]
    objects: list[bytes] = []
    page_ids: list[int] = []

    def add_object(content: bytes) -> int:
        objects.append(content)
        return len(objects)

    catalog_id = add_object(b"<< /Type /Catalog /Pages 2 0 R >>")
    pages_id = add_object(b"")
    font_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for page_lines in pages:
        content_lines = ["BT", "/F1 10 Tf", "50 790 Td", "14 TL"]
        for line in page_lines:
            content_lines.append(f"({line}) Tj")
            content_lines.append("T*")
        content_lines.append("ET")
        stream = "\n".join(content_lines).encode("latin-1", errors="replace")
        content_id = add_object(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
        page_id = add_object(
            f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>".encode()
        )
        page_ids.append(page_id)

    objects[pages_id - 1] = f"<< /Type /Pages /Kids [{' '.join(f'{page_id} 0 R' for page_id in page_ids)}] /Count {len(page_ids)} >>".encode()

    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, content in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode())
        output.extend(content)
        output.extend(b"\nendobj\n")
    xref_offset = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    output.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref_offset}\n%%EOF".encode())
    return bytes(output)


def _pdf_escape(text: str) -> str:
    return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


@app.post("/agent/query")
def agent_query(payload: AgentQuery) -> dict:
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacia.")
    if payload.provider and payload.provider.strip().lower() not in SUPPORTED_AI_PROVIDERS:
        raise HTTPException(status_code=400, detail="Proveedor de IA no soportado. Usa gemini.")
    return answer_question(payload.question, get_scored_claims(), payload.provider, payload.claim_id)
