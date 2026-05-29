# FraudIA Claims - Backend

Backend FastAPI de FraudIA. Este servicio recibe archivos de siniestros, normaliza datos, calcula scores de riesgo, aplica reglas explicables, ejecuta analisis NLP, genera reportes, administra historico en PostgreSQL/Neon y expone un agente IA con Gemini.

> El backend entrega senales de posible fraude para revision humana. No confirma fraude, no acusa personas y no toma decisiones automaticas de rechazo.

## Stack Tecnico

- Python 3.11 recomendado.
- FastAPI.
- Uvicorn.
- Pandas y NumPy.
- Scikit-learn.
- PostgreSQL con `psycopg`.
- Google Gemini.
- Pytest.
- Railway para despliegue cloud.
- Neon como PostgreSQL gestionado.

## Capacidades

- API REST documentada con Swagger.
- Carga de `.csv`, `.xlsx`, `.xls` y `.pdf`.
- Deteccion automatica de hojas utiles en Excel.
- Normalizacion de columnas con nombres humanos.
- Dataset activo para dashboard, reportes y agente.
- Historico acumulado en PostgreSQL o CSV local.
- Reglas de fraude explicables por codigos.
- Scoring final de 0 a 100.
- Clasificacion operativa verde, amarillo y rojo.
- NLP para narrativa vaga, sensible, repetida, similar o inconsistente.
- ML persistente con `model.pkl` y `RandomForestClassifier` si hay etiqueta.
- Deteccion de anomalias con `IsolationForest` si no hay etiqueta suficiente.
- Explicacion ejecutiva por siniestro.
- Reportes de auditoria en JSON, CSV y PDF.
- Ranking y redes de proveedores.
- Agente IA conversacional con Gemini.

## Estructura

```text
fraudia-claims/
  README.md
  requirements.txt
  Procfile
  railpack.json
  .env.example
  src/
    app/              FastAPI y endpoints
    ai_agent/         Gemini, fallback estructurado y contexto del agente
    db/               PostgreSQL, Neon e historico
    explainability/   Explicaciones ejecutivas
    features/         Scoring, features y NLP
    ingestion/        Carga CSV, Excel, PDF e historico local
    models/           Modelos y metricas
    rules/            Reglas de negocio
  data/
    synthetic/        Datasets sinteticos de prueba
    models/           Modelo persistente entrenado localmente
  docs/               Documentacion tecnica
  tests/              Pruebas unitarias
```

## Instalacion Local

En Windows/PowerShell:

```bash
cd fraudia-claims
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Evita Python 3.14 para este proyecto en Windows, porque algunas librerias de datos pueden requerir compilacion o no tener binarios compatibles.

## Configuracion Local Rapida

Edita `fraudia-claims/.env`. Para levantar el backend sin base de datos y con datos locales:

```env
APP_ENV=local
DEFAULT_DATA_PATH=data/synthetic/siniestros_sinteticos.csv
DB_ENABLED=false
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CORS_ORIGIN_REGEX=https://.*\.vercel\.app
```

Si no configuras `GEMINI_API_KEY`, el backend puede seguir funcionando para scoring y reportes, pero el agente IA no tendra respuesta real de Gemini.

## Ejecucion Local

```bash
cd fraudia-claims
.venv\Scripts\activate
$env:PYTHONPATH='.'
uvicorn src.app.main:app --host 127.0.0.1 --port 8000 --reload
```

URLs locales:

```text
API:      http://127.0.0.1:8000
Swagger:  http://127.0.0.1:8000/docs
Health:   http://127.0.0.1:8000/health
DB:       http://127.0.0.1:8000/db/status
```

## Variables De Entorno

### Aplicacion y CORS

```env
APP_ENV=local
DEFAULT_DATA_PATH=data/synthetic/siniestros_sinteticos.csv
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://tu-frontend.vercel.app
CORS_ORIGIN_REGEX=https://.*\.vercel\.app
```

`CORS_ORIGINS` debe incluir el dominio real del frontend en Vercel cuando se despliega.

### Gemini

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=tu_api_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_SECONDS=8
GEMINI_MAX_CONTEXT_CHARS=6000
GEMINI_MAX_OUTPUT_TOKENS=875
GEMINI_TEMPERATURE=0.45
GEMINI_TOP_P=0.9
GEMINI_VERIFY_SSL=true
```

