import os
from pathlib import Path
from typing import Any
from datetime import datetime, timezone

import pandas as pd
from dotenv import load_dotenv

from src.ingestion.load_data import load_claims

load_dotenv()


CLAIM_COLUMNS = [
    "id_siniestro",
    "id_poliza",
    "id_asegurado",
    "id_vehiculo",
    "ramo",
    "cobertura",
    "fecha_ocurrencia",
    "fecha_reporte",
    "monto_reclamado",
    "monto_estimado",
    "monto_pagado",
    "estado",
    "sucursal",
    "ciudad",
    "descripcion",
    "documentos_completos",
    "documentos_inconsistentes",
    "beneficiario",
    "proveedor_en_lista_restrictiva",
    "asegurado_en_lista_restrictiva",
    "beneficiario_en_lista_restrictiva",
    "aps_en_lista_restrictiva",
    "dias_desde_inicio_poliza",
    "dias_desde_fin_poliza",
    "dias_entre_ocurrencia_reporte",
    "historial_siniestros_asegurado",
    "historial_siniestros_vehiculo",
    "historial_siniestros_conductor",
    "casos_observados_proveedor",
    "suma_asegurada",
    "solo_rc",
    "tercero_identificado",
    "dinamica_sospechosa",
    "etiqueta_fraude_simulada",
]

UPLOAD_METADATA_COLUMNS = [
    "upload_batch_id",
    "uploaded_at",
    "source_filename",
]

COMPLEMENTARY_TABLES = {
    "polizas": {
        "path": "data/synthetic/polizas_sinteticas.csv",
        "pk": "id_poliza",
        "columns": [
            "id_poliza",
            "id_asegurado",
            "ramo",
            "fecha_inicio",
            "fecha_fin",
            "prima",
            "suma_asegurada",
            "deducible",
            "canal_venta",
            "ciudad",
            "estado_poliza",
        ],
        "ddl": """
            id_poliza TEXT PRIMARY KEY,
            id_asegurado TEXT,
            ramo TEXT,
            fecha_inicio DATE,
            fecha_fin DATE,
            prima NUMERIC,
            suma_asegurada NUMERIC,
            deducible NUMERIC,
            canal_venta TEXT,
            ciudad TEXT,
            estado_poliza TEXT
        """,
    },
    "asegurados_sinteticos": {
        "path": "data/synthetic/asegurados_sinteticos.csv",
        "pk": "id_asegurado",
        "columns": [
            "id_asegurado",
            "segmento",
            "antiguedad",
            "ciudad",
            "numero_polizas",
            "reclamos_ultimos_12_meses",
            "mora_actual",
            "score_cliente_simulado",
        ],
        "ddl": """
            id_asegurado TEXT PRIMARY KEY,
            segmento TEXT,
            antiguedad INTEGER,
            ciudad TEXT,
            numero_polizas INTEGER,
            reclamos_ultimos_12_meses INTEGER,
            mora_actual TEXT,
            score_cliente_simulado NUMERIC
        """,
    },
    "proveedores": {
        "path": "data/synthetic/proveedores_sinteticos.csv",
        "pk": "id_proveedor",
        "columns": [
            "id_proveedor",
            "beneficiario",
            "tipo",
            "ciudad",
            "reclamos_asociados",
            "monto_promedio_reclamado",
            "porcentaje_casos_observados",
            "antiguedad",
        ],
        "ddl": """
            id_proveedor TEXT PRIMARY KEY,
            beneficiario TEXT,
            tipo TEXT,
            ciudad TEXT,
            reclamos_asociados INTEGER,
            monto_promedio_reclamado NUMERIC,
            porcentaje_casos_observados NUMERIC,
            antiguedad INTEGER
        """,
    },
    "documentos": {
        "path": "data/synthetic/documentos_sinteticos.csv",
        "pk": "id_documento",
        "columns": [
            "id_documento",
            "id_siniestro",
            "tipo_documento",
            "entregado",
            "legible",
            "fecha_emision",
            "inconsistencia_detectada",
            "observacion",
        ],
        "ddl": """
            id_documento TEXT PRIMARY KEY,
            id_siniestro TEXT,
            tipo_documento TEXT,
            entregado TEXT,
            legible TEXT,
            fecha_emision DATE,
            inconsistencia_detectada TEXT,
            observacion TEXT
        """,
    },
}


