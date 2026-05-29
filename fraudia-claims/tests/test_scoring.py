from src.features.scoring import score_claims
from src.features.build_features import build_risk_features
from src.ingestion.load_data import load_claims
from src.models.fraud_model import _hash_path, _load_model, train_persistent_model


def test_score_claims_generates_required_columns():
    df = score_claims(load_claims("data/synthetic/siniestros_sinteticos.csv"))

    assert "score_riesgo" in df.columns
    assert "nivel_riesgo" in df.columns
    assert "senales_narrativa" in df.columns
    assert "explicacion" in df.columns
    assert len(df) > 0
    assert df["score_riesgo"].between(0, 100).all()


def test_score_claims_can_train_with_history_but_return_active_rows():
    active = load_claims("data/synthetic/siniestros_upload_prueba_2026.csv")
    history = load_claims("data/synthetic/siniestros_sinteticos.csv")

    scored = score_claims(active, training_df=history)

    assert len(scored) == len(active)
    assert set(scored["id_siniestro"]) == set(active["id_siniestro"])
    assert scored["score_riesgo"].between(0, 100).all()


def test_persistent_model_requires_valid_sha256(tmp_path):
    training = build_risk_features(load_claims("data/synthetic/siniestros_sinteticos.csv"))
    model_path = tmp_path / "model.pkl"

    train_persistent_model(training, model_path)

    assert _hash_path(model_path).exists()
    assert _load_model(model_path) is not None

    with model_path.open("ab") as file:
        file.write(b"tampered")

    assert _load_model(model_path) is None
