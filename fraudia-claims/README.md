# FraudIA Claims - Backend

Backend FastAPI para analizar siniestros, calcular riesgo, explicar alertas y responder consultas del agente IA.

La API procesa CSV, Excel y PDF. CSV/Excel actualizan el dataset activo; PDF se usa como soporte narrativo. El backend mantiene historico en PostgreSQL o CSV local para mejorar el componente ML sin mezclar visualmente archivos anteriores en el dashboard.

## Stack

- Python 3.11 recomendado
- FastAPI
- Pandas
- Scikit-learn
- PostgreSQL opcional
- Gemini API
- Ollama + Qwen opcional como respaldo local
- Pytest

## Capacidades

- Ingestion de CSV y Excel con normalizacion de encabezados.
- Seleccion automatica de hoja de siniestros en Excel.
- Analisis de PDF como soporte narrativo.
- Features de riesgo tabular.
- Reglas explicables RF, S y NLP.
- ML supervisado con `RandomForestClassifier` si hay etiqueta.
- Deteccion de anomalias con `IsolationForest` si no hay etiqueta.
- NLP transparente para narrativa vaga, sensible, inconsistente o clonada.
- Score final 0-100 y semaforo verde/amarillo/rojo.
- Explicacion ejecutiva por siniestro.
- Metricas tecnicas para jurado.
- Reportes JSON, CSV y PDF.
- Agente IA con Gemini.

## Instalacion Local

```bash
cd fraudia-claims
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Evita Python 3.14 para este proyecto: algunas librerias de datos pueden intentar compilarse en Windows.

## Variables

Configura `fraudia-claims/.env`. No subir este archivo al repositorio.

Gemini:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=tu_api_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_SECONDS=12
GEMINI_MAX_CONTEXT_CHARS=6000
GEMINI_MAX_OUTPUT_TOKENS=700
```

PostgreSQL:

```env
DB_ENABLED=true
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=fraudia_claims
DB_USER=postgres
DB_PASSWORD=tu_password
```

Qwen local opcional:

```env
LOCAL_LLM_ENABLED=true
LOCAL_LLM_MODEL=qwen2.5:3b
LOCAL_LLM_ENDPOINT=http://127.0.0.1:11434/api/generate
```

## Ejecucion

```bash
cd fraudia-claims
$env:PYTHONPATH='.'
uvicorn src.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

## Pruebas

```bash
cd fraudia-claims
$env:PYTHONPATH='.'
pytest -q
```

## Ingestion

Formatos soportados:

- `.csv`
- `.xlsx`
- `.xls`
- `.pdf`

Columnas minimas o equivalentes:

```text
id_siniestro, id_poliza, id_asegurado, ramo, cobertura,
fecha_ocurrencia, fecha_reporte, monto_reclamado, descripcion
```

El loader reconoce encabezados como:

- `ID Siniestro`
- `ID Poliza`
- `ID Asegurado`
- `Fecha Ocurrencia`
- `Monto Reclamado ($)`
- `Descripcion del Evento`

## Historico Y Aprendizaje

El sistema separa dos conceptos:

- **Dataset activo**: archivo que el usuario acaba de subir y que se muestra en dashboard/agente/reportes.
- **Historico acumulado**: cargas anteriores guardadas para entrenar o comparar el componente ML.

Con PostgreSQL activo:

- Se guarda cada upload como batch.
- El dashboard ve el ultimo batch activo.
- El ML puede entrenar con todo el historico.

Sin PostgreSQL:

- Se guarda historico local en `data/processed/upload_history.csv`.
- Se guarda el activo local en `data/processed/active_upload.csv`.

`data/processed/` esta ignorado por git.

## Endpoints

- `GET /health`
- `GET /db/status`
- `POST /db/init`
- `POST /claims/upload`
- `GET /claims?limit=500`
- `GET /claims/{id_siniestro}`
- `POST /claims/{id_siniestro}/score`
- `GET /claims/{id_siniestro}/explanation`
- `GET /alerts/top`
- `GET /providers/ranking`
- `GET /networks/providers`
- `GET /stats/summary`
- `GET /model/metrics`
- `GET /reports/filters`
- `GET /reports/audit`
- `GET /reports/audit.csv`
- `GET /reports/audit.pdf`
- `POST /agent/query`

Ejemplo agente:

```json
{
  "question": "Cuales son los 10 siniestros con mayor riesgo de posible fraude?",
  "provider": "gemini"
}
```

## Metricas

`GET /model/metrics` devuelve:

- Total de casos evaluados.
- Porcentaje marcado amarillo/rojo.
- Distribucion de riesgo.
- Ranking de anomalias.
- NLP narrativo.
- Validacion con reglas.
- Metricas supervisadas si existe `etiqueta_fraude_simulada` con mas de una clase.

Si no hay etiqueta, el panel indicara que no hay evaluacion supervisada disponible, pero el sistema sigue priorizando con reglas, NLP y anomalias.

## Estructura

```text
src/
  app/              FastAPI y endpoints
  ai_agent/         Agente Gemini/Qwen y fallback estructurado
  db/               PostgreSQL e historico
  explainability/   Explicaciones ejecutivas
  features/         Features tabulares y NLP
  ingestion/        Carga CSV/Excel/PDF e historico local
  models/           ML y metricas
  rules/            Reglas de fraude explicables
tests/              Pruebas unitarias
docs/               Arquitectura, etica y uso IA
data/               Datos sinteticos y carpetas locales
```

## Etica

El backend nunca debe afirmar fraude confirmado. Usa lenguaje de alerta, riesgo o revision humana. Ver `docs/etica_sesgos.md`.
