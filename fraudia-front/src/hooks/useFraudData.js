import { useMemo } from 'react'
import * as api from '../api/fraudApi'
import { formatISO, subDays } from 'date-fns'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function normalizeAlert(alert = {}) {
  return {
    codigo: alert.code || alert.codigo || 'ALR',
    descripcion: alert.message || alert.descripcion || alert.name || 'Senal detectada',
    puntos: alert.points || alert.puntos || 0,
    nivel: alert.severity || alert.nivel || 'amarillo',
  }
}

function normalizeClaim(claim = {}) {
  const score = claim.score_riesgo ?? claim.score ?? 0
  const alertasDetalle = (claim.alertas || claim.alertas_detalle || []).map(normalizeAlert)
  return {
    ...claim,
    score,
    score_riesgo: score,
    nivel_riesgo: claim.nivel_riesgo || (score <= 40 ? 'verde' : score <= 75 ? 'amarillo' : 'rojo'),
    alertas: alertasDetalle.map((item) => item.codigo),
    alertas_detalle: alertasDetalle,
    explicacion_ia: claim.explicacion || claim.explicacion_ia || 'Sin explicacion disponible.',
    senales_narrativa: claim.senales_narrativa || [],
    clasificacion_riesgo: claim.clasificacion_riesgo || (score >= 90 ? 'critico' : score >= 76 ? 'alto' : score >= 41 ? 'medio' : 'bajo'),
  }
}

function makeAlerts(score) {
  const count = score > 75 ? rand(2, 5) : score > 40 ? rand(1, 3) : rand(0, 2)
  return Array.from({ length: count }).map((_, i) => ({
    codigo: `ALR-${100 + i}`,
    descripcion: 'Senal sospechosa detectada',
    puntos: rand(1, 30),
    nivel: score > 75 ? 'rojo' : 'amarillo',
  }))
}

function genOne(i) {
  const score = rand(0, 100)
  const fecha = subDays(new Date(), rand(1, 90))
  const alerts = makeAlerts(score)
  return {
    id_siniestro: `SIN-${String(1000 + i).slice(-4)}`,
    ramo: 'Vehiculos',
    cobertura: i % 2 ? 'Robo' : 'Choque',
    monto_reclamado: rand(1000, 50000),
    fecha_ocurrencia: formatISO(fecha, { representation: 'date' }),
    score,
    nivel_riesgo: score <= 40 ? 'verde' : score <= 75 ? 'amarillo' : 'rojo',
    alertas: alerts.map((a) => a.codigo),
    descripcion: i % 2 ? 'Robo sin testigos; el asegurado no recuerda detalles.' : 'Reporte con evidencia documental completa.',
    beneficiario: `Proveedor ${1 + (i % 4)}`,
    senales_narrativa: i % 2 ? ['robo', 'sin testigos'] : [],
    explicacion_ia: 'Explicacion simulada para demo sin backend.',
    alertas_detalle: alerts,
  }
}

const MOCK_SINIESTROS = Array.from({ length: 20 }).map((_, i) => genOne(i))

export function useFraudData() {
  return useMemo(() => ({
    getDashboardStats: async () => {
      if (USE_MOCK) {
        return { total_siniestros: 1284, casos_rojos: 87, casos_amarillos: 213, casos_verdes: 984, score_promedio: 42.7 }
      }
      return api.getDashboardStats()
    },
    getSiniestros: async (params = {}) => {
      if (USE_MOCK) {
        let arr = MOCK_SINIESTROS.slice()
        if (params.riesgo && params.riesgo !== 'todos') arr = arr.filter((s) => s.nivel_riesgo === params.riesgo)
        if (params.search) arr = arr.filter((s) => matchesClaimSearch(s, params.search))
        return { items: arr.map(normalizeClaim), total: arr.length }
      }
      const claims = await api.getSiniestros({ limit: params.limit || 100 })
      let items = claims.map(normalizeClaim)
      if (params.riesgo && params.riesgo !== 'todos') items = items.filter((s) => s.nivel_riesgo === params.riesgo)
      if (params.search) items = items.filter((s) => matchesClaimSearch(s, params.search))
      return { items, total: items.length }
    },
    getSiniestroById: async (id) => {
      if (USE_MOCK) return normalizeClaim(MOCK_SINIESTROS.find((s) => s.id_siniestro === id) || {})
      return normalizeClaim(await api.getSiniestroById(id))
    },
    getClaimExplanation: async (id) => {
      if (USE_MOCK) {
        return {
          resumen_ejecutivo: 'Caso priorizado por senales narrativas y monto reclamado.',
          senales_principales: [],
          acciones_recomendadas: ['Validar documentos', 'Solicitar ampliacion de declaracion'],
          nota_etica: 'Alerta para revision humana; no confirma fraude.',
        }
      }
      return api.getClaimExplanation(id)
    },
    getProveedores: async () => {
      if (USE_MOCK) return Array.from({ length: 8 }).map((_, i) => ({ beneficiario: `Proveedor ${i + 1}`, alertas_rojas: rand(0, 8), total_casos: rand(10, 80), score_promedio: rand(20, 90) }))
      return api.getProveedores()
    },
    getProviderNetworks: async (limit = 10) => {
      if (USE_MOCK) return Array.from({ length: limit }).map((_, i) => ({ beneficiario: `Proveedor ${i + 1}`, total_casos: rand(3, 20), asegurados_unicos: rand(2, 15), vehiculos_unicos: rand(2, 12), ciudades_unicas: rand(1, 4), alertas_rojas: rand(0, 5), score_promedio: rand(30, 90), indice_concentracion: rand(5, 30) }))
      return api.getProviderNetworks(limit)
    },
    getReportFilters: async () => {
      if (USE_MOCK) return { uploads: [], providers: ['Proveedor 1', 'Proveedor 2'], date_min: null, date_max: null }
      return api.getReportFilters()
    },
    getAuditReport: async (params = {}) => {
      const limit = params.limit || 500
      if (USE_MOCK) return MOCK_SINIESTROS.slice(0, limit).map((claim) => ({
        id_siniestro: claim.id_siniestro,
        beneficiario: claim.beneficiario,
        score_riesgo: claim.score,
        nivel_riesgo: claim.nivel_riesgo,
        codigos_alerta: claim.alertas.join(', '),
        nota_etica: 'Alerta para revision humana; no confirma fraude.',
      }))
      return api.getAuditReport(params)
    },
    getModelMetrics: api.getModelMetrics,
    downloadAuditReport: api.downloadAuditReport,
    queryAgent: async (question, provider = 'gemini', claimId = null) => {
      if (USE_MOCK) return { answer: `Respuesta simulada para: ${question}`, provider }
      return api.queryAgent(question, provider, claimId)
    },
    uploadDataset: api.uploadDataset,
  }), [])
}

function matchesClaimSearch(claim, search) {
  const query = String(search || '').trim().toLowerCase()
  if (!query) return true
  return [claim.id_siniestro, claim.beneficiario, claim.cobertura, claim.ramo]
    .some((value) => String(value || '').toLowerCase().includes(query))
}

export default useFraudData
