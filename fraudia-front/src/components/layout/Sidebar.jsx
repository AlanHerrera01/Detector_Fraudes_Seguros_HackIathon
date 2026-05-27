import { NavLink } from 'react-router-dom'

const linkStyle = ({ isActive }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 16px',
  color: isActive ? '#fff' : '#cbd5e1',
  textDecoration: 'none',
  background: isActive ? '#0f172a' : 'transparent',
  borderLeft: isActive ? '4px solid var(--accent)' : '4px solid transparent',
  borderRadius: 8,
})

export default function Sidebar() {
  return (
    <aside style={{ width: 260, background: 'var(--sidebar-bg)', color: '#cbd5e1', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>FI</div>
        <div>
          <div style={{ fontWeight: 700, color: '#fff' }}>FraudIA</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Detector de fraudes</div>
        </div>
      </div>

      <nav style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <NavLink to="/" style={linkStyle}>Dashboard</NavLink>
        <NavLink to="/siniestros" style={linkStyle}>Siniestros</NavLink>
        <NavLink to="/providers" style={linkStyle}>Red de riesgo</NavLink>
        <NavLink to="/upload" style={linkStyle}>Cargar archivo</NavLink>
        <NavLink to="/agent" style={linkStyle}>Agente IA</NavLink>
      </nav>

      <div style={{ flex: 1 }} />
      <footer style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
        Sistema de alertas. No reemplaza revision humana.
      </footer>
    </aside>
  )
}
