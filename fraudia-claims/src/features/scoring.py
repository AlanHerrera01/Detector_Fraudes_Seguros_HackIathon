import pandas as pd

from src.explainability.explain_score import build_explanation
from src.features.build_features import build_risk_features
from src.models.fraud_model import model_risk_scores
from src.rules.fraud_rules import evaluate_claim_rules, risk_level


def score_claims(df: pd.DataFrame) -> pd.DataFrame:
    """Ejecuta el pipeline completo: features, reglas, IA y explicacion."""
    scored = build_risk_features(df)
    model_scores = model_risk_scores(scored)

    rows = []
    for idx, claim in scored.iterrows():
        alerts = evaluate_claim_rules(claim.to_dict())
        rules_score = sum(alert.points for alert in alerts)
        # El score final queda limitado a 100 para mantener una escala estable
        # y facil de explicar en la demo.
        final_score = min(100, int(round(rules_score + model_scores.loc[idx])))
        level = risk_level(final_score)
        rows.append(
            {
                "score_riesgo": final_score,
                "nivel_riesgo": level,
                "alertas": [alert.__dict__ for alert in alerts],
                "explicacion": build_explanation(str(claim["id_siniestro"]), final_score, level, alerts),
            }
        )

    return pd.concat([scored.reset_index(drop=True), pd.DataFrame(rows)], axis=1)
