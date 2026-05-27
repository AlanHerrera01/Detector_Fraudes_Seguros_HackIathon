# Arquitectura

La arquitectura sigue la estructura sugerida por el documento del reto.

```text
Cliente o dashboard
  -> FastAPI
    -> ingestion/load_data.py
    -> features/build_features.py
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
4. Se aplican reglas de negocio.
5. Se calcula un complemento de riesgo con IA.
6. Se genera score de 0 a 100.
7. Se asigna semaforo: verde, amarillo o rojo.
8. El agente responde preguntas usando los datos puntuados.
