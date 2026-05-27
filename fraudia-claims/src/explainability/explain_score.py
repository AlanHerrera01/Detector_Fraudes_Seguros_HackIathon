from src.rules.fraud_rules import RuleAlert


def build_explanation(id_siniestro: str, score: int, level: str, alerts: list[RuleAlert]) -> str:
    """Genera una explicacion corta y auditable para el analista."""
    if not alerts:
        return (
            f"El siniestro {id_siniestro} tiene score {score}/100 y nivel {level}. "
            "No se activaron alertas relevantes; puede continuar el flujo normal."
        )

    # Se muestran hasta cuatro razones para que la explicacion sea accionable
    # sin volverse una lista dificil de leer en el dashboard/API.
    reasons = "; ".join(alert.message for alert in alerts[:4])
    return (
        f"El siniestro {id_siniestro} tiene score {score}/100 y nivel {level}. "
        f"Requiere revision humana por estas senales: {reasons}. "
        "Esto no confirma fraude; solo prioriza el caso para analisis."
    )


def build_executive_explanation(claim: dict) -> dict:
    """Arma una ficha ejecutiva con score, razones, acciones y advertencia etica."""
    alerts = claim.get("alertas", []) or []
    top_alerts = alerts[:5]
    reasons = [alert.get("message", "") for alert in top_alerts if alert.get("message")]
    actions = _recommended_actions(claim.get("nivel_riesgo"), top_alerts)

    return {
        "id_siniestro": claim.get("id_siniestro"),
        "score_riesgo": claim.get("score_riesgo"),
        "nivel_riesgo": claim.get("nivel_riesgo"),
        "resumen_ejecutivo": (
            f"El caso {claim.get('id_siniestro')} presenta nivel {claim.get('nivel_riesgo')} "
            f"con score {claim.get('score_riesgo')}/100. "
            f"Las principales senales son: {'; '.join(reasons) if reasons else 'sin alertas criticas'}."
        ),
        "senales_principales": [
            {
                "codigo": alert.get("code"),
                "nombre": alert.get("name"),
                "severidad": alert.get("severity"),
                "puntos": alert.get("points"),
                "mensaje": alert.get("message"),
            }
            for alert in top_alerts
        ],
        "senales_narrativa": claim.get("senales_narrativa", []),
        "acciones_recomendadas": actions,
        "nota_etica": (
            "Esta salida prioriza revision humana. No confirma fraude, no debe usarse "
            "para negar automaticamente un siniestro y puede contener falsos positivos."
        ),
    }


def _recommended_actions(level: str | None, alerts: list[dict]) -> list[str]:
    codes = {alert.get("code") for alert in alerts}
    actions = ["Revisar evidencia documental y validar consistencia con la narrativa."]

    if level == "rojo":
        actions.append("Escalar a analista senior antes de autorizar pagos o rechazos.")
    if "RF-03" in codes or "S-06" in codes:
        actions.append("Validar beneficiario/proveedor contra fuentes internas y listas disponibles.")
    if any(code and code.startswith("NLP-") for code in codes):
        actions.append("Solicitar ampliacion de la declaracion o soporte externo del evento.")
    if "RF-05" in codes or "S-01" in codes:
        actions.append("Contrastar fecha de ocurrencia contra inicio y fin de vigencia.")

    return actions
