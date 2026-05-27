import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier


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


def model_risk_scores(df: pd.DataFrame) -> pd.Series:
    """Calcula el componente de IA del score en una escala de 0 a 25 puntos.

    Si hay etiqueta simulada, entrena un clasificador supervisado. Si no hay
    etiqueta util, usa deteccion de anomalias para mantener la demo funcional.
    """
    data = df[MODEL_FEATURES].fillna(0)

    if "etiqueta_fraude_simulada" in df.columns and df["etiqueta_fraude_simulada"].nunique() > 1:
        # RandomForest se usa por robustez en datos tabulares y porque permite
        # una probabilidad interpretable como complemento del score de reglas.
        model = RandomForestClassifier(n_estimators=80, random_state=42, class_weight="balanced")
        model.fit(data, df["etiqueta_fraude_simulada"])
        return pd.Series(model.predict_proba(data)[:, 1] * 25, index=df.index)

    # Fallback sin etiquetas: IsolationForest estima que tan atipico es un caso
    # frente al resto del portafolio cargado.
    model = IsolationForest(contamination=0.25, random_state=42)
    model.fit(data)
    raw = -model.decision_function(data)
    normalized = (raw - raw.min()) / (raw.max() - raw.min() or 1)
    return pd.Series(normalized * 25, index=df.index)
