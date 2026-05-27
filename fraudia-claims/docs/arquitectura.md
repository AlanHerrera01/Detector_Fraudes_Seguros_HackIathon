# Arquitectura

La arquitectura sigue la estructura sugerida por el documento del reto.

```text
Cliente o dashboard
  -> FastAPI
    -> ingestion/load_data.py
    -> features/build_features.py
    -> features/text_analysis.py
    -> rules/fraud_rules.py
    -> models/fraud_model.py
    -> explainability/explain_score.py
    -> ai_agent/claims_agent.py
      -> ai_agent/gemini_service.py
```

El backend calcula el score de forma trazable. Gemini se usa para comunicacion en lenguaje natural, resumen ejecutivo y explicaciones para el analista.

## Flujo

1. Se carga un CSV de siniestros.
2. Se validan columnas minimas.
3. Se calculan variables de riesgo.
4. Se extraen senales NLP desde la narrativa del siniestro.
5. Se aplican reglas de negocio y reglas narrativas.
6. Se calcula un complemento de riesgo con IA.
7. Se genera score de 0 a 100.
8. Se asigna semaforo: verde, amarillo o rojo.
9. Se exponen explicaciones ejecutivas, redes de proveedores y agente conversacional.
