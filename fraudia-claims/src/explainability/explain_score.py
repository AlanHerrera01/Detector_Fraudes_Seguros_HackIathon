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
        "resumen_ejecutivo": _human_executive_summary(claim, reasons),
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


def _human_executive_summary(claim: dict, reasons: list[str]) -> str:
    level = claim.get("nivel_riesgo")
    score = claim.get("score_riesgo") or 0
    claim_id = claim.get("id_siniestro")
    cobertura = claim.get("cobertura")
    proveedor = claim.get("beneficiario")
    monto = claim.get("monto_reclamado")
    suma = claim.get("suma_asegurada") or 0
    ratio = claim.get("ratio_monto_suma") or 0
    documentos_completos = str(claim.get("documentos_completos", "")).lower()
    documentos_inconsistentes = str(claim.get("documentos_inconsistentes", "")).lower()
    dias_reporte = claim.get("dias_entre_ocurrencia_reporte")

    risk_factors = []
    neutral_context = []
    positive_context = []

    if documentos_completos in {"no", "false", "0"} or documentos_inconsistentes in {"si", "true", "1"}:
        risk_factors.append("documentacion incompleta o inconsistente")
    elif documentos_completos in {"si", "true", "1"} and documentos_inconsistentes in {"no", "false", "0"}:
        positive_context.append("documentacion completa y sin inconsistencias declaradas")

    if cobertura:
        neutral_context.append(f"cobertura {cobertura}")
    if proveedor:
        neutral_context.append(f"proveedor {proveedor}")
    if ratio and ratio >= 0.9:
        risk_factors.append(f"monto reclamado cercano a la suma asegurada ({round(float(ratio) * 100, 1)}%)")
    elif monto and suma:
        neutral_context.append(f"monto reclamado {monto} sobre suma asegurada {suma}")
    if dias_reporte and dias_reporte >= 4:
        risk_factors.append(f"reporte realizado {dias_reporte} dias despues del evento")
    elif dias_reporte == 0:
        positive_context.append("reporte el mismo dia del evento")
    elif dias_reporte:
        positive_context.append(f"reporte en {dias_reporte} dia(s)")

    if not risk_factors and reasons:
        risk_factors = reasons[:3]

    risk_text = _join_sentence_items(risk_factors[:4])
    neutral_text = _join_sentence_items(neutral_context[:3])
    positive_text = _join_sentence_items(positive_context[:3])

    if level == "verde":
        if risk_text:
            return (
                f"El caso {claim_id} queda en nivel verde con score {score}/100. "
                f"No requiere revision prioritaria, aunque conviene validar {risk_text} antes del cierre operativo. "
                f"Contexto del reclamo: {neutral_text or 'datos basicos del siniestro'}. "
                "La lectura es de bajo riesgo; no confirma fraude ni habilita una decision automatica."
            )
        return (
            f"El caso {claim_id} queda en nivel verde con score {score}/100 porque no activa alertas relevantes "
            f"en reglas ni en narrativa. {('A favor del flujo normal: ' + positive_text + '. ') if positive_text else ''}"
            f"Contexto del reclamo: {neutral_text or 'datos basicos del siniestro'}. "
            "No requiere revision prioritaria; la recomendacion es continuar el flujo normal con validacion documental basica."
        )

    action = "revision documental prioritaria" if level == "amarillo" else "revision especializada antes de decidir"
    return (
        f"El caso {claim_id} queda en nivel {level} con score {score}/100 y requiere {action}. "
        f"Las senales que explican la alerta son: {risk_text or 'alertas operativas del motor de reglas'}. "
        f"Contexto del reclamo: {neutral_text or 'datos basicos del siniestro'}. "
        "Esto no confirma fraude; orienta que soportes, fechas, proveedor y narrativa deben validarse antes de autorizar una decision."
    )


def _join_sentence_items(items: list[str]) -> str:
    clean_items = [str(item).strip() for item in items if str(item).strip()]
    if not clean_items:
        return ""
    if len(clean_items) == 1:
        return clean_items[0]
    return f"{', '.join(clean_items[:-1])} y {clean_items[-1]}"


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