def db_enabled() -> bool:
    return os.getenv("DB_ENABLED", "false").strip().lower() in {"1", "true", "yes", "si"}


def db_settings() -> dict[str, str]:
    return {
        "host": os.getenv("DB_HOST", "127.0.0.1"),
        "port": os.getenv("DB_PORT", "5432"),
        "dbname": os.getenv("DB_NAME", "fraudia_claims"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", ""),
        "schema": os.getenv("DB_SCHEMA", "public"),
        "table": os.getenv("DB_TABLE", "siniestros"),
    }


def initialize_database(seed_path: str | Path | None = None) -> dict[str, Any]:
    """Crea base, tabla y siembra datos iniciales si la tabla esta vacia."""
    settings = db_settings()
    _create_database_if_missing(settings)
    _create_table_if_missing(settings)
    _create_complementary_tables(settings)
    seeded = False
    total = count_claims()

    if total == 0 and seed_path:
        df = load_claims(seed_path)
        upsert_claims(df)
        seeded = True
        total = count_claims()

    complementary_seeded = _seed_complementary_tables(Path(seed_path).parent.parent.parent if seed_path else Path.cwd())

    return {
        "enabled": db_enabled(),
        "database": settings["dbname"],
        "schema": settings["schema"],
        "table": settings["table"],
        "seeded": seeded,
        "complementary_seeded": complementary_seeded,
        "total_claims": total,
    }


def database_status() -> dict[str, Any]:
    settings = db_settings()
    if not db_enabled():
        return {"enabled": False, "message": "PostgreSQL desactivado; se usa CSV."}

    try:
        total = count_claims()
        return {
            "enabled": True,
            "connected": True,
            "database": settings["dbname"],
            "schema": settings["schema"],
            "table": settings["table"],
            "total_claims": total,
        }
    except Exception as exc:
        return {
            "enabled": True,
            "connected": False,
            "database": settings["dbname"],
            "error": str(exc),
        }


def load_claims_from_db(upload_batch_id: str | None = None, latest_only: bool = True) -> pd.DataFrame:
    settings = db_settings()
    where_clause = _batch_where_clause(settings, upload_batch_id, latest_only=latest_only)
    with _connect(settings["dbname"]) as conn:
        rows = conn.execute(
            f'SELECT {", ".join(CLAIM_COLUMNS)} FROM "{settings["schema"]}"."{settings["table"]}" {where_clause} ORDER BY id_siniestro'
        ).fetchall()

    df = pd.DataFrame(rows, columns=CLAIM_COLUMNS)
    for column in ["fecha_ocurrencia", "fecha_reporte"]:
        df[column] = pd.to_datetime(df[column], errors="coerce")

    numeric_columns = [
        "monto_reclamado",
        "monto_estimado",
        "monto_pagado",
        "dias_desde_inicio_poliza",
        "dias_desde_fin_poliza",
        "dias_entre_ocurrencia_reporte",
        "historial_siniestros_asegurado",
        "historial_siniestros_vehiculo",
        "historial_siniestros_conductor",
        "casos_observados_proveedor",
        "suma_asegurada",
        "etiqueta_fraude_simulada",
    ]
    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    return df


def load_claims_history_from_db() -> pd.DataFrame:
    """Carga todo el historico guardado para scoring/modelo acumulativo."""
    return load_claims_from_db(latest_only=False)


def list_upload_batches() -> list[dict[str, Any]]:
    settings = db_settings()
    if not _table_has_column(settings, "upload_batch_id"):
        return []

    with _connect(settings["dbname"]) as conn:
        rows = conn.execute(
            f'''
            SELECT upload_batch_id, source_filename, uploaded_at, COUNT(*) AS total_claims
            FROM "{settings["schema"]}"."{settings["table"]}"
            WHERE upload_batch_id IS NOT NULL
            GROUP BY upload_batch_id, source_filename, uploaded_at
            ORDER BY uploaded_at DESC NULLS LAST
            '''
        ).fetchall()

    return [
        {
            "upload_batch_id": row[0],
            "source_filename": row[1],
            "uploaded_at": row[2].isoformat() if row[2] else None,
            "total_claims": int(row[3]),
        }
        for row in rows
    ]


def upsert_claims(
    df: pd.DataFrame,
    source_filename: str | None = None,
    upload_batch_id: str | None = None,
    uploaded_at: datetime | None = None,
) -> int:
    settings = db_settings()
    normalized = df.copy()
    for column in CLAIM_COLUMNS:
        if column not in normalized.columns:
            normalized[column] = None
    if upload_batch_id is None:
        upload_batch_id = "seed"
    if uploaded_at is None:
        uploaded_at = datetime.now(timezone.utc)
    normalized["upload_batch_id"] = upload_batch_id
    normalized["uploaded_at"] = uploaded_at
    normalized["source_filename"] = source_filename or "seed"
    insert_columns = CLAIM_COLUMNS + UPLOAD_METADATA_COLUMNS
    normalized = normalized[insert_columns].where(pd.notna(normalized), None)
    records = [tuple(row) for row in normalized.itertuples(index=False, name=None)]

    placeholders = ", ".join(["%s"] * len(insert_columns))
    columns_sql = ", ".join(f'"{column}"' for column in insert_columns)
    update_sql = ", ".join(f'"{column}" = EXCLUDED."{column}"' for column in insert_columns if column != "id_siniestro")
    query = (
        f'INSERT INTO "{settings["schema"]}"."{settings["table"]}" ({columns_sql}) '
        f"VALUES ({placeholders}) "
        f'ON CONFLICT ("id_siniestro") DO UPDATE SET {update_sql}'
    )

    with _connect(settings["dbname"]) as conn:
        with conn.cursor() as cur:
            cur.executemany(query, records)
        conn.commit()

    return len(records)


def count_claims() -> int:
    settings = db_settings()
    with _connect(settings["dbname"]) as conn:
        result = conn.execute(f'SELECT COUNT(*) FROM "{settings["schema"]}"."{settings["table"]}"').fetchone()
    return int(result[0])


def _connect(dbname: str):
    psycopg = _psycopg()
    settings = db_settings()
    return psycopg.connect(
        host=settings["host"],
        port=settings["port"],
        dbname=dbname,
        user=settings["user"],
        password=settings["password"],
    )


def _create_database_if_missing(settings: dict[str, str]) -> None:
    from psycopg import sql

    with _connect("postgres") as conn:
        conn.autocommit = True
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (settings["dbname"],)).fetchone()
        if not exists:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(settings["dbname"])))


