# FraudIA - Detector de Posibles Fraudes en Siniestros

FraudIA es una plataforma web para priorizar siniestros con senales de posible fraude en seguros. Integra reglas de negocio explicables, analisis tabular, NLP sobre narrativas, machine learning y un agente conversacional con Gemini para que un analista pueda revisar casos de riesgo con trazabilidad.

> FraudIA no confirma fraude, no acusa asegurados y no debe rechazar siniestros automaticamente. El sistema genera alertas operativas para revision humana, validacion documental y toma de decisiones responsable.

## Despliegue Actual

El proyecto esta preparado y desplegado con una arquitectura cloud moderna para que funcione desde cualquier dispositivo con navegador:

- **Frontend en Vercel**: interfaz React/Vite disponible desde web, adaptable a escritorio, tablet y movil.
- **Backend en Railway**: API FastAPI publica para scoring, carga de archivos, reportes, explicaciones y agente IA.
- **Base de datos en Neon**: PostgreSQL gestionado para persistencia, historico de cargas y consulta de datos.

Esta separacion permite que la aplicacion sea consumida desde cualquier equipo sin instalar el backend localmente, siempre que las variables de entorno de Vercel, Railway y Neon esten configuradas correctamente.

## Equipo

**Java con Vodka**  
Universidad de las Fuerzas Armadas ESPE

- Cesar Arico
- Josue Zambrano
- Alan Herrera

## Problema Que Resuelve

En aseguradoras y equipos de auditoria, revisar todos los siniestros manualmente consume tiempo y puede hacer que casos relevantes pasen desapercibidos. FraudIA ayuda a:

- Detectar patrones de posible fraude en datasets de siniestros.
- Priorizar casos rojos y amarillos para investigacion humana.
- Explicar por que un siniestro fue marcado.
- Identificar proveedores, beneficiarios o redes con concentraciones inusuales.
- Generar reportes de auditoria en JSON, CSV y PDF.
- Consultar el portafolio mediante un agente IA con contexto controlado.
- Mantener historico para mejorar el analisis acumulativo.

## Funcionalidades Principales

- Carga de archivos CSV, Excel y PDF.
- Normalizacion de columnas con encabezados humanos.
- Score de riesgo de 0 a 100.
- Semaforo operativo: verde, amarillo y rojo.
- Reglas de negocio explicables con codigos RF, S y NLP.
- Analisis de narrativa para detectar descripciones vagas, sensibles, repetidas o inconsistentes.
- Modelo ML supervisado cuando existe etiqueta de fraude simulada.
- Deteccion de anomalias cuando no hay etiqueta disponible.
- Dashboard ejecutivo con KPIs, tendencias y ranking de proveedores.
- Bandeja de siniestros con busqueda, filtros y paginacion.
- Vista Caso 360 con detalle completo del siniestro.
- Reportes tecnicos y ejecutivos para auditoria.
- Agente IA con Gemini para preguntas sobre casos, patrones y resumenes.

## Arquitectura Del Proyecto

```text
Detector_Fraudes_Seguros_HackIathon/
  README.md                 Documentacion general del proyecto
  railway.json              Configuracion de despliegue Railway para backend
  fraudia-claims/           Backend FastAPI, reglas, ML, NLP, IA, reportes y PostgreSQL
  fraudia-front/            Frontend React/Vite para dashboard, reportes, carga y agente IA
```

## Arquitectura Cloud

```text
Usuario / Navegador
        |
        v
Vercel - fraudia-front
        |
        v
Railway - fraudia-claims FastAPI
        |
        v
Neon - PostgreSQL
        |
        v
Gemini API - agente IA
```

## Flujo De Uso

1. El usuario entra al frontend desplegado en Vercel.
2. El frontend consume la API del backend desplegado en Railway.
3. El usuario carga un CSV, Excel o PDF.
4. CSV/Excel se convierten en dataset activo para dashboard, reportes y agente.
5. El backend calcula score, reglas, NLP, anomalias y explicaciones.
6. Si PostgreSQL esta activo, Neon guarda historico y ultimo batch.
7. El analista revisa dashboard, Caso 360, proveedores y reportes.
8. El agente IA responde preguntas usando el contexto calculado por el backend.

## IA Hibrida

FraudIA usa una estrategia hibrida, pensada para ser explicable ante un jurado o equipo de auditoria:

- **Reglas de negocio**: alertas trazables por documentos, fechas, proveedor, frecuencia y narrativa.
- **ML tabular**: `RandomForestClassifier` cuando existe etiqueta; `IsolationForest` como respaldo sin etiqueta.
- **NLP reproducible**: analisis transparente sobre texto del reclamo.
- **LLM conversacional**: Gemini responde preguntas del analista con contexto limitado al portafolio analizado.
- **Explicabilidad**: cada caso incluye resumen ejecutivo, senales principales, recomendacion operativa y nota etica.

