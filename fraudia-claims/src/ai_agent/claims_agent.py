import unicodedata

import pandas as pd

from src.ai_agent.gemini_service import ask_ai_model


def answer_question(question: str, scored_claims: pd.DataFrame, provider: str | None = None, claim_id: str | None = None) -> dict:
    """Responde preguntas del analista usando solo contexto derivado del dataset."""
    context, sources = build_context(question, scored_claims, claim_id)
    answer, used_provider = ask_ai_model(question, context, provider)
    return {"answer": answer, "sources": sources, "provider": used_provider}


def build_context(question: str, scored_claims: pd.DataFrame, claim_id: str | None = None) -> tuple[str, list[str]]:
    """Selecciona el contexto mas relevante antes de llamar al agente IA.

    Este ruteo simple evita enviar todo el dataset a Gemini y mantiene las
    respuestas trazables a fuentes internas como ranking, top casos o resumen.
    """
    normalized = _normalize_question(question)

    if _is_smalltalk(normalized):
        context = (
            "El usuario solo esta saludando o iniciando conversacion. "
            "Responde en maximo 35 palabras, cordial y natural. "
            "No listes muchas opciones; ofrece ayuda con siniestros, proveedores, documentos, scores o alertas. "
            "No uses datos del portafolio para este saludo."
        )
        return context, ["system"]

    matched_id = str(claim_id).lower() if claim_id else _find_claim_id(normalized, scored_claims)
    if matched_id:
        match = scored_claims[scored_claims["id_siniestro"].astype(str).str.lower() == matched_id]
        if match.empty and claim_id:
            context = (
                f"El usuario esta viendo el siniestro {claim_id}, pero ese ID no existe en el dataset activo. "
                "Indicale que actualice la lista o seleccione un caso del archivo activo antes de explicar el color."
            )
            return context, ["system", "active_claim_not_found"]
        if match.empty:
            matched_id = _find_claim_id(normalized, scored_claims)
            match = scored_claims[scored_claims["id_siniestro"].astype(str).str.lower() == matched_id] if matched_id else match
        claim = match.iloc[0] if not match.empty else None
    else:
        claim = None

    if claim is not None:
        context = (
            "Ficha compacta del siniestro para que la IA explique causalmente el nivel de riesgo. "
            "El usuario esta viendo este caso en pantalla, asi que interpreta su pregunta con este siniestro como contexto activo. "
            "Explica tecnicamente: umbral del semaforo, score total, puntos por reglas, componente ML aproximado, reglas activadas y validacion recomendada. "
            "No copies todo; interpreta los factores clave.\n"
            f"{_build_claim_compact_context(claim)}"
        )
        return _with_response_goal(context, "explicar_siniestro"), ["claim_detail", "rules_engine", "narrative_signals", "claims_scores"]

    inferred_claim = _infer_claim_from_risk_question(normalized, scored_claims)
    if inferred_claim is not None:
        context = (
            "Ficha compacta del siniestro inferido por la pregunta sobre color/nivel de riesgo. "
            "Explica tecnicamente: umbral del semaforo, score total, puntos por reglas, componente ML aproximado, reglas activadas y validacion recomendada. "
            "Si hubo inferencia, dilo brevemente.\n"
            f"{_build_claim_compact_context(inferred_claim)}"
        )
        return _with_response_goal(context, "explicar_siniestro"), ["claim_detail", "rules_engine", "risk_thresholds", "claims_scores"]

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
        context = "\n".join(
            [
                "resumen_portafolio:",
                _portfolio_metrics(scored_claims),
                "top_casos:",
                _compact_claim_table(top, max_rows=5),
                "proveedores_prioritarios:",
                _compact_table(provider.round({"score_promedio": 2}), max_rows=3),
                "recomendacion: Priorizar revision humana de casos rojos y concentraciones por proveedor.",
            ]
        )
        return _with_response_goal(context, "resumen_ejecutivo"), ["portfolio_summary", "top_claims", "provider_ranking", "ethics_guardrail"]

    if any(term in normalized for term in ["recomienda", "revisar primero", "prioridad", "priorizar"]):
        top = scored_claims.sort_values("score_riesgo", ascending=False).head(10)
        return _with_response_goal(_compact_claim_table(top, max_rows=10), "priorizar_revision"), ["top_claims", "claims_scores", "rules_engine"]

    if any(term in normalized for term in ["narrativa", "nlp", "descripcion", "texto"]):
        nlp = scored_claims[scored_claims["senales_narrativa"].apply(lambda value: len(value) > 0)]
        columns = ["id_siniestro", "beneficiario", "score_riesgo", "nivel_riesgo", "senales_narrativa"]
        return _with_response_goal(_compact_table(nlp.sort_values("score_riesgo", ascending=False), columns, max_rows=10), "senales_narrativas"), ["narrative_signals", "claims_scores"]

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
        return _with_response_goal(_compact_table(ramo_summary.sort_values(["porcentaje_sospechoso", "score_promedio"], ascending=False), max_rows=10), "ranking_ramos"), ["line_of_business_summary", "claims_scores"]

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
        return _with_response_goal(_compact_table(ranking, max_rows=10), "ranking_proveedores"), ["provider_ranking", "claims_scores"]

    if "documento" in normalized or "documentos" in normalized or "faltan" in normalized:
        critical = scored_claims[
            (scored_claims["nivel_riesgo"].isin(["rojo", "amarillo"]))
            & ((scored_claims["documentos_completos"].astype(str).str.lower() != "si") | (scored_claims["documentos_inconsistentes"].astype(str).str.lower() == "si"))
        ].sort_values("score_riesgo", ascending=False)
        critical = critical.assign(alertas_clave=critical["alertas"].apply(_alert_codes))
        columns = ["id_siniestro", "beneficiario", "score_riesgo", "nivel_riesgo", "documentos_completos", "documentos_inconsistentes", "alertas_clave"]
        return _with_response_goal(_compact_table(critical, columns, max_rows=10), "documentos_criticos"), ["document_review", "rules_engine", "claims_scores"]

    if any(term in normalized for term in ["monto", "montos", "atipico", "atípico"]):
        amount_cases = scored_claims.sort_values(["ratio_monto_suma", "monto_reclamado", "score_riesgo"], ascending=False)
        columns = ["id_siniestro", "beneficiario", "monto_reclamado", "suma_asegurada", "ratio_monto_suma", "score_riesgo", "nivel_riesgo"]
        return _with_response_goal(_compact_table(amount_cases, columns, max_rows=10), "montos_atipicos"), ["amount_outliers", "claims_scores"]

    if any(term in normalized for term in ["inicio de la poliza", "inicio de póliza", "inicio poliza", "vigencia"]):
        near_start = scored_claims.sort_values(["dias_desde_inicio_poliza", "score_riesgo"], ascending=[True, False])
        columns = ["id_siniestro", "id_poliza", "beneficiario", "dias_desde_inicio_poliza", "score_riesgo", "nivel_riesgo"]
        return _with_response_goal(_compact_table(near_start, columns, max_rows=10), "inicio_poliza"), ["policy_timing", "rules_engine", "claims_scores"]

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
        return _with_response_goal(_compact_table(insured, max_rows=10), "frecuencia_asegurados"), ["insured_frequency", "claims_scores"]

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
        return _with_response_goal(str(patterns), "patrones_repetidos"), ["pattern_summary", "rules_engine", "narrative_signals", "provider_ranking"]

    if "mayor riesgo" in normalized or "top" in normalized or "10" in normalized:
        top = scored_claims.sort_values("score_riesgo", ascending=False).head(10)
        columns = ["id_siniestro", "beneficiario", "ciudad", "cobertura", "score_riesgo", "nivel_riesgo", "explicacion"]
        return _with_response_goal(_compact_claim_table(top, max_rows=10), "top_riesgo"), ["top_claims", "claims_scores", "rules_engine"]

    if "ciudad" in normalized or "ciudades" in normalized:
        cities = (
            scored_claims.groupby("ciudad")
            .agg(total_casos=("id_siniestro", "count"), score_promedio=("score_riesgo", "mean"))
            .sort_values("score_promedio", ascending=False)
            .reset_index()
        )
        return _with_response_goal(_compact_table(cities, max_rows=10), "ranking_ciudades"), ["city_summary", "claims_scores"]

    summary = {
        "total_siniestros": int(len(scored_claims)),
        "casos_rojos": int((scored_claims["nivel_riesgo"] == "rojo").sum()),
        "casos_amarillos": int((scored_claims["nivel_riesgo"] == "amarillo").sum()),
        "casos_verdes": int((scored_claims["nivel_riesgo"] == "verde").sum()),
        "score_promedio": round(float(scored_claims["score_riesgo"].mean()), 2),
    }
    return _with_response_goal("; ".join(f"{key}={value}" for key, value in summary.items()), "resumen_portafolio"), ["portfolio_summary", "claims_scores"]


