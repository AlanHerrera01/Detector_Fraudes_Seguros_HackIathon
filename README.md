# FraudIA - Detector de Posibles Fraudes en Siniestros

FraudIA es una plataforma de analisis de siniestros que prioriza casos con senales de posible fraude para revision humana. Combina reglas explicables, machine learning tabular, NLP sobre narrativas y un agente conversacional con Gemini para ayudar al analista a entender riesgos, patrones y casos prioritarios.

> FraudIA no confirma fraude, no acusa asegurados y no debe rechazar siniestros automaticamente. Su salida es una alerta operativa para investigacion humana.

## Equipo

**Java con Vodka**  
Universidad de las Fuerzas Armadas ESPE

- Cesar Arico
- Josue Zambrano
- Alan Herrera

## Que Resuelve

- Detecta senales de riesgo en siniestros cargados por CSV o Excel.
- Analiza narrativas de reclamo con NLP transparente.
- Calcula un score de riesgo de 0 a 100.
- Clasifica cada caso en verde, amarillo o rojo.
- Explica por que un caso fue marcado.
- Permite consultar el portafolio con un agente IA.
- Exporta reportes de auditoria en CSV/PDF.
- Mantiene historico para aprendizaje acumulativo del componente ML.

## Arquitectura

```text
Detector_Fraudes_Seguros_HackIathon/
  fraudia-claims/   Backend FastAPI, reglas, ML, NLP, agente IA, reportes y PostgreSQL
  fraudia-front/    Frontend React/Vite para dashboard, Caso 360, reportes y agente
  README.md         Vision general del proyecto
```

## IA Hibrida

FraudIA usa una arquitectura hibrida:

- **Reglas de negocio**: alertas RF, S y NLP trazables.
- **ML tabular**: `RandomForestClassifier` cuando hay etiqueta; `IsolationForest` como fallback sin etiquetas.
- **NLP reproducible**: deteccion de narrativa vaga, sensible, inconsistente o repetida.
- **LLM conversacional**: Gemini responde preguntas del analista usando solo contexto calculado por el backend.
- **Explicabilidad**: resumen ejecutivo, senales principales, acciones recomendadas y nota etica.

## Flujo De Datos

1. El usuario sube CSV, Excel o PDF.
2. CSV/Excel actualiza el dataset activo visible.
3. El backend guarda historico en PostgreSQL o CSV local.
4. El score visible se calcula sobre el archivo activo.
5. El componente ML puede entrenar/comparar con historico acumulado.
6. El dashboard, reportes y agente responden sobre el archivo activo.
7. El analista revisa casos prioritarios y valida soportes.

## Carga De Archivos

- **CSV**: dataset estructurado de siniestros.
- **Excel `.xlsx/.xls`**: soporta hojas y encabezados humanos; detecta la hoja de siniestros y normaliza columnas.
- **PDF**: soporte documental; extrae texto y senales narrativas, no reemplaza el dataset tabular.

Columnas minimas esperadas o equivalentes:

```text
id_siniestro, id_poliza, id_asegurado, ramo, cobertura,
fecha_ocurrencia, fecha_reporte, monto_reclamado, descripcion
```

## Backend

```bash
cd fraudia-claims
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
py -3.11 -m uvicorn src.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

Pruebas:

```bash
cd fraudia-claims
$env:PYTHONPATH='.'
pytest -q
```

## Frontend

```bash
cd fraudia-front
npm install
copy .env.example .env
npm run dev
```

App:

```text
http://localhost:3000
```

## Variables Importantes

Backend:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=tu_api_key
GEMINI_MODEL=gemini-2.5-flash
DB_ENABLED=true
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=fraudia_claims
DB_USER=postgres
DB_PASSWORD=tu_password
```

Frontend:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_USE_MOCK=false
```

Nunca subir `.env` reales al repositorio.

## Funcionalidades Del Frontend

- Dashboard ejecutivo con estado del portafolio y tendencia por color.
- Tarjetas con explicacion visible de cada indicador.
- Bandeja de siniestros con filtros, busqueda y paginacion 10/25/50/100.
- Caso 360 con resumen ejecutivo, score, alertas y checklist.
- Metricas de modelo, NLP y validacion con reglas.
- Ranking de proveedores y concentraciones.
- Carga de CSV, Excel y PDF.
- Agente IA conversacional con contexto del caso activo.

## Endpoints Destacados

- `GET /health`
- `GET /db/status`
- `POST /db/init`
- `POST /claims/upload`
- `GET /claims`
- `GET /claims/{id_siniestro}`
- `GET /claims/{id_siniestro}/explanation`
- `GET /stats/summary`
- `GET /model/metrics`
- `GET /providers/ranking`
- `GET /networks/providers`
- `GET /reports/audit`
- `GET /reports/audit.csv`
- `GET /reports/audit.pdf`
- `POST /agent/query`

## Despliegue Sugerido

Para produccion/demo publica:

- Google Cloud Compute Engine con Ubuntu.
- Docker + Dokploy.
- PostgreSQL gestionado por Dokploy o contenedor.
- Backend en `api.tudominio.com`.
- Frontend en `fraudia.tudominio.com`.
- Variables configuradas desde Dokploy.
- HTTPS habilitado desde el proxy de Dokploy.

## Uso Responsable

FraudIA es una herramienta de apoyo:

- No confirma fraude.
- No reemplaza investigacion humana.
- No debe negar automaticamente un siniestro.
- Puede generar falsos positivos o falsos negativos.
- Toda decision debe validar documentos, fechas, proveedor, narrativa y soportes.

## Estado Del Proyecto

MVP funcional con backend, frontend, carga de archivos, scoring explicable, aprendizaje acumulativo, reportes, dashboard y agente IA.
