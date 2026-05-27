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
