from __future__ import annotations

import re
import unicodedata


VAGUE_TERMS = {
    "no recuerda",
    "no sabe",
    "sin detalle",
    "aproximadamente",
    "de repente",
    "no vio",
    "no identifica",
}

HIGH_RISK_TERMS = {
    "robo",
    "hurto",
    "perdida total",
    "incendio",
    "abandono",
    "amenaza",
    "sin testigos",
}

CONTRADICTION_TERMS = {
    "pero",
    "sin embargo",
    "aunque",
    "version",
    "contradice",
    "inconsistente",
}


def normalize_text(value: object) -> str:
    """Normaliza texto libre para buscar senales sin depender de tildes."""
    text = str(value or "").lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", text).strip()


def narrative_signals(description: object) -> dict[str, object]:
    """Extrae senales NLP simples desde la narrativa del siniestro.

    Es un enfoque transparente y reproducible: no reemplaza al agente IA, pero
    permite que el score use texto libre sin depender de credenciales externas.
    """
    normalized = normalize_text(description)
    vague_hits = sorted(term for term in VAGUE_TERMS if term in normalized)
    risk_hits = sorted(term for term in HIGH_RISK_TERMS if term in normalized)
    contradiction_hits = sorted(term for term in CONTRADICTION_TERMS if term in normalized)

    return {
        "narrativa_vaga": bool(vague_hits),
        "narrativa_alto_riesgo": bool(risk_hits),
        "narrativa_inconsistente": bool(contradiction_hits),
        "senales_narrativa": vague_hits + risk_hits + contradiction_hits,
    }
