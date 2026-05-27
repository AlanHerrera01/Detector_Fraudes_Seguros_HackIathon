# FraudIA Claims

Backend para el reto **Detector de Posibles Fraudes en Siniestros usando Inteligencia Artificial**.

La solucion genera alertas de revision, no acusaciones automaticas de fraude. Combina reglas de negocio, scoring de riesgo, un modelo de IA sencillo y un agente conversacional con Gemini para explicar resultados.

## Stack

- Python 3.11 o 3.12 recomendado
- Python
- FastAPI
- Pandas
- Scikit-learn
- Gemini API
- Pytest

## Instalacion

> Recomendado: usar **Python 3.11**. Python 3.12 tambien funciona. Evita Python 3.14 por ahora, porque algunas dependencias de datos como `pandas` y `scikit-learn` pueden intentar compilarse localmente y fallar en Windows.

```bash
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Configura `GEMINI_API_KEY` en `.env` si quieres usar Gemini. Si no hay API key, el agente usa una respuesta local de respaldo.

## Ejecucion

```bash
uvicorn src.app.main:app --reload
```

Luego abre:

```text
http://127.0.0.1:8000/docs
```

## Endpoints principales

- `GET /health`
- `POST /claims/upload`
- `GET /claims`
- `GET /claims/{id_siniestro}`
- `POST /claims/{id_siniestro}/score`
- `GET /alerts/top`
- `GET /providers/ranking`
- `GET /stats/summary`
- `POST /agent/query`

Ejemplo de consulta al agente:

```json
{
  "question": "Que proveedores concentran mas alertas rojas?"
}
```

## Estructura

```text
data/
  raw/
  processed/
  synthetic/
src/
  ingestion/
  features/
  rules/
  models/
  explainability/
  ai_agent/
  app/
docs/
tests/
presentation/
```

## Principio etico

El score es una priorizacion operativa para analistas. No reemplaza revision humana, no rechaza siniestros automaticamente y no confirma fraude.