### Modelo ML Persistente

```env
FRAUDIA_MODEL_PATH=data/models/model.pkl
```

Si esta variable no se define, el backend usa `data/models/model.pkl` por defecto.

### PostgreSQL Local O Neon

```env
DB_ENABLED=true
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=fraudia_claims
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here
DB_SCHEMA=public
DB_TABLE=siniestros
```

Para Neon, reemplaza `DB_HOST`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` por los valores entregados por Neon.

### Qwen Local Opcional

```env
LOCAL_LLM_ENABLED=false
LOCAL_LLM_MODEL=qwen2.5:3b
LOCAL_LLM_ENDPOINT=http://127.0.0.1:11434/api/generate
LOCAL_LLM_TIMEOUT_SECONDS=45
```

Este respaldo requiere Ollama instalado y el modelo descargado. No es necesario para el flujo principal con Gemini.

## Base De Datos

El backend soporta dos modos:

- **CSV local**: ideal para desarrollo rapido. Se usa cuando `DB_ENABLED=false`.
- **PostgreSQL/Neon**: recomendado para demo desplegada y persistencia. Se usa cuando `DB_ENABLED=true`.

Inicializar base:

```bash
curl -X POST http://127.0.0.1:8000/db/init
```

Tambien puedes ejecutar el endpoint desde Swagger en:

```text
http://127.0.0.1:8000/docs
```

El inicializador crea la tabla principal, tablas complementarias y carga datos sinteticos si la tabla esta vacia.

## Ingestion De Archivos

Formatos soportados:

- `.csv`: dataset estructurado de siniestros.
- `.xlsx` y `.xls`: dataset estructurado con hojas y encabezados humanos.
- `.pdf`: soporte documental; se extrae texto y se calculan senales narrativas, pero no reemplaza el dataset tabular.

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
- `Fecha Reporte`
- `Monto Reclamado ($)`
- `Descripcion del Evento`

## Historico Y Dataset Activo

El sistema separa dos conceptos:

- **Dataset activo**: ultimo archivo CSV/Excel cargado. Es lo que ve el dashboard, reportes y agente.
- **Historico acumulado**: cargas anteriores almacenadas para aprendizaje y comparacion.

Con PostgreSQL/Neon:

- Cada carga se guarda como batch.
- El dashboard consulta el ultimo batch activo.
- Las metricas pueden usar historico acumulado.
- Los reportes pueden filtrar por batch, fecha o proveedor.

Sin PostgreSQL:

- El historico se guarda en `data/processed/upload_history.csv`.
- El activo se guarda en `data/processed/active_upload.csv`.
- `data/processed/` debe permanecer fuera de git.

## Entrenamiento ML Persistente

El backend usa un enfoque hibrido:

- Reglas explicables y NLP calculan senales trazables.
- El modelo ML suma un componente de riesgo de hasta 25 puntos.
- Si existe `data/models/model.pkl`, el scoring lo reutiliza.
- Si hay historico con `etiqueta_fraude_simulada`, el backend puede actualizar el modelo supervisado.
- Si no hay etiquetas suficientes, usa `IsolationForest` como respaldo de anomalias.

Entrenar o regenerar el modelo:

```bash
cd fraudia-claims
.venv\Scripts\activate
$env:PYTHONPATH='.'
py -3.11 scripts/train_model.py data/synthetic/fraudia_dataset_01_bajo_riesgo_operativo_2026.xlsx data/synthetic/fraudia_dataset_02_mixto_multiramo_2026.xlsx data/synthetic/fraudia_dataset_03_red_proveedores_recurrentes_2026.xlsx data/synthetic/fraudia_dataset_04_nlp_narrativas_sospechosas_2026.xlsx
```

Salida esperada:

```text
Modelo guardado en: ...\data\models\model.pkl
Tipo: supervised_random_forest
Filas de entrenamiento: ...
Etiquetas supervisadas: si
```

Esto no reemplaza las reglas; las complementa. El score final sigue siendo explicable y limitado a `0/100`.

## Metricas NLP Sin Consumo De Tokens

El endpoint `GET /model/metrics` incluye una seccion `metricas_nlp` con:

- Casos con senales narrativas.
- Porcentaje de casos con narrativa marcada.
- Senales narrativas mas frecuentes.
- Similitud textual local con `TF-IDF + cosine similarity`.
- Top de pares de siniestros con narrativas muy parecidas.

La similitud textual se calcula en el backend con Scikit-learn, sin llamar a Gemini y sin consumir tokens. Sirve para detectar relatos clonados o demasiado parecidos dentro del archivo activo.

Como mejora futura se puede agregar evaluacion automatica de coherencia de resumen con LLM, pero se deja fuera del flujo principal para controlar consumo de tokens y evitar llamadas masivas cuando hay muchos siniestros.

## Endpoints

### Salud y base de datos

- `GET /health`
- `GET /db/status`
- `POST /db/init`

### Siniestros

- `POST /claims/upload`
- `GET /claims?limit=500`
- `GET /claims/{id_siniestro}`
- `POST /claims/{id_siniestro}/score`
- `GET /claims/{id_siniestro}/explanation`

### Alertas, proveedores y redes

- `GET /alerts/top`
- `GET /providers/ranking`
- `GET /networks/providers`

### Estadisticas, modelo y reportes

- `GET /stats/summary`
- `GET /model/metrics`
- `GET /reports/filters`
- `GET /reports/audit`
- `GET /reports/audit.csv`
- `GET /reports/audit.pdf`

### Agente IA

- `POST /agent/query`

Ejemplo:

```json
{
  "question": "Cuales son los 10 siniestros con mayor riesgo de posible fraude?",
  "provider": "gemini"
}
```

## Pruebas

```bash
cd fraudia-claims
.venv\Scripts\activate
$env:PYTHONPATH='.'
pytest -q
```

Las pruebas cubren reglas, scoring, explicabilidad, NLP, contexto del agente e historico local.

## Despliegue En Railway

El backend esta preparado para Railway. Comando de inicio:

```bash
python -m uvicorn src.app.main:app --host 0.0.0.0 --port $PORT
```

Pasos recomendados:

1. Crear un servicio en Railway conectado al repositorio.
2. Configurar el root del servicio en `fraudia-claims` si Railway no lo detecta automaticamente.
3. Agregar las variables de entorno del backend.
4. Configurar credenciales de Neon.
5. Activar `DB_ENABLED=true`.
6. Desplegar.
7. Verificar `https://tu-backend.railway.app/health`.
8. Ejecutar `POST /db/init`.
9. Agregar el dominio de Vercel en `CORS_ORIGINS`.

Archivos relacionados:

- `../railway.json`
- `railpack.json`
- `Procfile`

## Configuracion Con Neon

Variables tipicas en Railway:

```env
DB_ENABLED=true
DB_HOST=ep-xxxx.region.aws.neon.tech
DB_PORT=5432
DB_NAME=neondb
DB_USER=neondb_owner
DB_PASSWORD=tu_password_neon
DB_SCHEMA=public
DB_TABLE=siniestros
```

Si Neon entrega una cadena de conexion completa, separa los valores en las variables anteriores porque el backend usa host, puerto, base, usuario y password por separado.

## Buenas Practicas

- No subir `.env`.
- No exponer `GEMINI_API_KEY` en el frontend.
- Configurar CORS con dominios concretos.
- Validar `/health` despues de cada despliegue.
- Ejecutar pruebas antes de una demo.
- Mantener lenguaje de riesgo y revision humana, no de fraude confirmado.

## Documentacion Tecnica

Consulta `docs/` para mas detalle:

- `arquitectura.md`
- `modelo_datos.md`
- `reglas_negocio.md`
- `uso_ia.md`
- `etica_sesgos.md`
- `limitaciones.md`
