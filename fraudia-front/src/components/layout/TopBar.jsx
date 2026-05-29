import { useLocation } from 'react-router-dom'

function pageTitle(path){
  if (path === '/') return 'Dashboard'
  if (path.startsWith('/siniestros/') ) return 'Detalle Siniestro'
  if (path === '/siniestros') return 'Siniestros'
  if (path === '/providers') return 'Red de riesgo'
  if (path === '/rules') return 'Reglas aplicadas'
  if (path === '/reports') return 'Reportes'
  if (path === '/upload') return 'Cargar archivo'
  if (path === '/agent') return 'Agente IA'
  return ''
}

export default function TopBar(){
  const loc = useLocation()
  const title = pageTitle(loc.pathname)
  const fecha = new Date().toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'short', day:'numeric' })

  return (
    <header className="topbar" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', background:'var(--panel-bg)', borderBottom:'1px solid var(--border)'}}>
      <div className="topbar-title" style={{display:'flex', alignItems:'center', gap:12}}>
        <h3 style={{margin:0}}>{title}</h3>
        <div style={{display:'flex', alignItems:'center', gap:8, marginLeft:8}}>
          <span style={{width:10,height:10,background:'var(--accent)',borderRadius:10,display:'inline-block', boxShadow:'0 0 6px rgba(96,165,250,0.5)', animation:'pulse 2s infinite'}}></span>
          <small style={{color:'var(--muted)'}}>{fecha}</small>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:36,height:36,borderRadius:18,background:'#e6eef6',display:'grid',placeItems:'center',fontWeight:700,color:'var(--text)'}}>F</div>
      </div>
    </header>
  )
}
