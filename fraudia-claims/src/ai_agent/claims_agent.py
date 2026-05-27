import pandas as pd

from src.ai_agent.gemini_service import ask_gemini


def answer_question(question: str, scored_claims: pd.DataFrame) -> dict:
    """Responde preguntas del analista usando solo contexto derivado del dataset."""
    context, sources = build_context(question, scored_claims)
    answer = ask_gemini(question, context)
    return {"answer": answer, "sources": sources}


def build_context(question: str, scored_claims: pd.DataFrame) -> tuple[str, list[str]]:
    """Selecciona el contexto mas relevante antes de llamar al agente IA.

    Este ruteo simple evita enviar todo el dataset a Gemini y mantiene las
    respuestas trazables a fuentes internas como ranking, top casos o resumen.
    """
    normalized = question.lower()

    matched_id = _find_claim_id(normalized, scored_claims)
    if matched_id:
        claim = scored_claims[scored_claims["id_siniestro"].str.lower() == matched_id].iloc[0]
        context = (
            "Ficha compacta del siniestro para que la IA explique causalmente el nivel de riesgo. "
            "No copies todo; interpreta los factores clave.\n"
            f"{_build_claim_compact_context(claim)}"
        )
        return context, ["claim_detail", "rules_engine", "narrative_signals", "claims_scores"]

    if any(term in normalized for term in ["comite", "resumen ejecutivo", "presentar", "decision"]):
        top = scored_claims.sort_values("score_riesgo", ascending=False).head(5)
        provider = (
            scored_claims.groupby("beneficiario")
            .agg(
                total_casos=("id_siniestro", "count"),
                alertas_rojas=("nivel_riesgo", lambda s: int((s == "rojo").sum())),
                score_promedio=("score_riesgo", "mean"),
            )
            .sort_values(["alertas_rojas", "score_promedio"], ascending=False)
            .head(3)
            .reset_index()
        )
        context = {
            "resumen_portafolio": {
                "total_siniestros": int(len(scored_claims)),
                "casos_rojos": int((scored_claims["nivel_riesgo"] == "rojo").sum()),
                "casos_amarillos": int((scored_claims["nivel_riesgo"] == "amarillo").sum()),
                "casos_verdes": int((scored_claims["nivel_riesgo"] == "verde").sum()),
                "score_promedio": round(float(scored_claims["score_riesgo"].mean()), 2),
            },
            "top_casos": top[["id_siniestro", "beneficiario", "score_riesgo", "nivel_riesgo", "explicacion"]].to_dict(orient="records"),
            "proveedores_prioritarios": provider.round({"score_promedio": 2}).to_dict(orient="records"),
            "recomendacion": "Priorizar revision humana de casos rojos y proveedores con concentracion de alertas.",
        }
        return str(context), ["portfolio_summary", "top_claims", "provider_ranking", "ethics_guardrail"]

    if any(term in normalized for term in ["recomienda", "revisar primero", "prioridad", "priorizar"]):
        top = scored_claims.sort_values("score_riesgo", ascending=False).head(10)
        columns = ["id_siniestro", "beneficiario", "ciudad", "cobertura", "score_riesgo", "nivel_riesgo", "explicacion"]
        return top[columns].to_string(index=False), ["top_claims", "claims_scores", "rules_engine"]

    if any(term in normalized for term in ["narrativa", "nlp", "descripcion", "texto"]):
        nlp = scored_claims[scored_claims["senales_narrativa"].apply(lambda value: len(value) > 0)]
        columns = ["id_siniestro", "beneficiario", "score_riesgo", "nivel_riesgo", "senales_narrativa", "explicacion"]
        return nlp.sort_values("score_riesgo", ascending=False).head(10)[columns].to_string(index=False), ["narrative_signals", "claims_scores"]

    if "ramo" in normalized or "ramos" in normalized:
        ramo_summary = (
            scored_claims.assign(caso_sospechoso=scored_claims["nivel_riesgo"].isin(["amarillo", "rojo"]))
            .groupby("ramo")
            .agg(
                total_casos=("id_siniestro", "count"),
                casos_sospechosos=("caso_sospechoso", "sum"),
                casos_rojos=("nivel_riesgo", lambda s: int((s == "rojo").sum())),
                score_promedio=("score_riesgo", "mean"),
            )
            .reset_index()
        )
        ramo_summary["porcentaje_sospechoso"] = (ramo_summary["casos_sospechosos"] / ramo_summary["total_casos"] * 100).round(2)
        return ramo_summary.sort_values(["porcentaje_sospechoso", "score_promedio"], ascending=False).to_string(index=False), ["line_of_business_summary", "claims_scores"]

    if "proveedor" in normalized or "beneficiario" in normalized:
        ranking = (
            scored_claims.groupby("beneficiario")
            .agg(
                total_casos=("id_siniestro", "count"),
                alertas_rojas=("nivel_riesgo", lambda s: int((s == "rojo").sum())),
                score_promedio=("score_riesgo", "mean"),
            )
            .sort_values(["alertas_rojas", "score_promedio"], ascending=False)
            .head(10)
            .reset_index()
        )
        return ranking.to_string(index=False), ["provider_ranking", "claims_scores"]

    if "documento" in normalized or "documentos" in normalized or "faltan" in normalized:
        critical = scored_claims[
            (scored_claims["nivel_riesgo"].isin(["rojo", "amarillo"]))
            & ((scored_claims["documentos_completos"].astype(str).str.lower() != "si") | (scored_claims["documentos_inconsistentes"].astype(str).str.lower() == "si"))
        ].sort_values("score_riesgo", ascending=False)
        columns = ["id_siniestro", "beneficiario", "score_riesgo", "nivel_riesgo", "documentos_completos", "documentos_inconsistentes", "explicacion"]
        return critical[columns].head(10).to_string(index=False), ["document_review", "rules_engine", "claims_scores"]

    if any(term in normalized for term in ["monto", "montos", "atipico", "atípico"]):
        amount_cases = scored_claims.sort_values(["ratio_monto_suma", "monto_reclamado", "score_riesgo"], ascending=False)
        columns = ["id_siniestro", "beneficiario", "monto_reclamado", "suma_asegurada", "ratio_monto_suma", "score_riesgo", "nivel_riesgo", "explicacion"]
        return amount_cases[columns].head(10).to_string(index=False), ["amount_outliers", "claims_scores"]

    if any(term in normalized for term in ["inicio de la poliza", "inicio de póliza", "inicio poliza", "vigencia"]):
        near_start = scored_claims.sort_values(["dias_desde_inicio_poliza", "score_riesgo"], ascending=[True, False])
        columns = ["id_siniestro", "id_poliza", "beneficiario", "dias_desde_inicio_poliza", "score_riesgo", "nivel_riesgo", "explicacion"]
        return near_start[columns].head(10).to_string(index=False), ["policy_timing", "rules_engine", "claims_scores"]

    if "asegurado" in normalized or "asegurados" in normalized or "frecuencia" in normalized:
        insured = (
            scored_claims.groupby("id_asegurado")
            .agg(
                total_casos=("id_siniestro", "count"),
                max_historial=("historial_siniestros_asegurado", "max"),
                casos_rojos=("nivel_riesgo", lambda s: int((s == "rojo").sum())),
                score_promedio=("score_riesgo", "mean"),
            )
            .sort_values(["max_historial", "total_casos", "score_promedio"], ascending=False)
            .reset_index()
        )
        insured["score_promedio"] = insured["score_promedio"].round(2)
        return insured.head(10).to_string(index=False), ["insured_frequency", "claims_scores"]

    if any(term in normalized for term in ["patron", "patrón", "patrones", "repiten", "repetidos"]):
        alert_counts: dict[str, int] = {}
        for alerts in scored_claims["alertas"]:
            for alert in alerts:
                code = alert.get("code", "SIN-CODIGO")
                alert_counts[code] = alert_counts.get(code, 0) + 1
        patterns = {
            "alertas_repetidas": sorted(alert_counts.items(), key=lambda item: item[1], reverse=True)[:10],
            "proveedores_prioritarios": (
                scored_claims.groupby("beneficiario")
                .agg(total_casos=("id_siniestro", "count"), score_promedio=("score_riesgo", "mean"))
                .sort_values(["total_casos", "score_promedio"], ascending=False)
                .round(2)
                .head(5)
                .reset_index()
                .to_dict(orient="records")
            ),
            "senales_narrativas": scored_claims["senales_narrativa"].explode().dropna().value_counts().head(10).to_dict(),
        }
        return str(patterns), ["pattern_summary", "rules_engine", "narrative_signals", "provider_ranking"]

    if "mayor riesgo" in normalized or "top" in normalized or "10" in normalized:
        top = scored_claims.sort_values("score_riesgo", ascending=False).head(10)
        columns = ["id_siniestro", "beneficiario", "ciudad", "cobertura", "score_riesgo", "nivel_riesgo", "explicacion"]
        return top[columns].to_string(index=False), ["top_claims", "claims_scores", "rules_engine"]

    if "ciudad" in normalized or "ciudades" in normalized:
        cities = (
            scored_claims.groupby("ciudad")
            .agg(total_casos=("id_siniestro", "count"), score_promedio=("score_riesgo", "mean"))
            .sort_values("score_promedio", ascending=False)
            .reset_index()
        )
        return cities.to_string(index=False), ["city_summary", "claims_scores"]

    summary = {
        "total_siniestros": int(len(scored_claims)),
        "casos_rojos": int((scored_claims["nivel_riesgo"] == "rojo").sum()),
        "casos_amarillos": int((scored_claims["nivel_riesgo"] == "amarillo").sum()),
        "casos_verdes": int((scored_claims["nivel_riesgo"] == "verde").sum()),
        "score_promedio": round(float(scored_claims["score_riesgo"].mean()), 2),
    }
    return str(summary), ["portfolio_summary", "claims_scores"]


