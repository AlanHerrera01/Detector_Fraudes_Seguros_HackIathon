import numpy as np
import pandas as pd


def build_risk_features(df: pd.DataFrame) -> pd.DataFrame:
    features = df.copy()

    features["ratio_monto_suma"] = np.where(
        features["suma_asegurada"].fillna(0) > 0,
        features["monto_reclamado"] / features["suma_asegurada"],
        0,
    )
    features["reporte_tardio"] = features["dias_entre_ocurrencia_reporte"].fillna(0) > 7
    features["borde_vigencia"] = (
        (features["dias_desde_inicio_poliza"].fillna(9999) <= 30)
        | (features["dias_desde_fin_poliza"].fillna(9999) <= 30)
    )
    features["proveedor_recurrente"] = features["casos_observados_proveedor"].fillna(0) > 2
    features["frecuencia_asegurado_alta"] = features["historial_siniestros_asegurado"].fillna(0) >= 3
    features["frecuencia_vehiculo_alta"] = features["historial_siniestros_vehiculo"].fillna(0) >= 3

    return features
