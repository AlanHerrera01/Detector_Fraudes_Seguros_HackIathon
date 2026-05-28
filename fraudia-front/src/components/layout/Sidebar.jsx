import { NavLink } from 'react-router-dom'
import { useState } from 'react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'D' },
  { to: '/siniestros', label: 'Siniestros', icon: 'S' },
  { to: '/providers', label: 'Red de riesgo', icon: 'R' },
  { to: '/rules', label: 'Reglas aplicadas', icon: 'P' },
  { to: '/reports', label: 'Reportes', icon: 'E' },
]

const linkStyle = (collapsed) => ({ isActive }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: collapsed ? 'center' : 'flex-start',
  gap: collapsed ? 0 : 10,
  padding: collapsed ? '12px 0' : '12px 14px',
  color: isActive ? '#fff' : '#cbd5e1',
  textDecoration: 'none',
  background: isActive ? '#0f172a' : 'transparent',
  borderLeft: collapsed ? '0' : isActive ? '4px solid var(--accent)' : '4px solid transparent',
  borderRadius: 8,
  minHeight: 46,
})

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside style={{ width: collapsed ? 76 : 260, minWidth: collapsed ? 76 : 260, background: 'var(--sidebar-bg)', color: '#cbd5e1', padding: collapsed ? 14 : 20, display: 'flex', flexDirection: 'column', gap: 12, transition: 'width 180ms ease, min-width 180ms ease, padding 180ms ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={brandMarkStyle}>FI</div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>FraudIA</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Detector de fraudes</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} title="Reducir menu" style={toggleStyle}>Menu</button>
        )}
      </div>

      {collapsed && (
        <button onClick={() => setCollapsed(false)} title="Expandir menu" style={compactToggleStyle}>{'>'}</button>
      )}

      <nav style={{ marginTop: collapsed ? 8 : 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} style={linkStyle(collapsed)} title={collapsed ? item.label : undefined}>
            <span style={iconStyle}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />
      {!collapsed && (
        <footer style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
          Sistema de alertas. No reemplaza revision humana.
        </footer>
      )}
    </aside>
  )
}

const brandMarkStyle = {
  width: 38,
  height: 38,
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  background: '#0f172a',
  color: '#fff',
  fontSize: 18,
  fontWeight: 800,
}

const iconStyle = {
  width: 24,
  height: 24,
  display: 'grid',
  placeItems: 'center',
  fontWeight: 800,
}

const toggleStyle = {
  background: 'rgba(255,255,255,0.08)',
  color: '#cbd5e1',
  border: '1px solid rgba(255,255,255,0.12)',
  padding: '8px 10px',
}

const compactToggleStyle = {
  background: 'rgba(255,255,255,0.08)',
  color: '#cbd5e1',
  border: '1px solid rgba(255,255,255,0.12)',
  padding: '8px 0',
  width: '100%',
  fontSize: 12,
}
