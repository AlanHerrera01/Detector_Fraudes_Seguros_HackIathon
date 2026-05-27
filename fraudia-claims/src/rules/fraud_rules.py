from dataclasses import dataclass
from typing import Any
import unicodedata


@dataclass(frozen=True)
class RuleAlert:
    """Alerta trazable generada por una regla de negocio."""

    code: str
    name: str
    points: int
    severity: str
    message: str


def _is_yes(value: Any) -> bool:
    """Normaliza respuestas binarias comunes de CSV."""
    text = unicodedata.normalize("NFKD", str(value).strip().lower())
    text = "".join(char for char in text if not unicodedata.combining(char))
    return text in {"si", "true", "1", "yes"}


def evaluate_claim_rules(claim: dict[str, Any]) -> list[RuleAlert]:
    """Evalua un siniestro contra reglas explicables definidas para el reto.

    Cada regla suma puntos al score final, pero ninguna confirma fraude por si
    sola; solo genera una alerta para priorizar revision humana.
    """
    alerts: list[RuleAlert] = []
    cobertura = str(claim.get("cobertura", "")).lower()
    dias_inicio = int(claim.get("dias_desde_inicio_poliza") or 9999)
    dias_fin = int(claim.get("dias_desde_fin_poliza") or 9999)
    demora_reporte = int(claim.get("dias_entre_ocurrencia_reporte") or 0)
    historial_asegurado = int(claim.get("historial_siniestros_asegurado") or 0)
    historial_vehiculo = int(claim.get("historial_siniestros_vehiculo") or 0)
    casos_proveedor = int(claim.get("casos_observados_proveedor") or 0)
    monto = float(claim.get("monto_reclamado") or 0)
    suma = float(claim.get("suma_asegurada") or 0)

    if "perdida total" in cobertura and "robo" in cobertura:
        alerts.append(RuleAlert("RF-01", "Perdida total por robo", 20, "rojo", "Cobertura de perdida total por robo requiere revision especializada."))

    if _is_yes(claim.get("documentos_inconsistentes")):
        alerts.append(RuleAlert("RF-02", "Documentos inconsistentes", 10, "rojo", "Se detectaron inconsistencias o posible alteracion documental."))

    if _is_yes(claim.get("proveedor_en_lista_restrictiva")):
        alerts.append(RuleAlert("RF-03", "Lista restrictiva", 10, "rojo", "El beneficiario o proveedor coincide con lista restrictiva simulada."))

    if _is_yes(claim.get("dinamica_sospechosa")):
        alerts.append(RuleAlert("RF-04", "Dinamica sospechosa", 6, "rojo", "La dinamica reportada requiere validacion por inconsistencias fisicas o narrativas."))

    borde_minimo = min(dias_inicio, dias_fin)
    # Los siniestros muy cerca del inicio o fin de vigencia son sensibles en
    # seguros porque pueden indicar antiseleccion, reporte oportunista o error.
    if borde_minimo <= 2:
        alerts.append(RuleAlert("RF-05", "Borde extremo de vigencia", 8, "amarillo", "El siniestro ocurrio dentro de las primeras o ultimas 48 horas de vigencia."))
    elif borde_minimo <= 10:
        alerts.append(RuleAlert("S-01", "Borde cercano de vigencia", 8, "amarillo", "El siniestro ocurrio dentro de los primeros o ultimos 10 dias de vigencia."))
    elif borde_minimo <= 30:
        alerts.append(RuleAlert("S-01", "Borde cercano de vigencia", 4, "amarillo", "El siniestro ocurrio cerca del inicio o fin de vigencia."))

    if "robo" in cobertura and demora_reporte > 4:
        alerts.append(RuleAlert("RF-06", "Demora denuncia de robo", 8, "amarillo", "La denuncia de robo fue reportada despues de 4 dias."))
    elif demora_reporte > 7:
        alerts.append(RuleAlert("S-02", "Reporte tardio", 5, "amarillo", "El siniestro fue reportado mas de 7 dias despues del evento."))
    elif demora_reporte >= 4:
        alerts.append(RuleAlert("S-02", "Reporte tardio", 3, "amarillo", "El siniestro fue reportado entre 4 y 7 dias despues del evento."))

    if historial_asegurado >= 3:
        alerts.append(RuleAlert("S-03", "Alta frecuencia asegurado", 8, "amarillo", "El asegurado registra 3 o mas siniestros previos."))
    elif historial_asegurado == 2:
        alerts.append(RuleAlert("S-03", "Frecuencia media asegurado", 4, "amarillo", "El asegurado registra 2 siniestros previos."))

    if historial_vehiculo >= 3:
        alerts.append(RuleAlert("S-04", "Alta frecuencia vehiculo", 6, "amarillo", "El vehiculo registra 3 o mas siniestros previos."))
    elif historial_vehiculo == 2:
        alerts.append(RuleAlert("S-04", "Frecuencia media vehiculo", 3, "amarillo", "El vehiculo registra 2 siniestros previos."))

    if _is_yes(claim.get("solo_rc")) and historial_asegurado > 2:
        alerts.append(RuleAlert("S-05", "Reclamos solo RC recurrentes", 6, "amarillo", "Existe frecuencia atipica de reclamos de solo responsabilidad civil."))

    if casos_proveedor > 2:
        alerts.append(RuleAlert("S-06", "Proveedor recurrente", 5, "amarillo", "El proveedor aparece asociado a mas de 2 casos observados."))

    if not _is_yes(claim.get("documentos_completos")):
        alerts.append(RuleAlert("S-07", "Documentos incompletos", 4, "amarillo", "Falta documentacion requerida para sustentar el reclamo."))

    if not _is_yes(claim.get("tercero_identificado")):
        alerts.append(RuleAlert("S-08", "Sin tercero identificado", 5, "amarillo", "El evento no registra tercero identificado o evidencia externa suficiente."))

    if suma > 0 and monto / suma >= 0.95:
        alerts.append(RuleAlert("S-09", "Monto cercano a suma asegurada", 5, "amarillo", "El monto reclamado representa 95% o mas de la suma asegurada."))

    if bool(claim.get("narrativa_inconsistente")):
        alerts.append(RuleAlert("NLP-01", "Narrativa inconsistente", 7, "amarillo", "La descripcion contiene senales de contradiccion o inconsistencia narrativa."))

    if bool(claim.get("narrativa_vaga")):
        alerts.append(RuleAlert("NLP-02", "Narrativa poco detallada", 4, "amarillo", "La descripcion usa expresiones vagas que dificultan validar la dinamica del evento."))

    if bool(claim.get("narrativa_alto_riesgo")) and (demora_reporte >= 4 or not _is_yes(claim.get("tercero_identificado"))):
        alerts.append(RuleAlert("NLP-03", "Narrativa de alto riesgo", 5, "amarillo", "La narrativa combina terminos sensibles con reporte tardio o falta de tercero identificado."))

    return alerts


def risk_level(score: float) -> str:
    """Convierte el score numerico a semaforo operativo para analistas."""
    if score >= 76:
        return "rojo"
    if score >= 41:
        return "amarillo"
    return "verde"