def _find_claim_id(question: str, scored_claims: pd.DataFrame) -> str | None:
    ids = scored_claims["id_siniestro"].astype(str).str.lower()
    for claim_id in ids:
        if claim_id in question:
            return claim_id
    return None


def _is_explanation_question(question: str) -> bool:
    normalized = question.lower()
    return any(
        term in normalized
        for term in [
            "por que",
            "porque",
            "explica",
            "explicame",
            "que paso",
            "rojo",
            "alto riesgo",
            "marcado",
            "razon",
        ]
    )


def _build_claim_compact_context(claim: pd.Series) -> str:
    alerts = claim.get("alertas", []) or []
    rules_points = sum(int(alert.get("points", 0)) for alert in alerts)
    model_points = max(0, int(claim.get("score_riesgo", 0)) - rules_points)
    top_alerts = alerts[:6]
    alert_summary = "; ".join(
        f"{alert.get('code')} {alert.get('name')} (+{alert.get('points')})"
        for alert in top_alerts
    )
    ratio = float(claim.get("ratio_monto_suma", 0) or 0)
    return (
        f"id={claim.get('id_siniestro')}; nivel={claim.get('nivel_riesgo')}; score={claim.get('score_riesgo')}/100; "
        f"cobertura={claim.get('cobertura')}; proveedor={claim.get('beneficiario')}; ciudad={claim.get('ciudad')}; "
        f"monto_reclamado={claim.get('monto_reclamado')}; suma_asegurada={claim.get('suma_asegurada')}; "
        f"ratio_monto_suma={round(ratio, 3)}; documentos_completos={claim.get('documentos_completos')}; "
        f"documentos_inconsistentes={claim.get('documentos_inconsistentes')}; "
        f"dias_desde_inicio_poliza={claim.get('dias_desde_inicio_poliza')}; "
        f"dias_entre_ocurrencia_reporte={claim.get('dias_entre_ocurrencia_reporte')}; "
        f"historial_asegurado={claim.get('historial_siniestros_asegurado')}; "
        f"historial_vehiculo={claim.get('historial_siniestros_vehiculo')}; "
        f"casos_proveedor={claim.get('casos_observados_proveedor')}; "
        f"senales_narrativa={claim.get('senales_narrativa')}; "
        f"puntos_reglas={rules_points}; puntos_ia_ml_aprox={model_points}; "
        f"principales_alertas={alert_summary}; "
        f"explicacion_motor={claim.get('explicacion')}"
    )
