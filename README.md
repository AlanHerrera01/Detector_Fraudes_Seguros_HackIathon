# FraudIA - Detector de Fraudes en Siniestros

Proyecto desarrollado para el reto **Detector de Posibles Fraudes en Siniestros usando Inteligencia Artificial**.

FraudIA ayuda a priorizar casos de siniestros que requieren revision humana. La solucion combina reglas de negocio, analisis de narrativa, scoring de riesgo, reportes ejecutivos y una interfaz web para que un analista pueda revisar cada caso con trazabilidad.

> Importante: FraudIA no confirma fraude ni debe usarse para rechazar siniestros automaticamente. El sistema genera alertas de revision y explicaciones para apoyar la decision humana.

## Equipo

**Java con Vodka**

Integrantes:

- Cesar Arico
- Josue Zambrano
- Alan Herrera

Estudiantes de la **Universidad de las Fuerzas Armadas ESPE**.

## Estructura del Proyecto

```text
Detector_Fraudes_Seguros_HackIathon/
  fraudia-claims/   Backend FastAPI, motor de reglas, scoring, IA y reportes
  fraudia-front/    Frontend React/Vite para la demo web
  README.md         Documentacion principal del proyecto
```

## Backend: `fraudia-claims`

El backend expone una API REST con FastAPI. Procesa datasets CSV de siniestros, calcula features, aplica reglas de fraude, genera score de riesgo, clasifica cada caso por semaforo y produce explicaciones ejecutivas.

Funciones principales:

- Carga de siniestros desde CSV.
- Analisis narrativo NLP local.
- Reglas de negocio trazables.
- Score de riesgo de 0 a 100.
- Semaforo: verde, amarillo y rojo.
- Explicacion ejecutiva por siniestro.
- Ranking de proveedores.
- Reportes de auditoria en JSON, CSV y PDF.
- Agente IA con Gemini.

Instalacion:

```bash
cd fraudia-claims
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

El archivo `.env.example` es la plantilla documentada y se puede subir al repositorio. El archivo `.env` es local y privado: ahi van tokens reales de Gemini y PostgreSQL. No debe compartirse ni commitearse.

Ejecucion:

```bash
cd fraudia-claims
py -3.11 -m uvicorn src.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Documentacion de la API:

```text
http://127.0.0.1:8000/docs
```

Pruebas:

```bash
cd fraudia-claims
py -3.11 -m pytest -q
```

Endpoints destacados:

- `GET /health`
- `GET /claims`
- `GET /claims/{id_siniestro}`
- `GET /claims/{id_siniestro}/explanation`
- `POST /claims/upload`
- `GET /stats/summary`
- `GET /providers/ranking`
- `GET /networks/providers`
- `GET /reports/audit`
- `GET /reports/audit.csv`
- `GET /reports/audit.pdf`
- `POST /agent/query`

Proveedor disponible para el agente:

- `gemini`

Para usar Gemini, agrega en `fraudia-claims/.env`:

```text
GEMINI_API_KEY=tu_api_key
AI_PROVIDER=gemini
```

## Frontend: `fraudia-front`

El frontend es una aplicacion React con Vite para operar la demo de FraudIA. Consume la API del backend y presenta los casos en una experiencia visual para analistas.

Funciones principales:

- Dashboard ejecutivo.
- Lista de siniestros con filtros.
- Vista Caso 360.
- Score y semaforo de riesgo.
- Resumen ejecutivo visual.
- Narrativa del reclamo y senales NLP.
- Alertas activadas por reglas RF, S y NLP.
- Checklist de analista.
- Ranking y redes de proveedores.
- Carga de CSV/PDF.
- Agente IA conversacional.

Instalacion:

```bash
cd fraudia-front
npm install
copy .env.example .env
```

En el frontend solo deben existir variables publicas con prefijo `VITE_`. Las API keys de IA no van en `fraudia-front/.env`; deben quedarse en el `.env` del backend.

Variables esperadas:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_API_KEY=
VITE_USE_MOCK=false
```

Ejecucion:

```bash
cd fraudia-front
npm run dev
```

Aplicacion web:

```text
http://localhost:3000
```

Build:

```bash
cd fraudia-front
npm run build
```

## Flujo de Demo Recomendado

1. Levantar el backend en `http://127.0.0.1:8000`.
2. Levantar el frontend en `http://localhost:3000`.
3. Entrar al dashboard para ver el resumen del portafolio.
4. Abrir la lista de siniestros y seleccionar un caso.
5. Revisar el Caso 360: score, resumen ejecutivo, narrativa, senales NLP y alertas.
6. Consultar proveedores o redes de riesgo.
7. Usar el agente IA para pedir explicaciones o resumen para comite.
8. Exportar reportes de auditoria si se requiere evidencia.

## Uso Responsable

FraudIA esta disenado como herramienta de apoyo. Sus resultados deben interpretarse como priorizacion operativa:

- No confirma fraude.
- No reemplaza al analista.
- No debe negar automaticamente un reclamo.
- Puede generar falsos positivos o falsos negativos.
- Toda decision debe validar soportes, fechas, proveedor, narrativa y documentos.

## Tecnologias

Backend:

- Python 3.11
- FastAPI
- Pandas
- Scikit-learn
- Pytest
- Gemini API

Frontend:

- React
- Vite
- JavaScript
- CSS inline orientado a componentes

## Estado Final de Ejecucion Local

Para dejar el entorno cerrado, detener los servidores si estan corriendo:

```bash
# Backend: puerto 8000
# Frontend: puerto 3000
```

En Windows se puede revisar con:

```bash
netstat -ano | findstr ":8000 :3000"
```

Y detener el proceso correspondiente con:

```bash
Stop-Process -Id <PID> -Force
```
