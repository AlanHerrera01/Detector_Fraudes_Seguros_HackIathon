import pandas as pd

from src.models.metrics import model_metrics


def test_model_metrics_reports_text_similarity_pairs():
    df = pd.DataFrame(
        [
            {
                "id_siniestro": "SIN-1",
                "descripcion": "Robo del vehiculo sin testigos en estacionamiento del centro comercial.",
                "nivel_riesgo": "rojo",
                "clasificacion_riesgo": "critico",
                "score_riesgo": 90,
                "senales_narrativa": ["robo", "sin testigos"],
                "alertas": [{"code": "NLP-03"}],
                "explicacion": "Caso critico.",
                "beneficiario": "Taller Centro",
            },
            {
                "id_siniestro": "SIN-2",
                "descripcion": "Robo del vehiculo sin testigos en estacionamiento del centro comercial.",
                "nivel_riesgo": "amarillo",
                "clasificacion_riesgo": "medio",
                "score_riesgo": 70,
                "senales_narrativa": ["robo", "sin testigos"],
                "alertas": [{"code": "NLP-03"}],
                "explicacion": "Caso medio.",
                "beneficiario": "Taller Centro",
            },
            {
                "id_siniestro": "SIN-3",
                "descripcion": "Choque leve con parte policial y fotografias completas.",
                "nivel_riesgo": "verde",
                "clasificacion_riesgo": "bajo",
                "score_riesgo": 15,
                "senales_narrativa": [],
                "alertas": [],
                "explicacion": "Caso bajo.",
                "beneficiario": "Taller Norte",
            },
        ]
    )

    similarity = model_metrics(df)["metricas_nlp"]["similitud_textual"]

    assert similarity["metodo"] == "tfidf_cosine_similarity"
    assert similarity["pares_similares"] >= 1
    assert similarity["casos_con_narrativa_similar"] == 2
