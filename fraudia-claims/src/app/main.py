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
from src.ingestion.local_history import append_local_upload, load_active_claims_from_csv, load_claims_history_from_csv
from src.models.metrics import model_metrics
from src.db.postgres import (
    database_status,
    db_enabled,
    initialize_database,
    list_upload_batches,
    load_claims_history_from_db,
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
        if _DB_READY:
            active_source = load_claims_from_db()
            training_source = load_claims_history_from_db()
        else:
            active_source = load_active_claims_from_csv()
            training_source = load_claims_history_from_csv()
        _CLAIMS_CACHE = score_claims(active_source, training_source)
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
    """Permite cargar CSV/Excel estructurado o PDF como soporte narrativo.

    El CSV/Excel recalcula scores masivos. El PDF se analiza como documento de
    apoyo: extrae texto y devuelve senales narrativas sin reemplazar el dataset
    tabular.
    """
    global _CLAIMS_CACHE
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    if extension not in {".csv", ".xlsx", ".xls", ".pdf"}:
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos CSV, Excel o PDF.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="El archivo esta vacio.")

    if extension == ".pdf":
        text = _extract_pdf_text(content)
        signals = narrative_signals(text)
        return {
            "message": "PDF analizado como soporte documental. Para recalcular scores masivos carga un CSV o Excel.",
            "document_type": "pdf",
            "filename": filename,
            "text_preview": text[:800],
            "signals": signals,
        }

    with NamedTemporaryFile(delete=False, suffix=extension) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        uploaded = load_claims(tmp_path)
        if _DB_READY:
            uploaded_at = datetime.now(timezone.utc)
            batch_id = f"{uploaded_at.strftime('%Y%m%d%H%M%S')}_{Path(filename).stem or 'upload'}"
            upsert_claims(uploaded, source_filename=filename, upload_batch_id=batch_id, uploaded_at=uploaded_at)
            training_source = load_claims_history_from_db()
        else:
            uploaded_at = datetime.now(timezone.utc)
            append_local_upload(uploaded)
            training_source = load_claims_history_from_csv()
        _CLAIMS_CACHE = score_claims(uploaded, training_source)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except PermissionError:
            pass

    storage = "postgresql" if _DB_READY else "memory"
    return {
        "message": "Dataset cargado y puntuado correctamente.",
        "storage": storage,
        "uploaded_claims": int(len(uploaded)),
        "visible_claims": int(len(_CLAIMS_CACHE)),
        "training_claims": int(len(training_source)),
        "total_claims": int(len(_CLAIMS_CACHE)),
        "source_filename": filename,
        "uploaded_at": uploaded_at.isoformat() if _DB_READY else None,
        "active_dataset": "historico_postgresql" if _DB_READY else "historico_csv_local",
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
    alert_count = df["alertas"].apply(len) if "alertas" in df.columns else pd.Series([0] * len(df))
    ahorro_potencial = float((df.loc[priority, "monto_reclamado"].fillna(0) * 0.12).sum())
    return {
        "total_siniestros": int(len(df)),
        "casos_rojos": int((df["nivel_riesgo"] == "rojo").sum()),
        "casos_amarillos": int((df["nivel_riesgo"] == "amarillo").sum()),
        "casos_verdes": int((df["nivel_riesgo"] == "verde").sum()),
        "casos_criticos": int(critical.sum()),
        "casos_con_alertas": int((alert_count > 0).sum()),
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
    scored = source.copy() if "score_riesgo" in source.columns else score_claims(source)

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
    priority = red + yellow
    total_amount = float(report["monto_reclamado"].fillna(0).sum()) if total else 0
    alert_counts: dict[str, int] = {}
    for value in report.get("codigos_alerta", pd.Series(dtype=str)).fillna(""):
        for code in str(value).split(","):
            clean = code.strip()
            if clean:
                alert_counts[clean] = alert_counts.get(clean, 0) + 1
    top_alerts = sorted(alert_counts.items(), key=lambda item: item[1], reverse=True)[:8]

    pdf = _AuditPdf()
    generated_at = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M")
    pdf.hero("FraudIA", "Reporte ejecutivo de auditoria", generated_at)
    pdf.notice("Alerta para revision humana. No confirma fraude ni decide rechazos automaticamente.")

    pdf.section("Resumen ejecutivo")
    pdf.metric_cards(
        [
            ("Registros", str(total), "Siniestros incluidos"),
            ("Score promedio", str(avg_score), "Riesgo consolidado"),
            ("Prioritarios", str(priority), "Rojo + amarillo"),
            ("Monto auditado", _money(total_amount), "Valor reclamado"),
        ]
    )
    pdf.risk_strip(red, yellow, green)

    pdf.section("Alertas mas frecuentes")
    if top_alerts:
        max_count = max(count for _, count in top_alerts) or 1
        for code, count in top_alerts:
            pdf.alert_row(code, _alert_description(code), count, max_count)
    else:
        pdf.paragraph("Sin alertas activadas en el filtro seleccionado.", color=(90, 100, 116))

    pdf.section("Casos prioritarios")
    priority_rows = report[report["nivel_riesgo"].isin(["rojo", "amarillo"])].head(12)
    if priority_rows.empty:
        priority_rows = report.head(6)
    if priority_rows.empty:
        pdf.paragraph("No hay registros para mostrar con los filtros seleccionados.", color=(90, 100, 116))
    else:
        for _, row in priority_rows.iterrows():
            pdf.case_card(row)

    pdf.section("Notas de lectura")
    notes = [
        "Rojo: requiere revision especializada y validacion documental prioritaria.",
        "Amarillo: requiere revision dirigida antes de cierre operativo.",
        "Verde: flujo normal salvo que auditoria solicite validacion adicional.",
        "El reporte orienta priorizacion; la decision final debe ser humana y trazable.",
    ]
    for note in notes:
        pdf.bullet(note)

    return pdf.render()


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


class _AuditPdf:
    width = 612
    height = 792
    margin = 42
    bottom = 42

    def __init__(self) -> None:
        self.pages: list[list[str]] = []
        self.y = 0
        self._new_page()

    def hero(self, brand: str, title: str, generated_at: str) -> None:
        self.rect(0, 702, self.width, 90, fill=(15, 23, 42))
        self.rect(0, 702, 12, 90, fill=(20, 184, 166))
        self.text(self.margin, 752, brand, size=24, font="F2", color=(255, 255, 255))
        self.text(self.margin, 730, title, size=15, font="F2", color=(204, 251, 241))
        self.text(430, 752, "Generado", size=9, font="F2", color=(148, 163, 184))
        self.text(430, 735, generated_at, size=11, font="F1", color=(255, 255, 255))
        self.y = 674

    def notice(self, text: str) -> None:
        self.ensure(42)
        self.rect(self.margin, self.y - 26, self.width - (self.margin * 2), 34, fill=(236, 253, 245), stroke=(153, 246, 228))
        self.text(self.margin + 12, self.y - 7, text, size=9.5, font="F2", color=(15, 118, 110))
        self.y -= 50

    def section(self, title: str) -> None:
        self.ensure(45)
        self.text(self.margin, self.y, title, size=15, font="F2", color=(15, 23, 42))
        self.rect(self.margin, self.y - 9, 80, 2, fill=(20, 184, 166))
        self.y -= 28

    def metric_cards(self, cards: list[tuple[str, str, str]]) -> None:
        self.ensure(88)
        gap = 10
        card_width = (self.width - (self.margin * 2) - (gap * 3)) / 4
        x = self.margin
        for label, value, caption in cards:
            self.rect(x, self.y - 62, card_width, 66, fill=(248, 250, 252), stroke=(226, 232, 240))
            self.text(x + 10, self.y - 14, label.upper(), size=7.5, font="F2", color=(100, 116, 139))
            self.text(x + 10, self.y - 36, value, size=16, font="F2", color=(15, 23, 42))
            self.text(x + 10, self.y - 53, caption, size=8, font="F1", color=(100, 116, 139))
            x += card_width + gap
        self.y -= 86

    def risk_strip(self, red: int, yellow: int, green: int) -> None:
        total = max(red + yellow + green, 1)
        self.ensure(46)
        x = self.margin
        y = self.y - 20
        width = self.width - (self.margin * 2)
        self.text(x, self.y, "Distribucion del semaforo", size=10, font="F2", color=(51, 65, 85))
        cursor = x
        for count, color in [(red, (220, 38, 38)), (yellow, (245, 158, 11)), (green, (22, 163, 74))]:
            segment = width * (count / total)
            if segment > 0:
                self.rect(cursor, y, max(segment, 2), 13, fill=color)
                cursor += segment
        self.text(x, y - 14, f"{red} rojo   |   {yellow} amarillo   |   {green} verde", size=8.5, color=(71, 85, 105))
        self.y -= 52

    def alert_row(self, code: str, description: str, count: int, max_count: int) -> None:
        self.ensure(30)
        bar_width = 230 * (count / max_count)
        self.text(self.margin, self.y, f"{code}", size=9.5, font="F2", color=(15, 23, 42))
        self.text(self.margin + 48, self.y, description, size=9, color=(51, 65, 85))
        self.rect(self.margin + 285, self.y - 8, 230, 8, fill=(226, 232, 240))
        self.rect(self.margin + 285, self.y - 8, bar_width, 8, fill=(20, 184, 166))
        self.text(self.margin + 525, self.y - 1, str(count), size=8.5, font="F2", color=(15, 23, 42))
        self.y -= 22

    def case_card(self, row) -> None:
        level = str(row.get("nivel_riesgo") or "").lower()
        accent = _risk_rgb(level)
        card_height = 116
        self.ensure(card_height + 16)
        x = self.margin
        y = self.y - card_height
        width = self.width - (self.margin * 2)
        self.rect(x, y, width, card_height, fill=(255, 255, 255), stroke=(226, 232, 240))
        self.rect(x, y, 7, card_height, fill=accent)
        self.text(x + 16, self.y - 20, str(row.get("id_siniestro")), size=12, font="F2", color=(15, 23, 42))
        self.badge(x + 110, self.y - 31, str(row.get("nivel_riesgo")).upper(), accent)
        self.text(x + 205, self.y - 20, f"Score {row.get('score_riesgo')}/100", size=10, font="F2", color=(15, 23, 42))
        self.text(x + 16, self.y - 43, f"Proveedor: {row.get('beneficiario')}", size=9, color=(51, 65, 85))
        self.text(x + 295, self.y - 43, f"Ciudad: {row.get('ciudad')}", size=9, color=(51, 65, 85))
        self.text(x + 16, self.y - 61, f"Cobertura: {row.get('cobertura')}", size=9, color=(51, 65, 85))
        self.text(x + 295, self.y - 61, f"Monto: {_money(row.get('monto_reclamado'))}", size=9, color=(51, 65, 85))
        alerts = str(row.get("codigos_alerta") or "Sin alertas")
        self.paragraph(f"Alertas: {alerts}", x=x + 16, width=width - 32, size=8.5, color=(71, 85, 105), line_gap=11, max_lines=2)
        self.y = y - 16

    def badge(self, x: float, y: float, label: str, color: tuple[int, int, int]) -> None:
        self.rect(x, y, 80, 18, fill=color)
        self.text(x + 8, y + 5, label, size=8, font="F2", color=(255, 255, 255))

    def bullet(self, text: str) -> None:
        self.ensure(25)
        self.text(self.margin, self.y, "-", size=10, font="F2", color=(20, 184, 166))
        used = self.paragraph(text, x=self.margin + 14, width=self.width - (self.margin * 2) - 14, size=9, color=(51, 65, 85), line_gap=13)
        self.y -= max(used, 16)

    def paragraph(
        self,
        text: str,
        x: float | None = None,
        width: float | None = None,
        size: float = 9,
        color: tuple[int, int, int] = (15, 23, 42),
        line_gap: float = 13,
        max_lines: int | None = None,
    ) -> float:
        x = self.margin if x is None else x
        width = self.width - (self.margin * 2) if width is None else width
        lines = _wrap_pdf_text(text, width, size)
        if max_lines is not None:
            lines = lines[:max_lines]
        start_y = self.y
        for line in lines:
            self.ensure(line_gap + 4)
            self.text(x, self.y, line, size=size, color=color)
            self.y -= line_gap
        return start_y - self.y

    def ensure(self, height: float) -> None:
        if self.y - height < self.bottom:
            self._new_page()

    def _new_page(self) -> None:
        self.pages.append([])
        self.y = 728
        self.rect(0, 0, self.width, self.height, fill=(255, 255, 255))
        self.rect(0, 764, self.width, 28, fill=(15, 23, 42))
        self.text(self.margin, 775, "FraudIA | Reporte de auditoria", size=9, font="F2", color=(255, 255, 255))
        self.text(520, 775, f"Pag. {len(self.pages)}", size=8, color=(203, 213, 225))

    def rect(
        self,
        x: float,
        y: float,
        width: float,
        height: float,
        fill: tuple[int, int, int] | None = None,
        stroke: tuple[int, int, int] | None = None,
    ) -> None:
        command = ["q"]
        if fill:
            command.append(f"{_rgb(fill)} rg")
        if stroke:
            command.append(f"{_rgb(stroke)} RG")
        command.append(f"{x:.2f} {y:.2f} {width:.2f} {height:.2f} re")
        command.append("B" if fill and stroke else "f" if fill else "S")
        command.append("Q")
        self.pages[-1].append("\n".join(command))

    def text(
        self,
        x: float,
        y: float,
        text: str,
        size: float = 10,
        font: str = "F1",
        color: tuple[int, int, int] = (0, 0, 0),
    ) -> None:
        escaped = _pdf_escape(text)
        self.pages[-1].append(f"BT\n{_rgb(color)} rg\n/{font} {size:.2f} Tf\n{x:.2f} {y:.2f} Td\n({escaped}) Tj\nET")

    def render(self) -> bytes:
        return _pdf_from_page_streams(self.pages)


def _pdf_from_page_streams(page_streams: list[list[str]]) -> bytes:
    objects: list[bytes] = []
    page_ids: list[int] = []

    def add_object(content: bytes) -> int:
        objects.append(content)
        return len(objects)

    catalog_id = add_object(b"<< /Type /Catalog /Pages 2 0 R >>")
    pages_id = add_object(b"")
    font_regular_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    font_bold_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    for stream_lines in page_streams:
        stream = "\n".join(stream_lines).encode("latin-1", errors="replace")
        content_id = add_object(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
        page_id = add_object(
            f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {font_regular_id} 0 R /F2 {font_bold_id} 0 R >> >> /Contents {content_id} 0 R >>".encode()
        )
        page_ids.append(page_id)

    objects[pages_id - 1] = f"<< /Type /Pages /Kids [{' '.join(f'{page_id} 0 R' for page_id in page_ids)}] /Count {len(page_ids)} >>".encode()
    return _serialize_pdf_objects(objects, catalog_id)


def _serialize_pdf_objects(objects: list[bytes], catalog_id: int) -> bytes:
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


def _wrap_pdf_text(text: str, width: float, size: float) -> list[str]:
    max_chars = max(18, int(width / (size * 0.52)))
    words = str(text).split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word[:max_chars]
    if current:
        lines.append(current)
    return lines or [""]


def _rgb(color: tuple[int, int, int]) -> str:
    return " ".join(f"{component / 255:.3f}" for component in color)


def _risk_rgb(level: str) -> tuple[int, int, int]:
    if level == "rojo":
        return (220, 38, 38)
    if level == "amarillo":
        return (245, 158, 11)
    return (22, 163, 74)


def _money(value) -> str:
    try:
        return f"${float(value):,.0f}"
    except (TypeError, ValueError):
        return "$0"


def _pdf_escape(text: str) -> str:
    return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


@app.post("/agent/query")
def agent_query(payload: AgentQuery) -> dict:
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacia.")
    if payload.provider and payload.provider.strip().lower() not in SUPPORTED_AI_PROVIDERS:
        raise HTTPException(status_code=400, detail="Proveedor de IA no soportado. Usa gemini.")
    return answer_question(payload.question, get_scored_claims(), payload.provider, payload.claim_id)
