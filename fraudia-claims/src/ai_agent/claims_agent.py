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

    if any(term in normalized for term in ["narrativa", "nlp", "descripcion", "texto"]):
        nlp = scored_claims[scored_claims["senales_narrativa"].apply(lambda value: len(value) > 0)]
        columns = ["id_siniestro", "beneficiario", "score_riesgo", "nivel_riesgo", "senales_narrativa", "explicacion"]
        return nlp.sort_values("score_riesgo", ascending=False).head(10)[columns].to_string(index=False), ["narrative_signals", "claims_scores"]

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

    if "mayor riesgo" in normalized or "top" in normalized or "10" in normalized:
        top = scored_claims.sort_values("score_riesgo", ascending=False).head(10)
        columns = ["id_siniestro", "beneficiario", "ciudad", "cobertura", "score_riesgo", "nivel_riesgo", "explicacion"]
        return top[columns].to_string(index=False), ["claims_scores", "rules_engine"]

    if "ciudad" in normalized or "ciudades" in normalized:
        cities = (
            scored_claims.groupby("ciudad")
            .agg(total_casos=("id_siniestro", "count"), score_promedio=("score_riesgo", "mean"))
            .sort_values("score_promedio", ascending=False)
            .reset_index()
        )
        return cities.to_string(index=False), ["city_summary", "claims_scores"]

    matched_id = _find_claim_id(normalized, scored_claims)
    if matched_id:
        claim = scored_claims[scored_claims["id_siniestro"].str.lower() == matched_id].iloc[0]
        return claim[["id_siniestro", "score_riesgo", "nivel_riesgo", "alertas", "explicacion"]].to_string(), ["claim_detail", "rules_engine"]

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
