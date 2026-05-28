from pathlib import Path

import pandas as pd

from src.ingestion.load_data import DEFAULT_DATA_PATH, load_claims


LOCAL_HISTORY_PATH = Path("data/processed/upload_history.csv")
LOCAL_ACTIVE_PATH = Path("data/processed/active_upload.csv")


def append_local_upload(
    df: pd.DataFrame,
    history_path: Path = LOCAL_HISTORY_PATH,
    active_path: Path = LOCAL_ACTIVE_PATH,
) -> int:
    """Guarda cargas en un historico CSV local cuando PostgreSQL no esta activo."""
    history_path.parent.mkdir(parents=True, exist_ok=True)
    active_path.parent.mkdir(parents=True, exist_ok=True)
    current = _read_existing_history(history_path)
    combined = pd.concat([current, df], ignore_index=True)
    combined = _deduplicate_claims(combined)
    combined.to_csv(history_path, index=False)
    df.to_csv(active_path, index=False)
    return int(len(combined))


def load_active_claims_from_csv(active_path: Path = LOCAL_ACTIVE_PATH) -> pd.DataFrame:
    """Carga el ultimo archivo activo visible para dashboard/agente."""
    if active_path.exists():
        return load_claims(active_path)
    return load_claims(DEFAULT_DATA_PATH)


def load_claims_history_from_csv(history_path: Path = LOCAL_HISTORY_PATH) -> pd.DataFrame:
    """Carga default + historico local acumulado para scoring sin PostgreSQL."""
    base = load_claims(DEFAULT_DATA_PATH)
    if not history_path.exists():
        return base

    history = load_claims(history_path)
    combined = pd.concat([base, history], ignore_index=True)
    return _deduplicate_claims(combined)


def _read_existing_history(history_path: Path) -> pd.DataFrame:
    if not history_path.exists():
        return pd.DataFrame()
    return load_claims(history_path)


def _deduplicate_claims(df: pd.DataFrame) -> pd.DataFrame:
    if "id_siniestro" not in df.columns:
        return df.reset_index(drop=True)
    return df.drop_duplicates(subset=["id_siniestro"], keep="last").reset_index(drop=True)
