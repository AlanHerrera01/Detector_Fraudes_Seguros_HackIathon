from src.ai_agent.claims_agent import answer_question, build_context
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


def test_required_question_contexts_stay_compact():
    df = _scored_claims()
    questions = [
        ("¿Cuáles son los 10 siniestros con mayor riesgo de posible fraude?", None, "top_claims"),
        ("¿Por qué este siniestro fue marcado como alto riesgo?", "SIN-0002", "claim_detail"),
        ("¿Qué proveedores concentran más alertas?", None, "provider_ranking"),
        ("¿Qué ramos tienen mayor porcentaje de casos sospechosos?", None, "line_of_business_summary"),
        ("¿Qué ciudades presentan mayor concentración de alertas?", None, "city_summary"),
        ("¿Qué asegurados tienen mayor frecuencia de reclamos?", None, "insured_frequency"),
        ("¿Qué documentos faltan en los casos críticos?", None, "document_review"),
        ("¿Qué casos tienen montos atípicos?", None, "amount_outliers"),
        ("¿Qué siniestros ocurrieron cerca del inicio de la póliza?", None, "policy_timing"),
        ("¿Qué patrones se repiten en los reclamos sospechosos?", None, "pattern_summary"),
        ("Genera un resumen ejecutivo de los casos críticos.", None, "portfolio_summary"),
        ("Recomienda qué casos debería revisar primero el analista.", None, "top_claims"),
    ]

    for question, claim_id, expected_source in questions:
        context, sources = build_context(question, df, claim_id=claim_id)
        assert expected_source in sources
        assert len(context) <= 1800
        assert context.startswith("objetivo=")
        assert "formato=Lectura|Evidencia|Impacto|Validacion" in context.splitlines()[0]


def test_ai_provider_selector_uses_gemini_only_without_credentials(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "your_gemini_api_key_here")
    monkeypatch.setenv("LOCAL_LLM_ENABLED", "false")
    answer, provider = ask_ai_model("Resume los riesgos", "total_siniestros=10", "local")

    assert provider == "gemini"
    assert "Gemini no esta configurado" in answer


def test_ai_provider_selector_ignores_openai_for_now(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "your_gemini_api_key_here")
    monkeypatch.setenv("LOCAL_LLM_ENABLED", "false")
    answer, provider = ask_ai_model("Resume los riesgos", "total_siniestros=10", "openai")

    assert provider == "gemini"
    assert "Gemini no esta configurado" in answer


def test_agent_context_uses_active_claim_id_for_generic_question():
    df = _scored_claims()
    context, sources = build_context("Por que salio alto?", df, claim_id="SIN-0002")

    assert "id=SIN-0002" in context
    assert "claim_detail" in sources


def test_agent_context_ignores_active_claim_for_plain_greeting():
    df = _scored_claims()
    context, sources = build_context("Hola", df, claim_id="SIN-0002")

    assert "saludando" in context
    assert sources == ["system"]


def test_agent_answers_plain_greeting_with_options_without_ai():
    df = _scored_claims()
    response = answer_question("Hola", df, claim_id="SIN-0002")

    assert response["provider"] == "system"
    assert "Qué necesitas revisar" in response["answer"]
    assert "Explicar el score" in response["answer"]


def test_agent_context_infers_unique_yellow_claim_for_color_question():
    df = _scored_claims()
    context, sources = build_context("porque me da color amarillo?", df)

    assert "nivel=amarillo" in context
    assert "claim_detail" in sources
