# Uso de IA

La solucion usa IA en dos niveles:

1. Modelo de riesgo:
   - Si existe `etiqueta_fraude_simulada`, se usa `RandomForestClassifier`.
   - Si no existe etiqueta util, se puede usar deteccion de anomalias con `IsolationForest`.

2. Agente Gemini:
   - Responde preguntas del analista.
   - Explica casos de alto riesgo.
   - Resume proveedores, ciudades y casos prioritarios.
   - Mantiene lenguaje etico: alerta o posible fraude, no acusacion.

Gemini no calcula el score final. El score lo calcula el backend para mantener trazabilidad.
