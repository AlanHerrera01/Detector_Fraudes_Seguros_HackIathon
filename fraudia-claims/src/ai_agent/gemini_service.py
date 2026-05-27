import os
import urllib3

from dotenv import load_dotenv

load_dotenv()


SYSTEM_INSTRUCTION = """
Eres FraudIA, un analista senior de siniestros de seguros conversando con otro humano.
Responde en espanol natural, cercano y profesional, como si estuvieras sentado al lado del analista.
Tu respuesta debe sentirse inteligente y util, no como una tabla copiada.
Cuando la pregunta sea analitica, responde en maximo 8 lineas utiles:
1. Lectura del caso o hallazgo: que estas viendo y cual es el riesgo.
2. Razonamiento con evidencia: explica por que llegas a esa conclusion usando campos concretos del contexto.
3. Siguiente accion: que deberia revisar el analista y por que.
No afirmes fraude confirmado. Usa lenguaje como posible fraude, alerta, indicio o requiere revision.
Responde solo con base en el contexto entregado. Si faltan datos, dilo con claridad y pregunta que dato ayudaria.
Da explicaciones directas: suficientes para entender que paso, por que importa y que hacer despues, sin extenderte demasiado.
Evita sonar robotico, legalista o excesivamente tecnico. No inventes cifras ni casos fuera del contexto.
No uses Markdown complejo, asteriscos de negrilla ni backticks. Usa listas cortas con guiones simples si ayuda.
Si el usuario pregunta "por que", "que paso" o "explica", prioriza la causalidad: senal detectada -> impacto en el score -> validacion recomendada.
"""


def ask_gemini(question: str, context: str) -> str:
    """Consulta Gemini si hay API key; si no, usa respuesta local reproducible."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    timeout_seconds = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "8"))
    verify_ssl = os.getenv("GEMINI_VERIFY_SSL", "true").strip().lower() not in {"0", "false", "no"}

    if not api_key or api_key == "your_gemini_api_key_here":
        return fallback_answer(question, context)

    try:
        import requests

        if not verify_ssl:
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        payload = {
            "system_instruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": (
                                f"Pregunta del analista: {question}\n\n"
                                "Usa el contexto para responder con explicacion causal. "
                                "No copies la tabla sin interpretarla; convierte los datos en una lectura de negocio.\n\n"
                                f"Contexto disponible:\n{context}"
                            )
                        }
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.45,
                "maxOutputTokens": 520,
            },
        }
        session = requests.Session()
        # Evita proxies de entorno rotos (por ejemplo 127.0.0.1:9) que bloquean
        # la salida a Google Generative Language API en algunas instalaciones.
        session.trust_env = False
        response = session.post(
            url,
            params={"key": api_key},
            json=payload,
            timeout=timeout_seconds,
            verify=verify_ssl,
        )
        response.raise_for_status()
        data = response.json()
        parts = data["candidates"][0]["content"]["parts"]
        return "\n".join(part.get("text", "") for part in parts).strip()
    except requests.Timeout:
        return f"Gemini tardo mas de {timeout_seconds} segundos. Respuesta local: {fallback_answer(question, context)}"
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "sin_status"
        detail = exc.response.text[:300] if exc.response is not None else "sin_detalle"
        return f"Gemini respondio con error HTTP {status}. Detalle: {detail}. Respuesta local: {fallback_answer(question, context)}"
    except requests.RequestException as exc:
        return f"No fue posible conectar con Gemini ({type(exc).__name__}). Respuesta local: {fallback_answer(question, context)}"
    except Exception as exc:
        return f"No fue posible consultar Gemini ({type(exc).__name__}). Respuesta local basada en datos: {fallback_answer(question, context)}"


def fallback_answer(question: str, context: str) -> str:
    """Respuesta de respaldo para que la demo funcione sin credenciales reales."""
    lowered = question.lower()
    if any(term in lowered for term in ["comite", "resumen ejecutivo", "presentar", "decision"]):
        return (
            "Claro. Mi lectura ejecutiva seria esta:\n\n"
            "Lectura del hallazgo: el foco debe estar en los casos rojos y en las concentraciones por proveedor, "
            "porque combinan score alto, reglas activadas y posible impacto economico.\n\n"
            f"Evidencia trazable: {context[:1000]}\n\n"
            "Siguiente accion: llevar al comite los casos de mayor score, validar documentos y pedir revision humana "
            "antes de cualquier decision. Esto es una alerta de posible fraude, no una acusacion."
        )

    if any(term in lowered for term in ["narrativa", "nlp", "descripcion", "texto"]):
        return (
            "Buena pregunta. En la narrativa yo revisaria esto:\n\n"
            "Lectura del hallazgo: las descripciones vagas, inconsistentes o con terminos sensibles pueden indicar "
            "que falta soporte o que la historia del reclamo necesita validacion adicional.\n\n"
            f"Evidencia trazable: {context[:1000]}\n\n"
            "Siguiente accion: pedir documentos de soporte, contrastar fechas y comparar el relato con reglas activadas. "
            "Estas senales son indicios de revision, no prueba de fraude."
        )

    return (
        "Con lo que veo en los datos, mi lectura es esta:\n\n"
        "Lectura del hallazgo: hay senales que merecen revision prioritaria porque combinan reglas, score o informacion incompleta.\n\n"
        f"Evidencia trazable: {context[:1200]}\n\n"
        "Siguiente accion: validar evidencia, documentos y narrativa antes de cualquier decision. "
        "Estas senales son alertas de revision, no confirmaciones de fraude."
    )
