# FraudIA - Frontend

Interfaz React/Vite para la demo del detector de posibles fraudes en siniestros.

## Instalacion

Copiar `.env.example` a `.env`:

```bash
copy .env.example .env
```

`fraudia-front/.env.example` contiene solo variables publicas de Vite. No pongas llaves de Gemini, OpenAI o GitHub Models aqui; esas credenciales van en `fraudia-claims/.env`.

Variables:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_API_KEY=
VITE_USE_MOCK=false
```

Ejecutar:

```bash
npm install
npm run dev
```

La app corre en:

```text
http://localhost:3000
```

## Experiencia de demo

- Dashboard ejecutivo con semaforo de riesgo.
- Lista de siniestros con filtros por nivel.
- Caso 360 con score, narrativa, alertas, explicacion ejecutiva y checklist.
- Red de riesgo para proveedores, asegurados, vehiculos y ciudades.
- Carga de archivos CSV o PDF.
- Agente IA para consultas en lenguaje natural.

## Proveedores IA

El selector del agente permite usar:

- Gemini
- OpenAI GPT
- GitHub Models GPT-5
- Local

Las credenciales se configuran en el `.env` del backend (`fraudia-claims/.env`).

## Carga de archivos

- CSV: actualiza el portafolio activo y recalcula scores.
- PDF: se analiza como soporte documental; extrae texto y senales narrativas, pero no reemplaza el CSV estructurado.

## Endpoints usados

- `GET /stats/summary`
- `GET /claims`
- `GET /claims/{id_siniestro}`
- `GET /claims/{id_siniestro}/explanation`
- `POST /claims/upload`
- `GET /providers/ranking`
- `GET /networks/providers`
- `POST /agent/query`

## Modo mock

Para presentar sin backend, usar:

```text
VITE_USE_MOCK=true
```
