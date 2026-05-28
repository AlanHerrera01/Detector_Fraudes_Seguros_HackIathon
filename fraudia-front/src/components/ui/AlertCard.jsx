export default function AlertCard({ alert }) {
  if (!alert) return null
  const color = alert.nivel === 'rojo' ? 'var(--risk-red)' : alert.nivel === 'amarillo' ? 'var(--risk-yellow)' : 'var(--risk-green)'
  return (
    <div style={{ borderRadius: 8, padding: 12, background: '#111827', display: 'flex', gap: 12, alignItems: 'center', borderLeft: `4px solid ${color}`, border: '1px solid var(--border-light)' }}>
      <div style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 800 }}>{alert.codigo}</div>
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: 3 }}>{alert.descripcion}</div>
      </div>
      <div style={{ background: color, color: '#fff', padding: '6px 8px', borderRadius: 8, fontWeight: 700 }}>{alert.puntos} pts</div>
    </div>
  )
}
