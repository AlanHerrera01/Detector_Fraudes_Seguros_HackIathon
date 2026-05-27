from src.features.text_analysis import narrative_signals


def test_narrative_signals_detects_vague_and_risk_terms():
    signals = narrative_signals("Robo sin testigos; el asegurado no recuerda detalles.")

    assert signals["narrativa_vaga"] is True
    assert signals["narrativa_alto_riesgo"] is True
    assert "robo" in signals["senales_narrativa"]
