from pathlib import Path
import re
import unicodedata

import pandas as pd


DEFAULT_DATA_PATH = Path("data/synthetic/siniestros_sinteticos.csv")

REQUIRED_COLUMNS = {
    "id_siniestro",
    "id_poliza",
    "id_asegurado",
    "ramo",
    "cobertura",
    "fecha_ocurrencia",
    "fecha_reporte",
    "monto_reclamado",
    "descripcion",
}

HEADER_ALIASES = {
    "id_siniestro": "id_siniestro",
    "id_poliza": "id_poliza",
    "id_asegurado": "id_asegurado",
    "ramo": "ramo",
    "placa_vehiculo_asegurado": "id_vehiculo",
    "id_vehiculo": "id_vehiculo",
    "cobertura": "cobertura",
    "fecha_ocurrencia": "fecha_ocurrencia",
    "fecha_reporte": "fecha_reporte",
    "dias_ocurr_reporte": "dias_entre_ocurrencia_reporte",
    "dias_entre_ocurrencia_reporte": "dias_entre_ocurrencia_reporte",
    "monto_reclamado": "monto_reclamado",
    "monto_reclamado_": "monto_reclamado",
    "monto_estimado": "monto_estimado",
    "monto_estimado_": "monto_estimado",
    "monto_pagado": "monto_pagado",
    "monto_pagado_": "monto_pagado",
    "estado": "estado",
    "sucursal": "sucursal",
    "ciudad": "ciudad",
    "id_proveedor": "id_proveedor",
    "nombre_proveedor": "beneficiario",
    "beneficiario": "beneficiario",
    "descripcion_del_evento": "descripcion",
    "descripcion": "descripcion",
    "docs_completos": "documentos_completos",
    "documentos_completos": "documentos_completos",
    "documentos_inconsistentes": "documentos_inconsistentes",
    "prov_lista_restrictiva": "proveedor_en_lista_restrictiva",
    "en_lista_restrictiva": "proveedor_en_lista_restrictiva",
    "proveedor_en_lista_restrictiva": "proveedor_en_lista_restrictiva",
    "dias_desde_inicio_poliza": "dias_desde_inicio_poliza",
    "dias_hasta_fin_poliza": "dias_desde_fin_poliza",
    "dias_desde_fin_poliza": "dias_desde_fin_poliza",
    "n_reclamos_previos_asegurado": "historial_siniestros_asegurado",
    "historial_siniestros_asegurado": "historial_siniestros_asegurado",
    "historial_siniestros_vehiculo": "historial_siniestros_vehiculo",
    "n_siniestros_asociados": "casos_observados_proveedor",
    "casos_observados_proveedor": "casos_observados_proveedor",
    "suma_asegurada": "suma_asegurada",
    "suma_asegurada_": "suma_asegurada",
    "reclamos_rc_sin_tercero": "solo_rc",
    "solo_rc": "solo_rc",
    "tercero_identificado": "tercero_identificado",
    "dinamica_sospechosa": "dinamica_sospechosa",
    "etiqueta_fraude_simulada": "etiqueta_fraude_simulada",
}

DEFAULT_COLUMNS = {
    "id_vehiculo": "",
    "monto_estimado": 0,
    "monto_pagado": 0,
    "estado": "",
    "sucursal": "",
    "ciudad": "",
    "beneficiario": "",
    "documentos_completos": "si",
    "documentos_inconsistentes": "no",
    "proveedor_en_lista_restrictiva": "no",
    "dias_desde_inicio_poliza": 9999,
    "dias_desde_fin_poliza": 9999,
    "dias_entre_ocurrencia_reporte": 0,
    "historial_siniestros_asegurado": 0,
    "historial_siniestros_vehiculo": 0,
    "casos_observados_proveedor": 0,
    "suma_asegurada": 0,
    "solo_rc": "no",
    "tercero_identificado": "si",
    "dinamica_sospechosa": "no",
}


