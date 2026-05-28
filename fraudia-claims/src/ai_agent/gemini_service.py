import os
import re
import urllib3

from dotenv import load_dotenv

load_dotenv()


SYSTEM_INSTRUCTION = """
Eres FraudIA, analista de siniestros. Responde en espanol claro y breve.
Usa solo el contexto entregado; no inventes datos ni confirmes fraude.
Usa exactamente estas etiquetas: Lectura, Evidencia, Impacto, Validacion.
Si hay semaforo: verde 0-40, amarillo 41-75, rojo 76-100.
Maximo 5 lineas. No uses Markdown complejo.
"""


def ask_gemini(question: str, context: str) -> str:
    """Consulta Gemini si hay API key."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    timeout_seconds = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "8"))
    max_context_chars = int(os.getenv("GEMINI_MAX_CONTEXT_CHARS", "3500"))
    max_output_tokens = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "420"))
    verify_ssl = os.getenv("GEMINI_VERIFY_SSL", "true").strip().lower() not in {"0", "false", "no"}

    if not api_key or api_key == "your_gemini_api_key_here":
        return "Gemini no esta configurado. Agrega GEMINI_API_KEY en el backend."

    try:
        import requests

        if not verify_ssl:
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        context = _compact_context(context, max_context_chars)
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
                                f"Contexto:\n{context}"
                            )
                        }
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.25,
                "maxOutputTokens": max_output_tokens,
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
        return f"Gemini tardo mas de {timeout_seconds} segundos. Intenta de nuevo."
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "sin_status"
        detail = exc.response.text[:300] if exc.response is not None else "sin_detalle"
        return f"Gemini no pudo responder ahora (HTTP {status}). Detalle: {detail}"
    except requests.RequestException as exc:
        return f"No fue posible conectar con Gemini ({type(exc).__name__})."
    except Exception as exc:
        return f"No fue posible consultar Gemini ({type(exc).__name__})."


def _compact_context(context: str, max_chars: int) -> str:
    """Recorta contexto largo para mantener pequeno el prompt enviado a Gemini."""
    if max_chars <= 0 or len(context) <= max_chars:
        return context
    return context[:max_chars].rstrip() + "\n[contexto recortado]"


def ask_local_qwen(question: str, context: str) -> tuple[str, str]:
    """Consulta Qwen local via Ollama si esta habilitado."""
    endpoint = os.getenv("LOCAL_LLM_ENDPOINT", "http://127.0.0.1:11434/api/generate").strip()
    model_name = os.getenv("LOCAL_LLM_MODEL", "qwen2.5:3b").strip()
    timeout_seconds = int(os.getenv("LOCAL_LLM_TIMEOUT_SECONDS", "45"))
    auto_pull = os.getenv("LOCAL_LLM_AUTO_PULL", "false").strip().lower() in {"1", "true", "yes"}
    pull_timeout_seconds = int(os.getenv("LOCAL_LLM_PULL_TIMEOUT_SECONDS", "900"))
    max_context_chars = int(os.getenv("LOCAL_LLM_MAX_CONTEXT_CHARS", "2500"))
    max_output_tokens = int(os.getenv("LOCAL_LLM_MAX_OUTPUT_TOKENS", "320"))

    try:
        import requests

        session = requests.Session()
        session.trust_env = False
        if auto_pull:
            _ensure_ollama_model(session, endpoint, model_name, pull_timeout_seconds)

        compact_context = _compact_context(context, max_context_chars)
        prompt = (
            f"{SYSTEM_INSTRUCTION.strip()}\n\n"
            f"Pregunta del analista: {question}\n\n"
            f"Contexto:\n{compact_context}"
        )
        payload = {
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.25,
                "num_predict": max_output_tokens,
            },
        }
        response = session.post(endpoint, json=payload, timeout=timeout_seconds)
        response.raise_for_status()
        data = response.json()
        answer = str(data.get("response", "")).strip()
        return answer or f"{model_name} local no devolvio contenido.", f"local:{model_name}"
    except requests.Timeout:
        return f"{model_name} local tardo mas de {timeout_seconds} segundos.", f"local:{model_name}"
    except requests.RequestException as exc:
        return (
            f"No fue posible conectar con {model_name} local en Ollama ({type(exc).__name__}). "
            "Verifica que Ollama este abierto y que hayas ejecutado: ollama run qwen2.5:3b"
        ), f"local:{model_name}"
    except Exception as exc:
        return f"No fue posible consultar {model_name} local ({type(exc).__name__}).", f"local:{model_name}"


def _ensure_ollama_model(session, generate_endpoint: str, model_name: str, timeout_seconds: int) -> None:
    """Descarga el modelo en Ollama si aun no existe localmente."""
    base_url = generate_endpoint.split("/api/")[0].rstrip("/")
    tags_response = session.get(f"{base_url}/api/tags", timeout=8)
    tags_response.raise_for_status()
    models = tags_response.json().get("models", [])
    installed = {model.get("name") for model in models if isinstance(model, dict)}
    if model_name in installed:
        return

    pull_response = session.post(
        f"{base_url}/api/pull",
        json={"name": model_name, "stream": False},
        timeout=timeout_seconds,
    )
    pull_response.raise_for_status()


def _local_llm_enabled() -> bool:
    return os.getenv("LOCAL_LLM_ENABLED", "false").strip().lower() in {"1", "true", "yes"}


def _is_gemini_failure(answer: str) -> bool:
    lowered = answer.lower()
    return any(
        marker in lowered
        for marker in [
            "gemini no esta configurado",
            "gemini tardo",
            "gemini no pudo responder",
            "no fue posible conectar con gemini",
            "no fue posible consultar gemini",
            "http 429",
        ]
    )


def ask_github_models(question: str, context: str) -> tuple[str, str]:
    # FUTURA IMPLEMENTACION: proveedor desactivado mientras la app usa solo Gemini.
    """Consulta GitHub Models si hay token."""
    token = os.getenv("GITHUB_MODELS_TOKEN", "").strip() or os.getenv("GITHUB_TOKEN", "").strip()
    model_name = os.getenv("GITHUB_MODELS_MODEL", "openai/gpt-5")
    timeout_seconds = int(os.getenv("GITHUB_MODELS_TIMEOUT_SECONDS", "45"))
    max_completion_tokens = int(os.getenv("GITHUB_MODELS_MAX_COMPLETION_TOKENS", "1200"))
    verify_ssl = os.getenv("GITHUB_MODELS_VERIFY_SSL", "true").strip().lower() not in {"0", "false", "no"}
    api_version = os.getenv("GITHUB_MODELS_API_VERSION", "2026-03-10")
    endpoint = os.getenv("GITHUB_MODELS_ENDPOINT", "https://models.github.ai/inference/chat/completions").strip()

    if not token or token == "your_github_models_token_here":
        return "GitHub Models no esta configurado. Agrega un GITHUB_MODELS_TOKEN real en el .env del backend.", "github"

    try:
        import requests

        if not verify_ssl:
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": SYSTEM_INSTRUCTION},
                {
                    "role": "user",
                    "content": (
                        f"Pregunta del analista: {question}\n\n"
                        "Responde obligatoriamente en espanol, con tono natural y util, aunque la pregunta sea corta. "
                        "Usa el contexto para responder con explicacion causal. "
                        "No copies la tabla sin interpretarla; convierte los datos en una lectura de negocio.\n\n"
                        f"Contexto disponible:\n{context}"
                    ),
                },
            ],
            "max_completion_tokens": max_completion_tokens,
        }
        session = requests.Session()
        session.trust_env = False
        response = session.post(
            endpoint,
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {token}",
                "X-GitHub-Api-Version": api_version,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=timeout_seconds,
            verify=verify_ssl,
        )
        response.raise_for_status()
        data = response.json()
        content = _extract_chat_content(data)
        return content or f"{model_name} no devolvio contenido. Intenta de nuevo con una pregunta mas especifica.", model_name
    except requests.Timeout:
        return f"{model_name} en {endpoint} tardo mas de {timeout_seconds} segundos. Selecciona otra IA e intenta de nuevo.", model_name
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "sin_status"
        detail = exc.response.text[:300] if exc.response is not None else "sin_detalle"
        # Intenta extraer mensaje real de la API
        try:
            error_json = exc.response.json() if exc.response is not None else {}
            api_message = error_json.get("error") or error_json.get("message") or str(error_json)
        except Exception:
            api_message = detail
        if status == 429:
            return f"{model_name} en {endpoint} alcanzó su límite de uso. Mensaje API: {api_message}", model_name
        if status == 403:
            return f"{model_name} en {endpoint} no está disponible con este token. Mensaje API: {api_message}", model_name
        return f"{model_name} en {endpoint} no pudo responder ahora (HTTP {status}). Mensaje API: {api_message}", model_name
    except requests.RequestException as exc:
        return f"No fue posible conectar con {model_name} en {endpoint} ({type(exc).__name__}).", model_name
    except Exception as exc:
        return f"No fue posible consultar {model_name} en {endpoint} ({type(exc).__name__}).", model_name


def ask_openai(question: str, context: str) -> tuple[str, str]:
    # FUTURA IMPLEMENTACION: proveedor desactivado mientras la app usa solo Gemini.
    """Consulta OpenAI Responses API si hay API key."""
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    model_name = os.getenv("OPENAI_MODEL", "gpt-5.2").strip()
    timeout_seconds = int(os.getenv("OPENAI_TIMEOUT_SECONDS", "45"))
    max_output_tokens = int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "1200"))
    verify_ssl = os.getenv("OPENAI_VERIFY_SSL", "true").strip().lower() not in {"0", "false", "no"}
    endpoint = os.getenv("OPENAI_ENDPOINT", "https://api.openai.com/v1/responses").strip()

    if not api_key or api_key == "your_openai_api_key_here":
        return "OpenAI no esta configurado. Agrega un OPENAI_API_KEY real en el .env del backend.", "openai"

    try:
        import requests

        if not verify_ssl:
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        payload = {
            "model": model_name,
            "instructions": SYSTEM_INSTRUCTION,
            "input": (
                f"Pregunta del analista: {question}\n\n"
                "Responde obligatoriamente en espanol, con tono natural y util. "
                "Usa el contexto para responder con explicacion causal. "
                "No copies la tabla sin interpretarla; convierte los datos en una lectura de negocio.\n\n"
                f"Contexto disponible:\n{context}"
            ),
            "max_output_tokens": max_output_tokens,
        }
        session = requests.Session()
        session.trust_env = False
        response = session.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=timeout_seconds,
            verify=verify_ssl,
        )
        response.raise_for_status()
        data = response.json()
        content = _extract_openai_response_text(data)
        return content or "OpenAI no devolvio contenido. Intenta de nuevo con una pregunta mas especifica.", "openai"
    except requests.Timeout:
        return f"OpenAI tardo mas de {timeout_seconds} segundos. Selecciona otra IA e intenta de nuevo.", "openai"
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "sin_status"
        error_info = _extract_error_info(exc.response)
        if status == 401:
            return "OpenAI rechazo la API key. Verifica OPENAI_API_KEY en el .env del backend.", "openai"
        if status == 429:
            code = error_info.get("code") or error_info.get("type")
            if code == "insufficient_quota":
                return (
                    "OpenAI respondio insufficient_quota: la API key es valida, pero el proyecto u organizacion "
                    "no tiene cuota/credito disponible o alcanzo su limite de gasto. Revisa Billing, Usage y Limits "
                    "en el proyecto de OpenAI asociado a esa key."
                ), "openai"
            if code == "rate_limit_exceeded":
                return (
                    "OpenAI respondio rate_limit_exceeded: la key funciona, pero se enviaron demasiadas solicitudes "
                    "o tokens para el limite actual del proyecto/modelo. Espera un momento o baja el uso."
                ), "openai"
            return (
                "OpenAI devolvio HTTP 429. Puede ser cuota, limite de gasto o rate limit del proyecto/modelo. "
                f"Detalle: {_format_error_info(error_info)}"
            ), "openai"
        if status == 403:
            return (
                "OpenAI rechazo el acceso al recurso solicitado. Verifica que el proyecto de la API key tenga "
                f"acceso al modelo {model_name}. Detalle: {_format_error_info(error_info)}"
            ), "openai"
        return f"OpenAI no pudo responder ahora (HTTP {status}). Detalle: {_format_error_info(error_info)}", "openai"
    except requests.RequestException as exc:
        return f"No fue posible conectar con OpenAI ({type(exc).__name__}).", "openai"
    except Exception as exc:
        return f"No fue posible consultar OpenAI ({type(exc).__name__}).", "openai"


def _extract_chat_content(data: dict) -> str:
    """Extrae texto de respuestas Chat Completions aunque el proveedor varie el formato."""
    message = data.get("choices", [{}])[0].get("message", {})
    content = message.get("content", "")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                parts.append(str(item.get("text") or item.get("content") or ""))
            else:
                parts.append(str(item))
        return "\n".join(part for part in parts if part.strip()).strip()
    return str(content or "").strip()


def _extract_openai_response_text(data: dict) -> str:
    """Extrae texto de Responses API tolerando variaciones del payload."""
    if isinstance(data.get("output_text"), str):
        return data["output_text"].strip()

    parts = []
    for item in data.get("output", []) or []:
        for content in item.get("content", []) or []:
            if isinstance(content, dict):
                text = content.get("text")
                if isinstance(text, str):
                    parts.append(text)
    return "\n".join(part for part in parts if part.strip()).strip()


def _extract_error_info(response) -> dict:
    if response is None:
        return {}
    try:
        data = response.json()
    except ValueError:
        return {"message": response.text[:300] if getattr(response, "text", None) else ""}
    error = data.get("error", data)
    return error if isinstance(error, dict) else {"message": str(error)}


def _format_error_info(error_info: dict) -> str:
    fields = []
    for key in ["code", "type", "message"]:
        value = error_info.get(key)
        if value:
            fields.append(f"{key}={str(value)[:180]}")
    return "; ".join(fields) or "sin detalle"


def ask_ai_model(question: str, context: str, provider: str | None = None) -> tuple[str, str]:
    """Usa Gemini como proveedor principal y Qwen local como respaldo opcional."""
    _ = provider

    # FUTURA IMPLEMENTACION: reactivar selector multi-proveedor si se necesita.
    # selected = (provider or os.getenv("AI_PROVIDER", "gemini")).strip().lower()
    # aliases = {"google": "gemini", "openai_api": "openai", "github_models": "github"}
    # selected = aliases.get(selected, selected)
    # if selected == "openai":
    #     return ask_openai(question, context)
    # if selected == "github":
    #     return ask_github_models(question, context)
    # if selected == "local":
    #     return fallback_answer(question, context), "local"

    gemini_answer = ask_gemini(question, context)
    if _claim_answer_too_short(gemini_answer, context):
        return _fallback_claim_answer(context), "gemini"
    if _local_llm_enabled() and _is_gemini_failure(gemini_answer):
        local_answer, local_provider = ask_local_qwen(question, context)
        if _claim_answer_too_short(local_answer, context):
            return _fallback_claim_answer(context), local_provider
        if not local_answer.lower().startswith("no fue posible"):
            return local_answer, local_provider
        return f"{gemini_answer}\n\nRespaldo local: {local_answer}", local_provider
    return gemini_answer, "gemini"


def _claim_answer_too_short(answer: str, context: str) -> bool:
    if "ficha compacta del siniestro" not in context.lower():
        return False
    clean = answer.strip()
    if len(clean) < 220:
        return True
    required_terms = ["score", "regla", "valid"]
    lowered = clean.lower()
    return not all(term in lowered for term in required_terms)


def fallback_answer(question: str, context: str) -> str:
    """Respuesta de respaldo para que la demo funcione sin credenciales reales."""
    lowered = question.lower()
    if "ficha compacta del siniestro" in context.lower():
        return _fallback_claim_answer(context)

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


def _fallback_claim_answer(context: str) -> str:
    def field(name: str, default: str = "no disponible") -> str:
        match = re.search(rf"{name}=([^;]+)", context)
        return match.group(1).strip() if match else default

    claim_id = field("id")
    level = field("nivel")
    score = field("score")
    rules_points = field("puntos_reglas", "0")
    model_points = field("puntos_ia_ml_aprox", "0")
    alerts = field("principales_alertas", "sin alertas principales")

    return (
        f"Lectura: el siniestro {claim_id} queda en {level} con score {score}; rojo aplica entre 76-100.\n"
        f"Evidencia: reglas principales {alerts}; puntos reglas={rules_points} e IA/ML aprox={model_points}.\n"
        "Impacto: la combinacion de senales lo vuelve prioritario para revision, no fraude confirmado.\n"
        "Validacion: revisar documentos, tiempos de reporte, proveedor/beneficiario y narrativa antes de decidir."
    )