def _find_claim_id(question: str, scored_claims: pd.DataFrame) -> str | None:
    ids = scored_claims["id_siniestro"].astype(str).str.lower()
    for claim_id in ids:
        if claim_id in question:
            return claim_id
    return None


def _normalize_question(question: str) -> str:
    normalized = unicodedata.normalize("NFD", question.lower())
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def _is_smalltalk(question: str) -> bool:
    cleaned = question.strip(" .,!¡?¿")
    greetings = {
        "hola",
        "buenas",
        "buenos dias",
        "buenas tardes",
        "buenas noches",
        "hey",
        "hi",
        "hello",
        "gracias",
        "ok",
        "listo",
    }
    return cleaned in greetings


def _smalltalk_answer() -> str:
    return (
        "Hola, soy el asistente de FraudIA. ¿Qué necesitas revisar?\n"
        "- Explicar el score o semáforo de este siniestro.\n"
        "- Ver los casos con mayor riesgo.\n"
        "- Revisar proveedores, documentos, montos atípicos o patrones.\n"
        "- Generar un resumen ejecutivo para comité."
    )


def _with_response_goal(context: str, goal: str) -> str:
    return f"objetivo={goal}; formato=fluido_tecnico\n{context}"


def _portfolio_metrics(scored_claims: pd.DataFrame) -> str:
    return (
        f"total={len(scored_claims)}; "
        f"rojos={int((scored_claims['nivel_riesgo'] == 'rojo').sum())}; "
        f"amarillos={int((scored_claims['nivel_riesgo'] == 'amarillo').sum())}; "
        f"verdes={int((scored_claims['nivel_riesgo'] == 'verde').sum())}; "
        f"score_promedio={round(float(scored_claims['score_riesgo'].mean()), 2)}"
    )


