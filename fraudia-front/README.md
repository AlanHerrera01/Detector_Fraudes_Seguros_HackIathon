# FraudIA Frontend

Frontend React/Vite de FraudIA. Esta aplicacion entrega la interfaz web para cargar archivos, revisar dashboard, navegar siniestros, abrir Caso 360, consultar proveedores, descargar reportes y conversar con el agente IA.

La app consume el backend `fraudia-claims`, que puede ejecutarse localmente o estar desplegado en Railway. En produccion, este frontend esta orientado a Vercel para acceso desde cualquier dispositivo con navegador.

## Stack Tecnico

- React 18.
- Vite.
- JavaScript.
- React Router.
- CSS modular por componentes y estilos globales.
- Fetch API para comunicacion con FastAPI.
- Vercel para despliegue.

## Estructura

```text
fraudia-front/
  README.md
  package.json
  vite.config.js
  .env.example
  index.html
  public/
    favicon.svg
    icons.svg
  src/
    App.jsx
    main.jsx
    index.css
    App.css
    api/
      fraudApi.js
    assets/
      hero.png
    components/
      ai/
      layout/
      ui/
    hooks/
    pages/
    utils/
```

## Instalacion Local

```bash
cd fraudia-front
npm install
copy .env.example .env
```

Edita `fraudia-front/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_API_KEY=
VITE_USE_MOCK=false
```

No coloques llaves de Gemini, passwords de Neon ni secretos reales en el frontend. Todo secreto debe vivir en el backend o en variables privadas del proveedor cloud.

## Ejecucion Local

Primero levanta el backend en `http://127.0.0.1:8000`. Luego ejecuta:

```bash
npm run dev
```

App local:

```text
http://localhost:3000
```

Si el puerto cambia, Vite mostrara la nueva URL en consola.

## Scripts Disponibles

```bash
npm run dev
```

Levanta el servidor de desarrollo.

```bash
npm run build
```

Genera la version de produccion en `dist/`.

```bash
npm run preview
```

Sirve localmente el build generado para revision previa.

```bash
npm run lint
```

Ejecuta ESLint sobre el frontend.

