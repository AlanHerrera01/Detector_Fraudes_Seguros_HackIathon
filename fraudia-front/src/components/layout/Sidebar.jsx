import { NavLink } from 'react-router-dom'
import { useState } from 'react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/siniestros', label: 'Siniestros', icon: '🧾' },
  { to: '/providers', label: 'Red de riesgo', icon: '🕸️' },
  { to: '/rules', label: 'Reglas aplicadas', icon: '🛡️' },
  { to: '/reports', label: 'Reportes', icon: '📁' },
]

const linkStyle = (collapsed) => ({ isActive }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: collapsed ? 'center' : 'flex-start',
  gap: collapsed ? 0 : 12,
  padding: collapsed ? '14px 0' : '12px 14px',
  color: isActive ? '#fff' : '#cbd5e1',
  textDecoration: 'none',
  background: isActive ? '#0f172a' : 'transparent',
  borderLeft: collapsed ? '0' : isActive ? '4px solid var(--accent)' : '4px solid transparent',
  borderRadius: 10,
  minHeight: 50,
  transition: 'background 180ms ease, border-color 180ms ease',
})

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(true)
  const [hovered, setHovered] = useState(false)
  const expanded = !collapsed || hovered

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'sticky',
        top: 0,
        height: '100vh',
        width: expanded ? 260 : 84,
        minWidth: expanded ? 260 : 84,
        background: 'var(--sidebar-bg)',
        color: '#cbd5e1',
        padding: expanded ? 24 : 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'width 180ms ease, min-width 180ms ease, padding 180ms ease, background 180ms ease',
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: expanded ? 'space-between' : 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: expanded ? 12 : 0, minWidth: 0 }}>
          <div style={brandMarkStyle}>FI</div>
          {expanded && (
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>FraudIA</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Detector de fraudes</div>
            </div>
          )}
        </div>
        {expanded && (
          <button onClick={() => setCollapsed(true)} title="Minimizar navegación" style={toggleStyle}>
            ←
          </button>
        )}
      </div>

      <nav style={{ marginTop: expanded ? 10 : 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} style={linkStyle(!expanded)} title={expanded ? undefined : item.label}>
            <span style={iconStyle}>{item.icon}</span>
            {expanded && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />
    </aside>
  )
}

const brandMarkStyle = {
  width: 40,
  height: 40,
  borderRadius: 10,
  display: 'grid',
  placeItems: 'center',
  background: '#0f172a',
  color: '#fff',
  fontSize: 18,
  fontWeight: 800,
}

const iconStyle = {
  width: 30,
  height: 30,
  display: 'grid',
  placeItems: 'center',
  fontSize: 16,
}

const toggleStyle = {
  background: 'rgba(255,255,255,0.08)',
  color: '#cbd5e1',
  border: '1px solid rgba(255,255,255,0.12)',
  padding: '8px 10px',
  borderRadius: 10,
}

const compactToggleStyle = {
  background: 'rgba(255,255,255,0.08)',
  color: '#cbd5e1',
  border: '1px solid rgba(255,255,255,0.12)',
  padding: '10px 12px',
  width: '100%',
  borderRadius: 12,
  fontSize: 16,
}