## Requisitos Locales

Para ejecutar todo en local necesitas:

- Python 3.11 recomendado.
- Node.js 18 o superior.
- npm.
- PostgreSQL local opcional, o una base Neon remota.
- Una API key de Gemini si se desea usar el agente IA real.

El proyecto puede funcionar sin PostgreSQL usando almacenamiento local CSV, y puede funcionar sin Gemini mostrando mensajes de configuracion para el agente.

## Instalacion Completa En Local

Clona el repositorio y entra a la carpeta principal:

```bash
git clone <url-del-repositorio>
cd Detector_Fraudes_Seguros_HackIathon
```

### 1. Backend

```bash
cd fraudia-claims
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edita `fraudia-claims/.env` con tus valores locales. Para iniciar rapido sin base de datos:

```env
DB_ENABLED=false
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
```

Ejecuta la API:

```bash
$env:PYTHONPATH='.'
uvicorn src.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Swagger local:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
http://127.0.0.1:8000/health
```

### 2. Frontend

En otra terminal:

```bash
cd fraudia-front
npm install
copy .env.example .env
```

Configura `fraudia-front/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_USE_MOCK=false
```

Ejecuta la aplicacion:

```bash
npm run dev
```

App local:

```text
http://localhost:3000
```

## Variables De Entorno Principales

Backend:

```env
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://tu-frontend.vercel.app
CORS_ORIGIN_REGEX=https://.*\.vercel\.app
AI_PROVIDER=gemini
GEMINI_API_KEY=tu_api_key
GEMINI_MODEL=gemini-2.5-flash
DB_ENABLED=true
DB_HOST=tu-host-neon
DB_PORT=5432
DB_NAME=tu_base
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_SCHEMA=public
DB_TABLE=siniestros
```

Frontend:

```env
VITE_API_BASE_URL=https://tu-backend.railway.app
VITE_API_KEY=
VITE_USE_MOCK=false
```

Nunca subas archivos `.env` reales al repositorio. Las llaves de Gemini y credenciales de Neon deben vivir solo en variables de entorno locales o del proveedor cloud.

## Despliegue En Produccion

### Backend En Railway

1. Crear un proyecto en Railway.
2. Conectar el repositorio.
3. Configurar el servicio apuntando al backend `fraudia-claims`.
4. Usar Python y el comando:

```bash
python -m uvicorn src.app.main:app --host 0.0.0.0 --port $PORT
```

5. Configurar variables de entorno del backend.
6. Validar `GET /health`.
7. Copiar la URL publica de Railway para usarla en Vercel.

El repositorio incluye `railway.json`, `fraudia-claims/railpack.json` y `fraudia-claims/Procfile` como apoyo para el despliegue.

### Base De Datos En Neon

1. Crear un proyecto PostgreSQL en Neon.
2. Copiar host, database, user, password y puerto.
3. Configurar esas credenciales en Railway.
4. Activar:

```env
DB_ENABLED=true
```

5. Reiniciar el servicio backend.
6. Ejecutar o visitar el endpoint:

```text
POST /db/init
```

Este endpoint crea tablas base y siembra datos iniciales si corresponde.

### Frontend En Vercel

1. Crear un proyecto en Vercel.
2. Conectar el repositorio.
3. Configurar el directorio de build como `fraudia-front`.
4. Usar:

```text
Build Command: npm run build
Output Directory: dist
```

5. Configurar:

```env
VITE_API_BASE_URL=https://tu-backend.railway.app
VITE_USE_MOCK=false
```

6. Agregar el dominio de Vercel en `CORS_ORIGINS` del backend en Railway.
7. Redeplegar backend y frontend.

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
- `GET /reports/filters`
- `GET /reports/audit`
- `GET /reports/audit.csv`
- `GET /reports/audit.pdf`
- `POST /agent/query`

## Pruebas

Backend:

```bash
cd fraudia-claims
$env:PYTHONPATH='.'
pytest -q
```

Frontend:

```bash
cd fraudia-front
npm run lint
npm run build
```

## Documentacion Complementaria

El backend incluye documentos tecnicos adicionales en `fraudia-claims/docs/`:

- `arquitectura.md`
- `modelo_datos.md`
- `reglas_negocio.md`
- `uso_ia.md`
- `etica_sesgos.md`
- `limitaciones.md`

## Uso Responsable

FraudIA debe usarse como herramienta de apoyo, no como sistema de decision automatica. Toda alerta debe ser revisada por una persona, contrastando documentos, fechas, proveedor, narrativa, historial, cobertura y soportes.

## Estado Del Proyecto

MVP funcional con backend, frontend, carga de archivos, scoring explicable, historico, PostgreSQL, reportes, dashboard, ranking de proveedores y agente IA. El despliegue esta orientado a Railway, Vercel y Neon para disponibilidad web desde cualquier dispositivo.
