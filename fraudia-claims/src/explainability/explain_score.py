from src.rules.fraud_rules import RuleAlert


def build_explanation(id_siniestro: str, score: int, level: str, alerts: list[RuleAlert]) -> str:
    if not alerts:
        return (
            f"El siniestro {id_siniestro} tiene score {score}/100 y nivel {level}. "
            "No se activaron alertas relevantes; puede continuar el flujo normal."
        )

    reasons = "; ".join(alert.message for alert in alerts[:4])
    return (
        f"El siniestro {id_siniestro} tiene score {score}/100 y nivel {level}. "
        f"Requiere revision humana por estas senales: {reasons}. "
        "Esto no confirma fraude; solo prioriza el caso para analisis."
    )
