export function levelFromScore(score) {
  if (score <= 40) return { nivel: 'verde', label: 'Bajo', clasificacion: 'bajo', color: 'var(--risk-green)' }
  if (score <= 75) return { nivel: 'amarillo', label: 'Medio', clasificacion: 'medio', color: 'var(--risk-yellow)' }
  if (score < 90) return { nivel: 'rojo', label: 'Alto', clasificacion: 'alto', color: 'var(--risk-red)' }
  return { nivel: 'rojo', label: 'Critico', clasificacion: 'critico', color: '#7f1d1d' }
}

export function formatCurrency(n) {
  const value = Number(n || 0)
  const hasCents = Math.round(value * 100) % 100 !== 0
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })
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
  if (score < 90) return { action: 'Revision especializada de campo', color: 'var(--risk-red)' }
  return { action: 'Revision especializada de campo', color: 'var(--risk-red)' }
}
