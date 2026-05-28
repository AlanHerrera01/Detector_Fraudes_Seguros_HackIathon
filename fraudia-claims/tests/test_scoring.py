from src.features.scoring import score_claims
from src.ingestion.load_data import load_claims


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
