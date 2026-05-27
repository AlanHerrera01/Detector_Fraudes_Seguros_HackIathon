from pathlib import Path

import pandas as pd


DEFAULT_DATA_PATH = Path("data/synthetic/siniestros_sinteticos.csv")


def load_claims(path: str | Path = DEFAULT_DATA_PATH) -> pd.DataFrame:
    """Carga siniestros desde CSV y valida el contrato minimo de columnas.

    La validacion temprana evita que el motor de reglas falle mas adelante con
    errores poco claros cuando el usuario sube un archivo incompleto.
    """
    dataset_path = Path(path)
    if not dataset_path.exists():
        raise FileNotFoundError(f"No existe el dataset: {dataset_path}")

    df = pd.read_csv(dataset_path)
    required_columns = {
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
    missing = required_columns.difference(df.columns)
    if missing:
        raise ValueError(f"Faltan columnas requeridas: {sorted(missing)}")

    # Las fechas invalidas se convierten en NaT para que pandas permita seguir
    # procesando y las reglas de negocio manejen el dato faltante.
    for column in ["fecha_ocurrencia", "fecha_reporte"]:
        df[column] = pd.to_datetime(df[column], errors="coerce")

    return df