def _create_table_if_missing(settings: dict[str, str]) -> None:
    ddl = f'''
    CREATE SCHEMA IF NOT EXISTS "{settings["schema"]}";
    CREATE TABLE IF NOT EXISTS "{settings["schema"]}"."{settings["table"]}" (
        id_siniestro TEXT PRIMARY KEY,
        id_poliza TEXT,
        id_asegurado TEXT,
        id_vehiculo TEXT,
        ramo TEXT,
        cobertura TEXT,
        fecha_ocurrencia DATE,
        fecha_reporte DATE,
        monto_reclamado NUMERIC,
        monto_estimado NUMERIC,
        monto_pagado NUMERIC,
        estado TEXT,
        sucursal TEXT,
        ciudad TEXT,
        descripcion TEXT,
        documentos_completos TEXT,
        documentos_inconsistentes TEXT,
        beneficiario TEXT,
        proveedor_en_lista_restrictiva TEXT,
        asegurado_en_lista_restrictiva TEXT,
        beneficiario_en_lista_restrictiva TEXT,
        aps_en_lista_restrictiva TEXT,
        dias_desde_inicio_poliza INTEGER,
        dias_desde_fin_poliza INTEGER,
        dias_entre_ocurrencia_reporte INTEGER,
        historial_siniestros_asegurado INTEGER,
        historial_siniestros_vehiculo INTEGER,
        historial_siniestros_conductor INTEGER,
        casos_observados_proveedor INTEGER,
        suma_asegurada NUMERIC,
        solo_rc TEXT,
        tercero_identificado TEXT,
        dinamica_sospechosa TEXT,
        etiqueta_fraude_simulada INTEGER,
        upload_batch_id TEXT,
        uploaded_at TIMESTAMPTZ,
        source_filename TEXT
    );
    ALTER TABLE "{settings["schema"]}"."{settings["table"]}" ADD COLUMN IF NOT EXISTS upload_batch_id TEXT;
    ALTER TABLE "{settings["schema"]}"."{settings["table"]}" ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;
    ALTER TABLE "{settings["schema"]}"."{settings["table"]}" ADD COLUMN IF NOT EXISTS source_filename TEXT;
    ALTER TABLE "{settings["schema"]}"."{settings["table"]}" ADD COLUMN IF NOT EXISTS historial_siniestros_conductor INTEGER;
    ALTER TABLE "{settings["schema"]}"."{settings["table"]}" ADD COLUMN IF NOT EXISTS asegurado_en_lista_restrictiva TEXT;
    ALTER TABLE "{settings["schema"]}"."{settings["table"]}" ADD COLUMN IF NOT EXISTS beneficiario_en_lista_restrictiva TEXT;
    ALTER TABLE "{settings["schema"]}"."{settings["table"]}" ADD COLUMN IF NOT EXISTS aps_en_lista_restrictiva TEXT;
    '''
    with _connect(settings["dbname"]) as conn:
        conn.execute(ddl)
        conn.commit()


