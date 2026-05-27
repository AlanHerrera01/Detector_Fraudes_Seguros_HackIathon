# Modelo de datos

La tabla principal es `siniestros`.

Campos clave:

- `id_siniestro`
- `id_poliza`
- `id_asegurado`
- `id_vehiculo`
- `ramo`
- `cobertura`
- `fecha_ocurrencia`
- `fecha_reporte`
- `monto_reclamado`
- `monto_estimado`
- `monto_pagado`
- `estado`
- `sucursal`
- `ciudad`
- `descripcion`
- `documentos_completos`
- `documentos_inconsistentes`
- `beneficiario`
- `proveedor_en_lista_restrictiva`
- `dias_desde_inicio_poliza`
- `dias_desde_fin_poliza`
- `dias_entre_ocurrencia_reporte`
- `historial_siniestros_asegurado`
- `historial_siniestros_vehiculo`
- `casos_observados_proveedor`
- `suma_asegurada`
- `solo_rc`
- `tercero_identificado`
- `dinamica_sospechosa`
- `etiqueta_fraude_simulada`

El dataset incluido es sintetico y no contiene datos personales reales.

## Tablas complementarias sinteticas

Ademas de `siniestros`, se incluyen archivos complementarios en `data/synthetic/`:

- `polizas_sinteticas.csv`: polizas, vigencias, prima, suma asegurada, deducible y canal de venta.
- `asegurados_sinteticos.csv`: segmento, antiguedad, ciudad, numero de polizas, reclamos recientes, mora y score simulado.
- `proveedores_sinteticos.csv`: talleres, clinicas o peritos con reclamos asociados, monto promedio y porcentaje de casos observados.
- `documentos_sinteticos.csv`: documentos por siniestro, entrega, legibilidad, inconsistencias y observaciones.

Estas tablas permiten ampliar el analisis hacia relaciones entre poliza,
asegurado, proveedor y documentos sin usar informacion personal real.

## Persistencia PostgreSQL opcional

Por defecto la solucion funciona con archivos planos CSV. Si se activa
`DB_ENABLED=true`, el backend usa PostgreSQL:

- Crea automaticamente la base definida en `DB_NAME` si no existe.
- Crea automaticamente la tabla `DB_SCHEMA.DB_TABLE`.
- Crea automaticamente las tablas complementarias sinteticas.
- Si las tablas estan vacias, carga los CSV sinteticos iniciales.
- Cuando se sube un CSV por `/claims/upload`, hace upsert por `id_siniestro`.

Variables relevantes:

- `DB_ENABLED`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SCHEMA`
- `DB_TABLE`

Endpoints de soporte:

- `GET /db/status`
- `POST /db/init`