def load_claims(path: str | Path = DEFAULT_DATA_PATH) -> pd.DataFrame:
    """Carga siniestros desde CSV/Excel y valida el contrato minimo de columnas.

    La validacion temprana evita que el motor de reglas falle mas adelante con
    errores poco claros cuando el usuario sube un archivo incompleto.
    """
    dataset_path = Path(path)
    if not dataset_path.exists():
        raise FileNotFoundError(f"No existe el dataset: {dataset_path}")

    extension = dataset_path.suffix.lower()
    if extension == ".csv":
        df = pd.read_csv(dataset_path)
    elif extension in {".xlsx", ".xls"}:
        try:
            df = _read_claims_excel(dataset_path)
        except ImportError as exc:
            raise ValueError(
                "No se pudo leer Excel porque falta la dependencia openpyxl/xlrd. "
                "Instala requirements.txt o convierte el archivo a CSV."
            ) from exc
    else:
        raise ValueError("Formato no soportado. Usa CSV, XLSX o XLS.")

    df = _normalize_claim_columns(df)
    missing = REQUIRED_COLUMNS.difference(df.columns)
    if missing:
        raise ValueError(f"Faltan columnas requeridas: {sorted(missing)}")
    df = _ensure_pipeline_columns(df)

    # Las fechas invalidas se convierten en NaT para que pandas permita seguir
    # procesando y las reglas de negocio manejen el dato faltante.
    for column in ["fecha_ocurrencia", "fecha_reporte"]:
        df[column] = pd.to_datetime(df[column], errors="coerce")

    return df


def _read_claims_excel(path: Path) -> pd.DataFrame:
    with pd.ExcelFile(path) as workbook:
        sheet_names = workbook.sheet_names
        sheet_name = _pick_claims_sheet(workbook)
        claims = pd.read_excel(workbook, sheet_name=sheet_name)

        if "4_Proveedores" in sheet_names:
            providers = pd.read_excel(workbook, sheet_name="4_Proveedores")
            claims = _merge_provider_context(claims, providers)

    return claims


def _pick_claims_sheet(workbook: pd.ExcelFile) -> str:
    best_sheet = workbook.sheet_names[0]
    best_score = -1
    for sheet_name in workbook.sheet_names:
        headers = pd.read_excel(workbook, sheet_name=sheet_name, nrows=0).columns
        normalized_headers = {_alias_header(column) for column in headers}
        score = len(REQUIRED_COLUMNS.intersection(normalized_headers))
        if "siniestro" in _normalize_header(sheet_name):
            score += 2
        if score > best_score:
            best_sheet = sheet_name
            best_score = score

    if best_score <= 0:
        raise ValueError("No se encontro una hoja de siniestros con encabezados reconocibles.")
    return best_sheet


def _merge_provider_context(claims: pd.DataFrame, providers: pd.DataFrame) -> pd.DataFrame:
    claims = _normalize_claim_columns(claims)
    providers = _normalize_claim_columns(providers)
    if "id_proveedor" not in claims.columns or "id_proveedor" not in providers.columns:
        return claims

    provider_columns = [column for column in ["id_proveedor", "beneficiario", "ciudad", "casos_observados_proveedor", "proveedor_en_lista_restrictiva"] if column in providers.columns]
    if len(provider_columns) <= 1:
        return claims

    merged = claims.merge(providers[provider_columns], on="id_proveedor", how="left", suffixes=("", "_proveedor"))
    for column in ["beneficiario", "ciudad", "casos_observados_proveedor", "proveedor_en_lista_restrictiva"]:
        provider_column = f"{column}_proveedor"
        if provider_column in merged.columns:
            if column in merged.columns:
                merged[column] = merged[column].where(merged[column].notna() & (merged[column].astype(str).str.strip() != ""), merged[provider_column])
            else:
                merged[column] = merged[provider_column]
            merged = merged.drop(columns=[provider_column])
    return merged


def _normalize_claim_columns(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.copy()
    normalized.columns = [_alias_header(column) for column in normalized.columns]
    return normalized


def _ensure_pipeline_columns(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.copy()
    for column, default in DEFAULT_COLUMNS.items():
        if column not in normalized.columns:
            normalized[column] = default
    if not normalized["beneficiario"].astype(str).str.strip().any() and "id_proveedor" in normalized.columns:
        normalized["beneficiario"] = normalized["id_proveedor"]
    return normalized


def _alias_header(value: object) -> str:
    normalized = _normalize_header(value)
    return HEADER_ALIASES.get(normalized, normalized)


def _normalize_header(value: object) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.replace("→", " ")
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")
