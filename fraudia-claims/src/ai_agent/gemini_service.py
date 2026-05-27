import os

from dotenv import load_dotenv

load_dotenv()


SYSTEM_INSTRUCTION = """
Eres un asistente para analistas de siniestros de seguros.
No afirmes fraude confirmado. Usa lenguaje como posible fraude, alerta o requiere revision.
Responde solo con base en el contexto entregado. Si faltan datos, dilo claramente.
Prioriza explicaciones breves, trazables y utiles para revision humana.
"""


def ask_gemini(question: str, context: str) -> str:
    """Consulta Gemini si hay API key; si no, usa respuesta local reproducible."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    if not api_key or api_key == "your_gemini_api_key_here":
        return fallback_answer(question, context)

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name, system_instruction=SYSTEM_INSTRUCTION)
        response = model.generate_content(f"Pregunta: {question}\n\nContexto:\n{context}")
        return response.text.strip()
    except Exception as exc:
        return f"No fue posible consultar Gemini. Respuesta local basada en datos: {fallback_answer(question, context)} Error: {exc}"


def fallback_answer(question: str, context: str) -> str:
    """Respuesta de respaldo para que la demo funcione sin credenciales reales."""
    lowered = question.lower()
    if any(term in lowered for term in ["comite", "resumen ejecutivo", "presentar", "decision"]):
        return (
            "Como analista experto, recomendaria presentar tres puntos: "
            "1) volumen y distribucion del portafolio, 2) casos rojos que requieren revision prioritaria, "
            "y 3) proveedores o redes con concentracion de alertas. "
            f"Contexto trazable: {context[:1000]} "
            "La decision final debe quedar en revision humana; esto no confirma fraude."
        )

    if any(term in lowered for term in ["narrativa", "nlp", "descripcion", "texto"]):
        return (
            "Revise las senales narrativas disponibles. Los casos con descripcion vaga, inconsistente "
            "o asociada a terminos sensibles deben priorizarse para pedir soporte adicional. "
            f"Contexto trazable: {context[:1000]} "
            "Estas senales son indicios de revision, no prueba de fraude."
        )

    return (
        "Como asistente experto, mi lectura con base en los datos disponibles es: "
        f"{context[:1200]} "
        "Recomendacion: validar evidencia, documentos y narrativa antes de cualquier decision. "
        "Estas senales son alertas de revision, no confirmaciones de fraude."
    )
