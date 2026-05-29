# Uso de IA

La solucion usa IA en dos niveles:

1. Modelo de riesgo:
   - Si existe `etiqueta_fraude_simulada`, se usa `RandomForestClassifier`.
   - Si no existe etiqueta util, se puede usar deteccion de anomalias con `IsolationForest`.

2. Agente conversacional con Gemini y respaldo local opcional:
   - Responde preguntas del analista.
   - Explica casos de alto riesgo.
   - Resume proveedores, ciudades y casos prioritarios.
   - Usa `gemini` como proveedor principal.
   - Puede usar Qwen 2.5 3B local via Ollama si Gemini falla y `LOCAL_LLM_ENABLED=true`.
   - Mantiene lenguaje etico: alerta o posible fraude, no acusacion.

3. Analisis NLP reproducible:
   - Extrae senales desde `descripcion`.
   - Detecta narrativa vaga, inconsistente o con terminos de alto riesgo.
   - Calcula similitud textual con `TF-IDF + cosine similarity` para encontrar narrativas muy parecidas sin usar tokens.
   - Usa reglas transparentes para que la demo funcione aun sin credenciales.

El agente conversacional no calcula el score final. El score lo calcula el backend para mantener trazabilidad. Si Gemini falla o no tiene credenciales, puede intentar Qwen local si esta habilitado.

## Proveedores conversacionales

- `gemini`: usa `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_SECONDS` y `GEMINI_MAX_CONTEXT_CHARS`.
- `local:qwen2.5:3b`: respaldo automatico con Ollama cuando `LOCAL_LLM_ENABLED=true`.
- Futuras implementaciones comentadas en codigo: `github` y `openai`.

Para usar Qwen local:

```bash
ollama run qwen2.5:3b
```

Y en `.env`:

```text
LOCAL_LLM_ENABLED=true
LOCAL_LLM_MODEL=qwen2.5:3b
LOCAL_LLM_ENDPOINT=http://127.0.0.1:11434/api/generate
```

El endpoint `POST /agent/query` acepta:

```json
{
  "question": "Que proveedor concentra mas alertas rojas?",
  "provider": "gemini"
}
```

## Metricas de evaluacion

El endpoint `GET /model/metrics` expone:

- Precision, recall, F1-score, matriz de confusion y AUC-ROC cuando existe `etiqueta_fraude_simulada`.
- Porcentaje de casos marcados y ranking de anomalias por score.
- Senales NLP mas frecuentes y porcentaje de casos con narrativa relevante.
- Similitud textual local: pares de narrativas similares, porcentaje de casos similares y extractos comparables.
- Validacion de reglas: promedio de alertas por caso y casos sin/con alertas.
