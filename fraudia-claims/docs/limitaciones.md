# Limitaciones

- El dataset incluido es sintetico.
- El score no confirma fraude.
- Las reglas son parametrizables y deben validarse con expertos de negocio.
- El modelo entrenado con etiqueta simulada no debe considerarse productivo.
- Puede haber falsos positivos y falsos negativos.
- La revision humana sigue siendo obligatoria.
- Gemini depende de una API externa si se configura `GEMINI_API_KEY`.
- La coherencia automatica de resumen con LLM se considera mejora futura para controlar consumo de tokens, especialmente cuando se cargan muchos siniestros.
- La similitud textual actual usa TF-IDF local; detecta relatos parecidos, pero no reemplaza una revision semantica avanzada.
