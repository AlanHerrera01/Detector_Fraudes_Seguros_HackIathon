# Uso de IA

La solucion usa IA en dos niveles:

1. Modelo de riesgo:
   - Si existe `etiqueta_fraude_simulada`, se usa `RandomForestClassifier`.
   - Si no existe etiqueta util, se puede usar deteccion de anomalias con `IsolationForest`.

2. Agente conversacional configurable:
   - Responde preguntas del analista.
   - Explica casos de alto riesgo.
   - Resume proveedores, ciudades y casos prioritarios.
   - Puede usar `gemini`, `github` o `local` por consulta.
   - Mantiene lenguaje etico: alerta o posible fraude, no acusacion.

3. Analisis NLP reproducible:
   - Extrae senales desde `descripcion`.
   - Detecta narrativa vaga, inconsistente o con terminos de alto riesgo.
   - Usa reglas transparentes para que la demo funcione aun sin credenciales.

El agente conversacional no calcula el score final. El score lo calcula el backend para mantener trazabilidad. Si el proveedor externo falla o no tiene credenciales, se usa una respuesta local de respaldo.

## Proveedores conversacionales

- `gemini`: usa `GEMINI_API_KEY`, `GEMINI_MODEL` y `GEMINI_TIMEOUT_SECONDS`.
- `github`: usa `GITHUB_MODELS_TOKEN`, `GITHUB_MODELS_MODEL=openai/gpt-5` y `GITHUB_MODELS_TIMEOUT_SECONDS`.
- `local`: no llama servicios externos; genera una respuesta reproducible con el contexto interno.

El endpoint `POST /agent/query` acepta:

```json
{
  "question": "Que proveedor concentra mas alertas rojas?",
  "provider": "github"
}
```

## Metricas de evaluacion

El endpoint `GET /model/metrics` expone:

- Precision, recall, F1-score, matriz de confusion y AUC-ROC cuando existe `etiqueta_fraude_simulada`.
- Porcentaje de casos marcados y ranking de anomalias por score.
- Senales NLP mas frecuentes y porcentaje de casos con narrativa relevante.
- Validacion de reglas: promedio de alertas por caso y casos sin/con alertas.
