import numpy as np
import pandas as pd

from src.features.text_analysis import narrative_signals, normalize_text


def build_risk_features(df: pd.DataFrame) -> pd.DataFrame:
    """Construye variables derivadas usadas por reglas y modelo de riesgo."""
    features = df.copy()

    # Compara el valor reclamado contra la suma asegurada; valores cercanos a 1
    # suelen requerir revision porque consumen casi toda la cobertura.
    features["ratio_monto_suma"] = np.where(
        features["suma_asegurada"].fillna(0) > 0,
        features["monto_reclamado"] / features["suma_asegurada"],
        0,
    )
    # Estas banderas resumen senales operativas del reto para facilitar lectura,
    # analisis y reutilizacion en futuros dashboards.
    features["reporte_tardio"] = features["dias_entre_ocurrencia_reporte"].fillna(0) > 7
    features["borde_vigencia"] = (
        (features["dias_desde_inicio_poliza"].fillna(9999) <= 30)
        | (features["dias_desde_fin_poliza"].fillna(9999) <= 30)
    )
    features["proveedor_recurrente"] = features["casos_observados_proveedor"].fillna(0) > 2
    features["frecuencia_asegurado_alta"] = features["historial_siniestros_asegurado"].fillna(0) >= 3
    features["frecuencia_vehiculo_alta"] = features["historial_siniestros_vehiculo"].fillna(0) >= 3

    narrative = features["descripcion"].apply(narrative_signals)
    features["narrativa_vaga"] = narrative.apply(lambda item: item["narrativa_vaga"])
    features["narrativa_alto_riesgo"] = narrative.apply(lambda item: item["narrativa_alto_riesgo"])
    features["narrativa_inconsistente"] = narrative.apply(lambda item: item["narrativa_inconsistente"])
    features["senales_narrativa"] = narrative.apply(lambda item: item["senales_narrativa"])
    normalized_narrative = features["descripcion"].apply(normalize_text)
    features["narrativa_clonada"] = normalized_narrative.ne("") & normalized_narrative.duplicated(keep=False)

    return features
