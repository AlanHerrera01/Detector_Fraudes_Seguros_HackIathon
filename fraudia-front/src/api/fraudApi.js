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

export async function queryAgent(question) {
  return request('/agent/query', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ question }),
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
  queryAgent,
  uploadDataset,
}
