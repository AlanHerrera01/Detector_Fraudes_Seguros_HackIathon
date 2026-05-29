import os
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier


DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[2] / "data/models/model.pkl"

MODEL_FEATURES = [
    "monto_reclamado",
    "monto_estimado",
    "dias_desde_inicio_poliza",
    "dias_desde_fin_poliza",
    "dias_entre_ocurrencia_reporte",
    "historial_siniestros_asegurado",
    "historial_siniestros_vehiculo",
    "casos_observados_proveedor",
    "suma_asegurada",
    "ratio_monto_suma",
    "narrativa_vaga",
    "narrativa_alto_riesgo",
    "narrativa_inconsistente",
]


def model_risk_scores(df: pd.DataFrame, training_df: pd.DataFrame | None = None) -> pd.Series:
    """Calcula el componente de IA del score en una escala de 0 a 25 puntos.

    Primero intenta entrenar/actualizar un modelo persistente si hay historico
    suficiente. Si no, usa un modelo guardado en model.pkl. Como ultimo respaldo,
    conserva el entrenamiento en caliente para que la demo nunca quede sin score.
    """
    data = _feature_matrix(df)
    training = training_df if training_df is not None else df
    training_data = _feature_matrix(training)

    if _can_train_supervised(training):
        model = _train_supervised_model(training_data, training)
        _save_model(model, "supervised_random_forest", training)
        return _predict_model_points(model, data, df.index)

    saved_model = _load_model()
    if saved_model is not None:
        return _predict_model_points(saved_model["model"], data, df.index, saved_model.get("kind"))

    model = _train_anomaly_model(training_data)
    _save_model(model, "isolation_forest", training)
    return _predict_model_points(model, data, df.index, "isolation_forest")


def train_persistent_model(training_df: pd.DataFrame, model_path: str | Path | None = None) -> dict:
    """Entrena y guarda model.pkl para que el scoring lo reutilice despues."""
    training_data = _feature_matrix(training_df)
    if _can_train_supervised(training_df):
        model = _train_supervised_model(training_data, training_df)
        kind = "supervised_random_forest"
    else:
        model = _train_anomaly_model(training_data)
        kind = "isolation_forest"
    return _save_model(model, kind, training_df, model_path)


def _feature_matrix(df: pd.DataFrame) -> pd.DataFrame:
    data = df.copy()
    for feature in MODEL_FEATURES:
        if feature not in data.columns:
            data[feature] = 0
    return data[MODEL_FEATURES].fillna(0)


def _can_train_supervised(training: pd.DataFrame) -> bool:
    return (
        "etiqueta_fraude_simulada" in training.columns
        and training["etiqueta_fraude_simulada"].dropna().nunique() > 1
    )


def _train_supervised_model(training_data: pd.DataFrame, training: pd.DataFrame) -> RandomForestClassifier:
    # RandomForest es robusto para datos tabulares y devuelve probabilidad de
    # fraude, que luego se convierte en un complemento explicable del score.
    labeled = training["etiqueta_fraude_simulada"].notna()
    model = RandomForestClassifier(n_estimators=120, random_state=42, class_weight="balanced")
    model.fit(training_data.loc[labeled], training.loc[labeled, "etiqueta_fraude_simulada"].astype(int))
    return model


def _train_anomaly_model(training_data: pd.DataFrame) -> IsolationForest:
    # Si no hay etiquetas, se mantiene aprendizaje no supervisado por anomalias.
    model = IsolationForest(contamination=0.25, random_state=42)
    model.fit(training_data)
    return model


def _predict_model_points(model, data: pd.DataFrame, index: pd.Index, kind: str | None = None) -> pd.Series:
    if hasattr(model, "predict_proba"):
        return pd.Series(model.predict_proba(data)[:, 1] * 25, index=index)

    raw = -model.decision_function(data)
    normalized = (raw - raw.min()) / (raw.max() - raw.min() or 1)
    return pd.Series(normalized * 25, index=index)


def _model_path(model_path: str | Path | None = None) -> Path:
    return Path(model_path or os.getenv("FRAUDIA_MODEL_PATH", DEFAULT_MODEL_PATH))


def _save_model(model, kind: str, training: pd.DataFrame, model_path: str | Path | None = None) -> dict:
    path = _model_path(model_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "kind": kind,
        "model": model,
        "features": MODEL_FEATURES,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_rows": int(len(training)),
        "has_labels": _can_train_supervised(training),
    }
    joblib.dump(artifact, path)
    return artifact


def _load_model(model_path: str | Path | None = None) -> dict | None:
    path = _model_path(model_path)
    if not path.exists():
        return None
    artifact = joblib.load(path)
    if not isinstance(artifact, dict) or artifact.get("features") != MODEL_FEATURES:
        return None
    return artifact
