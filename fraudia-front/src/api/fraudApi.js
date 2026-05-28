const BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const API_KEY = import.meta.env.VITE_API_KEY || ''

function headers() {
  const h = { 'Content-Type': 'application/json' }
  if (API_KEY) h['X-API-Key'] = API_KEY
  return h
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.detail || `Error ${res.status}`)
  }
  return res.json()
}

export async function getDashboardStats() {
  return request('/stats/summary', { headers: headers() })
}

export async function getSiniestros(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/claims${qs ? `?${qs}` : ''}`, { headers: headers() })
}

export async function getSiniestroById(id) {
  return request(`/claims/${encodeURIComponent(id)}`, { headers: headers() })
}

export async function getClaimExplanation(id) {
  return request(`/claims/${encodeURIComponent(id)}/explanation`, { headers: headers() })
}

export async function getProveedores() {
  return request('/providers/ranking', { headers: headers() })
}

export async function getProviderNetworks(limit = 10) {
  return request(`/networks/providers?limit=${limit}`, { headers: headers() })
}

function reportQuery(params = {}) {
  const clean = Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  return new URLSearchParams(clean).toString()
}

export async function getReportFilters() {
  return request('/reports/filters', { headers: headers() })
}

export async function getAuditReport(params = {}) {
  const qs = reportQuery(params)
  return request(`/reports/audit${qs ? `?${qs}` : ''}`, { headers: headers() })
}

export async function getModelMetrics() {
  return request('/model/metrics', { headers: headers() })
}

export async function downloadAuditReport(format = 'csv', params = {}) {
  const h = API_KEY ? { 'X-API-Key': API_KEY } : {}
  const extension = format === 'pdf' ? 'pdf' : 'csv'
  const qs = reportQuery(params)
  const res = await fetch(`${BASE}/reports/audit.${extension}${qs ? `?${qs}` : ''}`, { headers: h })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.detail || `Error ${res.status}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `fraudia_audit_report.${extension}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function queryAgent(question, provider = 'gemini', claimId = null) {
  return request('/agent/query', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ question, provider, claim_id: claimId }),
  })
}

export async function uploadDataset(file) {
  const fd = new FormData()
  fd.append('file', file)
  const h = API_KEY ? { 'X-API-Key': API_KEY } : {}
  return request('/claims/upload', {
    method: 'POST',
    headers: h,
    body: fd,
  })
}

export default {
  getDashboardStats,
  getSiniestros,
  getSiniestroById,
  getClaimExplanation,
  getProveedores,
  getProviderNetworks,
  getReportFilters,
  getAuditReport,
  getModelMetrics,
  downloadAuditReport,
  queryAgent,
  uploadDataset,
}
