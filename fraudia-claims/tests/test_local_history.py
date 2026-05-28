from src.ingestion.load_data import load_claims
from src.ingestion.local_history import append_local_upload, load_claims_history_from_csv


def test_local_csv_history_accumulates_with_default_dataset(tmp_path):
    history_path = tmp_path / "upload_history.csv"
    uploaded = load_claims("data/synthetic/siniestros_upload_prueba_2026.csv")

    saved = append_local_upload(uploaded, history_path)
    history = load_claims_history_from_csv(history_path)

    assert saved == len(uploaded)
    assert len(history) >= len(uploaded)
    assert set(uploaded["id_siniestro"]).issubset(set(history["id_siniestro"]))
