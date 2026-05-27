from src.ai_agent.claims_agent import build_context
from src.features.scoring import score_claims
from src.ingestion.load_data import load_claims


def _scored_claims():
    return score_claims(load_claims("data/synthetic/siniestros_sinteticos.csv"))


def test_agent_context_supports_required_questions():
    df = _scored_claims()
    questions_and_sources = [
        ("Cuales son los 10 siniestros con mayor riesgo?", "top_claims"),
        ("Por que este siniestro SIN-0002 fue marcado como alto riesgo?", "claim_detail"),
        ("Que proveedores concentran mas alertas?", "provider_ranking"),
        ("Que ramos tienen mayor porcentaje de casos sospechosos?", "line_of_business_summary"),
        ("Que ciudades presentan mayor concentracion de alertas?", "city_summary"),
        ("Que asegurados tienen mayor frecuencia de reclamos?", "insured_frequency"),
        ("Que documentos faltan en los casos criticos?", "document_review"),
        ("Que casos tienen montos atipicos?", "amount_outliers"),
        ("Que siniestros ocurrieron cerca del inicio de la poliza?", "policy_timing"),
        ("Que patrones se repiten en los reclamos sospechosos?", "pattern_summary"),
        ("Genera un resumen ejecutivo de los casos criticos.", "portfolio_summary"),
        ("Recomienda que casos deberia revisar primero el analista.", "top_claims"),
    ]

    for question, expected_source in questions_and_sources:
        _, sources = build_context(question, df)
        assert expected_source in sources
