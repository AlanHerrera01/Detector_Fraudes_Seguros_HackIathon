import argparse
from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.features.build_features import build_risk_features
from src.ingestion.load_data import DEFAULT_DATA_PATH, load_claims
from src.models.fraud_model import DEFAULT_MODEL_PATH, train_persistent_model


def main() -> None:
    parser = argparse.ArgumentParser(description="Entrena y guarda el modelo persistente de FraudIA.")
    parser.add_argument("datasets", nargs="*", help="Archivos CSV/XLSX/XLS para entrenar. Si se omiten, usa el dataset base.")
    parser.add_argument("--output", default=str(DEFAULT_MODEL_PATH), help="Ruta de salida del model.pkl.")
    args = parser.parse_args()

    raw_paths = [Path(path) for path in args.datasets] or [DEFAULT_DATA_PATH]
    paths = [path if path.is_absolute() else ROOT / path for path in raw_paths]
    frames = [load_claims(path) for path in paths]
    training = pd.concat(frames, ignore_index=True)
    features = build_risk_features(training)
    output = Path(args.output)
    output = output if output.is_absolute() else ROOT / output
    artifact = train_persistent_model(features, output)

    print(f"Modelo guardado en: {output}")
    print(f"Tipo: {artifact['kind']}")
    print(f"Filas de entrenamiento: {artifact['training_rows']}")
    print(f"Etiquetas supervisadas: {'si' if artifact['has_labels'] else 'no'}")


if __name__ == "__main__":
    main()
