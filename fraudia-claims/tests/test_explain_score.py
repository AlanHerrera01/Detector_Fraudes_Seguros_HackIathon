from src.explainability.explain_score import build_executive_explanation


def test_green_case_summary_does_not_request_priority_review():
    explanation = build_executive_explanation(
        {
            "id_siniestro": "UPL-0005",
            "score_riesgo": 0,
            "nivel_riesgo": "verde",
            "cobertura": "Choque",
            "beneficiario": "Taller Aurora",
            "monto_reclamado": 4100.0,
            "suma_asegurada": 25000.0,
            "documentos_completos": "Si",
            "documentos_inconsistentes": "No",
            "dias_entre_ocurrencia_reporte": 0,
            "alertas": [],
            "senales_narrativa": [],
        }
    )

    summary = explanation["resumen_ejecutivo"]

    assert "No requiere revision prioritaria" in summary
    assert "continuar el flujo normal" in summary
    assert "requiere revision prioritaria porque" not in summary


def test_red_case_summary_keeps_priority_validation():
    explanation = build_executive_explanation(
        {
            "id_siniestro": "UPL-0002",
            "score_riesgo": 100,
            "nivel_riesgo": "rojo",
            "cobertura": "Perdida Total por Robo",
            "beneficiario": "Taller Horizonte",
            "monto_reclamado": 28500.0,
            "suma_asegurada": 30000.0,
            "documentos_completos": "No",
            "documentos_inconsistentes": "Si",
            "dias_entre_ocurrencia_reporte": 7,
            "alertas": [
                {
                    "code": "RF-02",
                    "name": "Documentos inconsistentes",
                    "severity": "rojo",
                    "points": 10,
                    "message": "Se detectaron inconsistencias o posible alteracion documental.",
                }
            ],
            "senales_narrativa": [],
        }
    )

    summary = explanation["resumen_ejecutivo"]

    assert "requiere revision especializada" in summary
    assert "documentacion incompleta o inconsistente" in summary
