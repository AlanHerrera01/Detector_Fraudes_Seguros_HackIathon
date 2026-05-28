from src.ai_agent.claims_agent import build_context
from src.ai_agent.gemini_service import ask_ai_model
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


def test_ai_provider_selector_supports_local_without_credentials():
    answer, provider = ask_ai_model("Resume los riesgos", "total_siniestros=10", "local")

    assert provider == "local"
    assert "revision" in answer.lower()


def test_ai_provider_selector_supports_openai_without_credentials(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "your_openai_api_key_here")
    answer, provider = ask_ai_model("Resume los riesgos", "total_siniestros=10", "openai")

    assert provider == "openai"
    assert "OpenAI no esta configurado" in answer


def test_agent_context_uses_active_claim_id_for_generic_question():
    df = _scored_claims()
    context, sources = build_context("Por que salio alto?", df, claim_id="SIN-0002")

    assert "id=SIN-0002" in context
    assert "claim_detail" in sources


def test_agent_context_infers_unique_yellow_claim_for_color_question():
    df = _scored_claims()
    context, sources = build_context("porque me da color amarillo?", df)

    assert "nivel=amarillo" in context
    assert "claim_detail" in sources
