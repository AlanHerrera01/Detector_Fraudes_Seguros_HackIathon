# Etica, sesgos y uso responsable

La solucion prioriza casos para revision humana. No confirma fraude y no debe
usarse para rechazar automaticamente un siniestro.

## Riesgos principales

- Falsos positivos: un caso legitimo puede parecer riesgoso por fechas, monto o narrativa incompleta.
- Falsos negativos: un caso riesgoso puede no activar reglas si los datos son insuficientes.
- Sesgo de datos: el dataset incluido es sintetico y no representa todos los contextos reales.
- Sesgo operativo: proveedores, ciudades o coberturas con mayor volumen pueden acumular mas alertas.
- Dependencia de texto: una descripcion breve no implica fraude; solo indica necesidad de validar mejor.

## Controles

- Score explicable con reglas y mensajes visibles.
- Semaforo operativo para priorizar, no para decidir automaticamente.
- Nota etica en las explicaciones ejecutivas.
- Fallback local cuando no existe API key de Gemini.
- Recomendacion de revision humana antes de cualquier accion adversa.

## Buenas practicas para uso real

- Validar reglas con expertos de siniestros.
- Auditar resultados por ramo, ciudad, proveedor y tipo de cobertura.
- Medir falsos positivos y falsos negativos con historicos reales.
- Separar el uso de alertas internas de decisiones finales al cliente.
- Registrar evidencia y justificacion humana en cada caso escalado.
