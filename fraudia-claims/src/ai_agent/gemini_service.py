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
    return (
        "Respuesta local sin Gemini configurado. Con base en los datos disponibles: "
        f"{context[:1200]} "
        "Recuerda que estas senales son alertas de revision, no confirmaciones de fraude."
    )
