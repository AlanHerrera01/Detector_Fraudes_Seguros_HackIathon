export function levelFromScore(score) {
  if (score <= 40) return { nivel: 'verde', label: 'Bajo', color: 'var(--risk-green)' }
  if (score <= 75) return { nivel: 'amarillo', label: 'Medio', color: 'var(--risk-yellow)' }
  return { nivel: 'rojo', label: 'Alto', color: 'var(--risk-red)' }
}

export function formatCurrency(n) {
  return Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

export function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString('es-CO')
  } catch {
    return d
  }
}

export function suggestedAction(score) {
  if (score <= 40) return { action: 'Flujo normal', color: 'var(--risk-green)' }
  if (score <= 75) return { action: 'Revision documental', color: 'var(--risk-yellow)' }
  return { action: 'Revision especializada de campo', color: 'var(--risk-red)' }
}