## Variables De Entorno

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_API_KEY=
VITE_USE_MOCK=false
```

Detalle:

- `VITE_API_BASE_URL`: URL base del backend FastAPI.
- `VITE_API_KEY`: reservado para una futura proteccion del backend; actualmente puede quedar vacio.
- `VITE_USE_MOCK`: si es `true`, la interfaz usa datos simulados y no consume el backend real.

Para produccion en Vercel:

```env
VITE_API_BASE_URL=https://tu-backend.railway.app
VITE_API_KEY=
VITE_USE_MOCK=false
```

## Vistas Principales

### Dashboard

Pantalla ejecutiva inicial. Muestra:

- Total de siniestros analizados.
- Casos criticos.
- Score promedio.
- Casos con alertas.
- Distribucion por semaforo.
- Tendencia diaria por nivel de riesgo.
- Casos recientes prioritarios.
- Top proveedores.
- Riesgo por proveedor.
- Ramos y coberturas frecuentes.
- Resumen del archivo activo.
- Concentracion por proveedor.

### Siniestros

Bandeja de trabajo para analistas:

- Lista del dataset activo.
- Busqueda por ID, proveedor, ramo o cobertura.
- Filtro por nivel de riesgo.
- Paginacion configurable.
- Acceso directo al detalle del siniestro.

### Caso 360

Vista detallada de un caso:

- Score de riesgo.
- Semaforo.
- Resumen ejecutivo.
- Decision operativa sugerida.
- Evidencia clave.
- Datos principales del reclamo.
- Narrativa y senales NLP.
- Alertas aplicadas.
- Checklist para revision humana.
- Nota etica.

### Proveedores

Analisis de concentraciones:

- Ranking de proveedores.
- Alertas rojas por proveedor.
- Score promedio.
- Relaciones con asegurados, vehiculos y ciudades.
- Indicadores de concentracion.

### Reglas

Vista orientada a explicar la logica de negocio:

- Reglas RF.
- Reglas S.
- Senales NLP.
- Interpretacion operativa de alertas.

### Reportes

Modulo para auditoria:

- Metricas tecnicas del modelo.
- Validacion por reglas.
- Ranking de anomalias.
- Reporte de auditoria.
- Descarga en CSV.
- Descarga en PDF.
- Filtros por fecha, batch y proveedor cuando la base lo permite.

### Carga De Evidencia

Pantalla para subir archivos:

- CSV.
- Excel `.xlsx` o `.xls`.
- PDF.

CSV y Excel actualizan el dataset activo. PDF se analiza como soporte documental y no reemplaza el dataset tabular.

### Agente IA

Chat con Gemini a traves del backend:

- Responde preguntas del analista.
- Explica scores.
- Lista siniestros prioritarios.
- Resume patrones.
- Ayuda a preparar resumenes para comite.
- Usa contexto calculado por el backend.

## Backend Requerido

Por defecto:

```text
http://127.0.0.1:8000
```

Endpoints consumidos:

- `GET /stats/summary`
- `GET /claims`
- `GET /claims/{id_siniestro}`
- `GET /claims/{id_siniestro}/explanation`
- `POST /claims/upload`
- `GET /providers/ranking`
- `GET /networks/providers`
- `GET /reports/filters`
- `GET /reports/audit`
- `GET /reports/audit.csv`
- `GET /reports/audit.pdf`
- `GET /model/metrics`
- `POST /agent/query`

## Modo Mock

Para presentar la interfaz sin backend:

```env
VITE_USE_MOCK=true
```

Usa este modo solo para demo visual. Para probar carga real, reportes y agente IA, debe estar en:

```env
VITE_USE_MOCK=false
```

## Build De Produccion

```bash
cd fraudia-front
npm install
npm run build
```

El resultado queda en:

```text
dist/
```

Puedes revisarlo con:

```bash
npm run preview
```

## Despliegue En Vercel

Pasos recomendados:

1. Crear un proyecto en Vercel.
2. Conectar el repositorio.
3. Configurar el directorio raiz del proyecto como `fraudia-front`.
4. Configurar:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

5. Agregar variables de entorno:

```env
VITE_API_BASE_URL=https://tu-backend.railway.app
VITE_API_KEY=
VITE_USE_MOCK=false
```

6. Desplegar.
7. Copiar la URL de Vercel.
8. Agregar esa URL al `CORS_ORIGINS` del backend en Railway.
9. Redeplegar el backend.
10. Probar dashboard, carga, reportes y agente.

## Integracion Con Railway Y Neon

El frontend no se conecta directamente a Neon. El flujo correcto es:

```text
Vercel frontend -> Railway backend -> Neon PostgreSQL
```

Esto evita exponer credenciales de base de datos en el navegador y mantiene la logica de negocio centralizada en FastAPI.

## Solucion De Problemas

Si el dashboard no carga:

- Verifica `VITE_API_BASE_URL`.
- Abre `https://tu-backend.railway.app/health`.
- Revisa que `VITE_USE_MOCK=false`.
- Confirma que el dominio de Vercel este en `CORS_ORIGINS`.

Si la carga de archivos falla:

- Verifica que el backend este activo.
- Revisa que el archivo sea CSV, Excel o PDF.
- Confirma que CSV/Excel tenga columnas equivalentes a siniestros.

Si el agente no responde:

- Verifica que `GEMINI_API_KEY` este configurada en Railway o en el `.env` del backend.
- Revisa el endpoint `POST /agent/query` desde Swagger.

## Buenas Practicas

- No subir `.env`.
- No poner secretos en variables `VITE_`.
- Mantener `VITE_USE_MOCK=false` en produccion.
- Probar `npm run build` antes de desplegar.
- Validar CORS despues de cambiar dominios.
- Usar siempre el backend como intermediario para IA y base de datos.
