import { levelFromScore } from '../../utils/riskHelpers'

export default function RiskBadge({ score, size = 'md' }) {
  const { label, nivel } = levelFromScore(score)
  const sizes = {
    sm: { fontSize: 12, padding: '4px 8px' },
    md: { fontSize: 14, padding: '6px 10px' },
    lg: { fontSize: 16, padding: '8px 12px' },
  }
  const marker = nivel === 'verde' ? 'var(--risk-green)' : nivel === 'amarillo' ? 'var(--risk-yellow)' : 'var(--risk-red)'

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, color: '#fff', ...sizes[size] }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: marker }} />
      <span style={{ fontSize: sizes[size].fontSize }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.9 }}>{score}</span>
    </div>
  )
}