def _create_complementary_tables(settings: dict[str, str]) -> None:
    with _connect(settings["dbname"]) as conn:
        for table_name, config in COMPLEMENTARY_TABLES.items():
            conn.execute(
                f'''
                CREATE TABLE IF NOT EXISTS "{settings["schema"]}"."{table_name}" (
                    {config["ddl"]}
                );
                '''
            )
        conn.commit()


def _seed_complementary_tables(project_root: Path) -> dict[str, int]:
    settings = db_settings()
    seeded: dict[str, int] = {}

    for table_name, config in COMPLEMENTARY_TABLES.items():
        path = project_root / config["path"]
        if not path.exists():
            seeded[table_name] = 0
            continue

        with _connect(settings["dbname"]) as conn:
            current = conn.execute(f'SELECT COUNT(*) FROM "{settings["schema"]}"."{table_name}"').fetchone()[0]

        if current:
            seeded[table_name] = 0
            continue

        df = pd.read_csv(path)
        seeded[table_name] = _upsert_dataframe(table_name, df, config["columns"], config["pk"])

    return seeded


def _upsert_dataframe(table_name: str, df: pd.DataFrame, columns: list[str], pk: str) -> int:
    settings = db_settings()
    normalized = df.copy()
    for column in columns:
        if column not in normalized.columns:
            normalized[column] = None
    normalized = normalized[columns].where(pd.notna(normalized), None)
    records = [tuple(row) for row in normalized.itertuples(index=False, name=None)]

    placeholders = ", ".join(["%s"] * len(columns))
    columns_sql = ", ".join(f'"{column}"' for column in columns)
    update_sql = ", ".join(f'"{column}" = EXCLUDED."{column}"' for column in columns if column != pk)
    query = (
        f'INSERT INTO "{settings["schema"]}"."{table_name}" ({columns_sql}) '
        f"VALUES ({placeholders}) "
        f'ON CONFLICT ("{pk}") DO UPDATE SET {update_sql}'
    )

    with _connect(settings["dbname"]) as conn:
        with conn.cursor() as cur:
            cur.executemany(query, records)
        conn.commit()

    return len(records)


def _batch_where_clause(settings: dict[str, str], upload_batch_id: str | None = None, latest_only: bool = True) -> str:
    if not _table_has_column(settings, "upload_batch_id") or not _table_has_column(settings, "uploaded_at"):
        return ""

    if upload_batch_id:
        batch_id = upload_batch_id.replace("'", "''")
        return f"WHERE upload_batch_id = '{batch_id}'"

    if not latest_only:
        return ""

    with _connect(settings["dbname"]) as conn:
        latest = conn.execute(
            f'''
            SELECT upload_batch_id
            FROM "{settings["schema"]}"."{settings["table"]}"
            WHERE upload_batch_id IS NOT NULL
            ORDER BY uploaded_at DESC NULLS LAST
            LIMIT 1
            '''
        ).fetchone()

    if not latest or not latest[0]:
        return ""
    batch_id = str(latest[0]).replace("'", "''")
    return f"WHERE upload_batch_id = '{batch_id}'"


def _table_has_column(settings: dict[str, str], column: str) -> bool:
    with _connect(settings["dbname"]) as conn:
        exists = conn.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = %s
              AND table_name = %s
              AND column_name = %s
            """,
            (settings["schema"], settings["table"], column),
        ).fetchone()
    return bool(exists)


def _psycopg():
    try:
        import psycopg
    except ImportError as exc:
        raise RuntimeError("Instala psycopg[binary] o ejecuta: pip install -r requirements.txt") from exc
    return psycopg
