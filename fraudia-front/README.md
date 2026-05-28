# FraudIA Frontend

Frontend React/Vite para operar FraudIA desde una interfaz web de analista.

La aplicacion consume el backend `fraudia-claims` y permite cargar archivos, revisar el dashboard, abrir casos individuales, consultar reportes, explorar proveedores y conversar con el agente IA.

## Stack

- React 18
- Vite
- JavaScript
- React Router
- CSS inline por componentes

## Instalacion

```bash
cd fraudia-front
npm install
copy .env.example .env
```

Variables publicas:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_API_KEY=
VITE_USE_MOCK=false
```

No poner llaves de Gemini en el frontend. Gemini se configura solo en el backend.

## Ejecucion

```bash
npm run dev
```

App local:

```text
http://localhost:3000
```

Build:

```bash
npm run build
```

## Vistas Principales

### Dashboard

Muestra la foto ejecutiva del archivo activo:

- Siniestros analizados.
- Casos criticos.
- Score promedio.
- Casos con alerta.
- Estado del portafolio por verde/amarillo/rojo.
- Tendencia diaria por color, con selector de lineas.
- Casos recientes prioritarios con scroll.
- Top proveedores.
- Riesgo por proveedor.
- Ramos y coberturas frecuentes.
- Resumen rapido del archivo.
- Concentracion por proveedor.

Cada grafica incluye texto visible explicando que representa.

### Bandeja De Siniestros

- Lista del dataset activo.
- Busqueda por ID, proveedor, ramo o cobertura.
- Filtro por nivel de riesgo.
- Paginacion configurable: 10, 25, 50 o 100.
- Acceso al detalle Caso 360.

### Caso 360

Detalle de un siniestro:

- Score y semaforo.
- Resumen ejecutivo.
- Decision operativa.
- Evidencia clave.
- Contexto del reclamo.
- Senales de score.
- Narrativa y resultado NLP.
- Alertas RF, S y NLP.
- Checklist para analista.
- Nota etica.

### Reportes

- Metricas tecnicas del modelo.
- Validacion de reglas.
- NLP narrativo.
- Ranking de anomalias.
- Reporte de auditoria.
- Descarga CSV/PDF.

### Proveedores

- Ranking de proveedores.
- Concentraciones por proveedor.
- Redes por asegurados, vehiculos, ciudades y alertas.

### Agente IA

Chat conversacional con Gemini:

- Responde preguntas del analista.
- Explica scores.
- Lista top 10 siniestros de riesgo.
- Resume patrones.
- Prepara resumen para comite.
- Usa contexto calculado por el backend.

## Carga De Archivos

Formatos soportados desde la interfaz:

- CSV: dataset estructurado.
- Excel `.xlsx/.xls`: dataset estructurado con hojas y encabezados humanos.
- PDF: soporte narrativo/documental.

Al subir CSV/Excel:

- El dashboard muestra solo el archivo activo.
- El backend guarda historico para aprendizaje acumulativo.
- El agente responde sobre el archivo activo.

## Backend Requerido

Por defecto la app apunta a:

```text
http://127.0.0.1:8000
```

Endpoints usados:

- `GET /stats/summary`
- `GET /claims`
- `GET /claims/{id_siniestro}`
- `GET /claims/{id_siniestro}/explanation`
- `POST /claims/upload`
- `GET /providers/ranking`
- `GET /networks/providers`
- `GET /reports/filters`
- `GET /reports/audit`
- `GET /model/metrics`
- `POST /agent/query`

## Modo Mock

Para presentar sin backend:

```env
VITE_USE_MOCK=true
```

## Produccion

Para Dokploy/Google Cloud:

```env
VITE_API_BASE_URL=https://api.tudominio.com
VITE_USE_MOCK=false
```

El backend debe permitir el dominio del frontend en CORS.

## Buenas Practicas

- No subir `.env`.
- No guardar llaves de IA en el frontend.
- Mantener `VITE_USE_MOCK=false` en produccion.
- Verificar que el backend responda `/health` antes de presentar.
