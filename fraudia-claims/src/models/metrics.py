import pandas as pd
from sklearn.metrics import auc, confusion_matrix, f1_score, precision_score, recall_score, roc_curve
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from src.features.text_analysis import normalize_text


def model_metrics(scored_claims: pd.DataFrame) -> dict:
    """Calcula metricas tecnicas para evaluar el prototipo de scoring."""
    y_pred = scored_claims["nivel_riesgo"].isin(["amarillo", "rojo"]).astype(int)
    metrics = {
        "total_casos": int(len(scored_claims)),
        "porcentaje_casos_marcados": round(float(y_pred.mean() * 100), 2),
        "distribucion_riesgo": scored_claims["nivel_riesgo"].value_counts().to_dict(),
        "distribucion_clasificacion": scored_claims["clasificacion_riesgo"].value_counts().to_dict()
        if "clasificacion_riesgo" in scored_claims.columns
        else {},
        "ranking_anomalias": _top_anomalies(scored_claims),
        "metricas_nlp": _nlp_metrics(scored_claims),
        "validacion_reglas": _rules_validation(scored_claims),
    }

    if "etiqueta_fraude_simulada" in scored_claims.columns and scored_claims["etiqueta_fraude_simulada"].nunique() > 1:
        y_true = scored_claims["etiqueta_fraude_simulada"].astype(int)
        fpr, tpr, _ = roc_curve(y_true, scored_claims["score_riesgo"])
        metrics["modelo_supervisado"] = {
            "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
            "f1_score": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
            "auc_roc": round(float(auc(fpr, tpr)), 4),
            "matriz_confusion": confusion_matrix(y_true, y_pred).tolist(),
            "umbral_operativo": "amarillo_o_rojo",
        }
    else:
        metrics["modelo_supervisado"] = {
            "disponible": False,
            "motivo": "No existe etiqueta_fraude_simulada con mas de una clase.",
        }

    return metrics


def _top_anomalies(scored_claims: pd.DataFrame) -> list[dict]:
    columns = ["id_siniestro", "beneficiario", "score_riesgo", "nivel_riesgo", "explicacion"]
    return scored_claims.sort_values("score_riesgo", ascending=False).head(10)[columns].to_dict(orient="records")


def _nlp_metrics(scored_claims: pd.DataFrame) -> dict:
    exploded = scored_claims["senales_narrativa"].explode().dropna()
    cases_with_nlp = scored_claims["senales_narrativa"].apply(lambda value: len(value) > 0)
    similarity = _text_similarity_metrics(scored_claims)
    return {
        "casos_con_senales_narrativa": int(cases_with_nlp.sum()),
        "porcentaje_casos_con_senales_narrativa": round(float(cases_with_nlp.mean() * 100), 2),
        "senales_mas_frecuentes": exploded.value_counts().head(10).to_dict(),
        "similitud_textual": similarity,
        "criterio_calidad_extraccion": "Reglas transparentes sobre narrativa: vaguedad, terminos sensibles e inconsistencias.",
    }


def _text_similarity_metrics(scored_claims: pd.DataFrame, threshold: float = 0.82) -> dict:
    if "descripcion" not in scored_claims.columns or scored_claims.empty:
        return _empty_similarity_metrics(threshold, "No hay columna descripcion para evaluar similitud textual.")

    narratives = scored_claims[["id_siniestro", "descripcion"]].copy()
    narratives["texto_normalizado"] = narratives["descripcion"].apply(normalize_text)
    narratives = narratives[narratives["texto_normalizado"].str.len() >= 12].reset_index(drop=True)
    if len(narratives) < 2:
        return _empty_similarity_metrics(threshold, "Se requieren al menos dos narrativas utiles.")

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
    matrix = vectorizer.fit_transform(narratives["texto_normalizado"])
    scores = cosine_similarity(matrix)

    pairs = []
    case_ids_with_match = set()
    for i in range(len(narratives)):
        for j in range(i + 1, len(narratives)):
            score = float(scores[i, j])
            if score < threshold:
                continue
            left = str(narratives.loc[i, "id_siniestro"])
            right = str(narratives.loc[j, "id_siniestro"])
            case_ids_with_match.update([left, right])
            pairs.append(
                {
                    "id_siniestro_a": left,
                    "id_siniestro_b": right,
                    "similitud_coseno": round(score, 4),
                    "extracto_a": _preview(narratives.loc[i, "descripcion"]),
                    "extracto_b": _preview(narratives.loc[j, "descripcion"]),
                }
            )

    pairs = sorted(pairs, key=lambda item: item["similitud_coseno"], reverse=True)[:10]
    return {
        "metodo": "tfidf_cosine_similarity",
        "umbral_similitud": threshold,
        "narrativas_evaluadas": int(len(narratives)),
        "pares_similares": int(len(pairs)),
        "casos_con_narrativa_similar": int(len(case_ids_with_match)),
        "porcentaje_casos_con_narrativa_similar": round(float(len(case_ids_with_match) / len(narratives) * 100), 2),
        "top_pares_similares": pairs,
        "nota": "Metrica local sin consumo de tokens; ayuda a detectar relatos clonados o muy parecidos.",
    }


def _empty_similarity_metrics(threshold: float, reason: str) -> dict:
    return {
        "metodo": "tfidf_cosine_similarity",
        "umbral_similitud": threshold,
        "narrativas_evaluadas": 0,
        "pares_similares": 0,
        "casos_con_narrativa_similar": 0,
        "porcentaje_casos_con_narrativa_similar": 0,
        "top_pares_similares": [],
        "nota": reason,
    }


def _preview(value: object, max_chars: int = 120) -> str:
    text = str(value or "").replace("\n", " ").strip()
    return text[:max_chars] + "..." if len(text) > max_chars else text


def _rules_validation(scored_claims: pd.DataFrame) -> dict:
    alert_count = scored_claims["alertas"].apply(len)
    marked = scored_claims["nivel_riesgo"].isin(["amarillo", "rojo"])
    return {
        "promedio_alertas_por_caso": round(float(alert_count.mean()), 2),
        "promedio_alertas_casos_marcados": round(float(alert_count[marked].mean()), 2) if marked.any() else 0,
        "casos_sin_alertas": int((alert_count == 0).sum()),
        "casos_con_alertas": int((alert_count > 0).sum()),
    }