def _compact_claim_table(claims: pd.DataFrame, max_rows: int = 10) -> str:
    compact = claims.copy()
    compact["alertas_clave"] = compact["alertas"].apply(_alert_codes)
    columns = ["id_siniestro", "score_riesgo", "nivel_riesgo", "beneficiario", "ciudad", "cobertura", "alertas_clave"]
    return _compact_table(compact, columns, max_rows=max_rows)


def _compact_table(df: pd.DataFrame, columns: list[str] | None = None, max_rows: int = 10) -> str:
    if df.empty:
        return "sin_resultados"
    selected_columns = columns or list(df.columns)
    selected_columns = [column for column in selected_columns if column in df.columns]
    rows = [" | ".join(selected_columns)]
    for _, row in df.head(max_rows)[selected_columns].iterrows():
        rows.append(" | ".join(_format_context_value(row[column]) for column in selected_columns))
    return "\n".join(rows)


def _format_context_value(value) -> str:
    if isinstance(value, float):
        value = round(value, 2)
    if isinstance(value, list):
        value = ",".join(str(item) for item in value[:4])
    text = str(value).replace("\n", " ").strip()
    return text[:90] + "..." if len(text) > 90 else text


def _alert_codes(alerts) -> str:
    if not isinstance(alerts, list):
        return ""
    codes = [str(alert.get("code", "")) for alert in alerts[:4] if isinstance(alert, dict)]
    return ",".join(code for code in codes if code)


def _infer_claim_from_risk_question(question: str, scored_claims: pd.DataFrame) -> pd.Series | None:
    if not _is_explanation_question(question) and not any(term in question for term in ["amarillo", "rojo", "verde", "color", "semaforo", "semáforo", "nivel"]):
        return None

    level = None
    for candidate in ["rojo", "amarillo", "verde"]:
        if candidate in question:
            level = candidate
            break

    if level:
        matches = scored_claims[scored_claims["nivel_riesgo"].astype(str).str.lower() == level]
        if len(matches) >= 1:
            return matches.sort_values("score_riesgo", ascending=False).iloc[0]
        return None

    if len(scored_claims) == 1:
        return scored_claims.iloc[0]

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
