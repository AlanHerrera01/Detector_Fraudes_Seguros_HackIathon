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

## Cumplimiento de requisitos minimos

| Categoria | Estado | Evidencia |
| --- | --- | --- |
| Lenguaje | Cumple | Proyecto implementado en Python. |
| Base de datos o archivos planos | Cumple | Dataset CSV sintetico en `data/synthetic/siniestros_sinteticos.csv`. |
| Repositorio | Cumple si se publica o se da acceso al jurado | Repositorio Git con estructura versionable. |
| Documentacion | Cumple | `README.md` y documentos en `docs/` sobre arquitectura, modelo de datos, reglas, limitaciones y uso de IA. |
| Codigo modular | Cumple | Modulos separados para ingestion, features, reglas, modelo, explicabilidad, agente IA y API. |
| Interfaz o demo funcional | Cumple | API web FastAPI con Swagger en `/docs`, explicacion ejecutiva y analisis de redes. |
| Dependencias | Cumple | `requirements.txt`. |
| Configuracion | Cumple | `.env.example`; no incluir `.env` real en el repo. |

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

## Pruebas

```bash
pytest -q
```

## Endpoints principales

- `GET /health`
- `POST /claims/upload`
- `GET /claims`
- `GET /claims/{id_siniestro}`
- `POST /claims/{id_siniestro}/score`
- `GET /claims/{id_siniestro}/explanation`
- `GET /alerts/top`
- `GET /providers/ranking`
- `GET /networks/providers`
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

Ver tambien `docs/etica_sesgos.md` para riesgos, sesgos y controles de uso responsable.
