from src.rules.fraud_rules import evaluate_claim_rules, risk_level


def test_borde_extremo_de_vigencia_activa_alerta():
    alerts = evaluate_claim_rules(
        {
            "cobertura": "Choque",
            "dias_desde_inicio_poliza": 1,
            "dias_desde_fin_poliza": 300,
            "dias_entre_ocurrencia_reporte": 1,
            "historial_siniestros_asegurado": 0,
            "historial_siniestros_vehiculo": 0,
            "casos_observados_proveedor": 0,
            "monto_reclamado": 1000,
            "suma_asegurada": 10000,
            "documentos_completos": "Si",
            "documentos_inconsistentes": "No",
            "proveedor_en_lista_restrictiva": "No",
            "tercero_identificado": "Si",
            "dinamica_sospechosa": "No",
            "solo_rc": "No",
        }
    )

    assert any(alert.code == "RF-05" for alert in alerts)


def test_narrativa_inconsistente_activa_alerta_nlp():
    alerts = evaluate_claim_rules(
        {
            "cobertura": "Choque",
            "dias_desde_inicio_poliza": 200,
            "dias_desde_fin_poliza": 200,
            "dias_entre_ocurrencia_reporte": 1,
            "historial_siniestros_asegurado": 0,
            "historial_siniestros_vehiculo": 0,
            "casos_observados_proveedor": 0,
            "monto_reclamado": 1000,
            "suma_asegurada": 10000,
            "documentos_completos": "Si",
            "documentos_inconsistentes": "No",
            "proveedor_en_lista_restrictiva": "No",
            "tercero_identificado": "Si",
            "dinamica_sospechosa": "No",
            "solo_rc": "No",
            "narrativa_inconsistente": True,
            "narrativa_vaga": False,
            "narrativa_alto_riesgo": False,
        }
    )

    assert any(alert.code == "NLP-01" for alert in alerts)


def test_risk_level_thresholds():
    assert risk_level(40) == "verde"
    assert risk_level(41) == "amarillo"
    assert risk_level(76) == "rojo"
