import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useFraudData from '../hooks/useFraudData'
import StatCard from '../components/ui/StatCard'
import { formatCurrency, levelFromScore } from '../utils/riskHelpers'

function pct(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function RiskPill({ level }) {
  const colors = {
    rojo: 'var(--risk-red)',
    amarillo: 'var(--risk-yellow)',
    verde: 'var(--risk-green)',
  }
  return (
    <span style={{ background: colors[level] || '#64748b', color: '#fff', borderRadius: 999, padding: '4px 8px', fontSize: 12, fontWeight: 700 }}>
      {level || 'sin nivel'}
    </span>
  )
}

function Panel({ children, style }) {
  return (
    <section style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, ...style }}>
      {children}
    </section>
  )
}

export default function Dashboard() {
  const api = useFraudData()
  const [stats, setStats] = useState(null)
  const [claims, setClaims] = useState([])
  const [providers, setProviders] = useState([])
  const [networks, setNetworks] = useState([])
  const [error, setError] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    Promise.all([
      api.getDashboardStats(),
      api.getSiniestros({ limit: 100 }),
      api.getProveedores(),
      api.getProviderNetworks(5),
    ])
      .then(([statsData, claimsData, providersData, networksData]) => {
        setStats(statsData)
        setClaims(claimsData.items || [])
        setProviders(providersData || [])
        setNetworks(networksData || [])
      })
      .catch((exc) => setError(exc.message))
  }, [])

  const summary = useMemo(() => {
    const total = stats?.total_siniestros || claims.length || 0
    const red = stats?.casos_rojos ?? stats?.casos_rojo ?? claims.filter((item) => item.nivel_riesgo === 'rojo').length
    const yellow = stats?.casos_amarillos ?? stats?.casos_amarillo ?? claims.filter((item) => item.nivel_riesgo === 'amarillo').length
    const green = stats?.casos_verdes ?? stats?.casos_verde ?? claims.filter((item) => item.nivel_riesgo === 'verde').length
    const top = [...claims].sort((a, b) => b.score - a.score).slice(0, 5)
    const nlpCases = claims.filter((item) => (item.senales_narrativa || []).length > 0).length
    return { total, red, yellow, green, top, nlpCases }
  }, [stats, claims])

  if (error) {
    return (
      <Panel>
        <h3 style={{ margin: 0 }}>No se pudo cargar el dashboard</h3>
        <p style={{ color: 'var(--muted)', marginTop: 8 }}>{error}</p>
        <button onClick={() => nav('/upload')} style={{ marginTop: 12, background: '#0f172a', color: '#fff' }}>Ir a cargar archivo</button>
      </Panel>
    )
  }

  if (!stats) return <div>Cargando dashboard...</div>

  const criticalProvider = providers[0]
  const criticalNetwork = networks[0]
  const redPct = pct(summary.red, summary.total)
  const yellowPct = pct(summary.yellow, summary.total)
  const greenPct = pct(summary.green, summary.total)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26 }}>Panel ejecutivo antifraude</h2>
          <p style={{ color: 'var(--muted)', marginTop: 6, maxWidth: 760 }}>
            Priorizacion de siniestros, senales narrativas y concentraciones por proveedor para orientar revision humana.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => nav('/upload')} style={{ background: '#0f172a', color: '#fff' }}>Cargar CSV/PDF</button>
          <button onClick={() => nav('/agent')}>Preguntar al agente</button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <StatCard label="Siniestros analizados" value={summary.total} accent="var(--accent)" hint="Portafolio activo" />
        <StatCard label="Casos rojos" value={summary.red} accent="var(--risk-red)" hint={`${redPct}% requieren prioridad`} />
        <StatCard label="Casos con NLP" value={summary.nlpCases} accent="var(--risk-yellow)" hint="Narrativas con senales" />
        <StatCard label="Score promedio" value={stats.score_promedio ?? formatCurrency(stats.ahorro_potencial || 0)} accent="var(--risk-green)" hint="Riesgo agregado" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 12 }}>
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
            <div>
              <h3 style={{ margin: 0 }}>Semaforo del portafolio</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>Distribucion de casos segun nivel de riesgo.</p>
            </div>
            <strong>{summary.total} casos</strong>
          </div>

          <div style={{ display: 'flex', height: 18, borderRadius: 999, overflow: 'hidden', marginTop: 18, background: '#eef2f7' }}>
            <div style={{ width: `${greenPct}%`, background: 'var(--risk-green)' }} />
            <div style={{ width: `${yellowPct}%`, background: 'var(--risk-yellow)' }} />
            <div style={{ width: `${redPct}%`, background: 'var(--risk-red)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
            <RiskSummary label="Verde" value={summary.green} percent={greenPct} color="var(--risk-green)" />
            <RiskSummary label="Amarillo" value={summary.yellow} percent={yellowPct} color="var(--risk-yellow)" />
            <RiskSummary label="Rojo" value={summary.red} percent={redPct} color="var(--risk-red)" />
          </div>
        </Panel>

        <Panel>
          <h3 style={{ margin: 0 }}>Lectura rapida</h3>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <Insight label="Proveedor a revisar" value={criticalProvider?.beneficiario || criticalProvider?.nombre || 'Sin datos'} detail={`${criticalProvider?.alertas_rojas ?? 0} alertas rojas`} />
            <Insight label="Red mas concentrada" value={criticalNetwork?.beneficiario || 'Sin datos'} detail={`Indice ${criticalNetwork?.indice_concentracion ?? 0}`} />
            <Insight label="Siguiente paso" value="Revisar casos rojos" detail="Validar documentos, narrativa y proveedor antes de decidir." />
          </div>
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Prioridad de revision</h3>
            <button onClick={() => nav('/siniestros')}>Ver todos</button>
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {summary.top.map((item) => {
              const level = levelFromScore(item.score)
              return (
                <button
                  key={item.id_siniestro}
                  onClick={() => nav(`/siniestros/${item.id_siniestro}`)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', textAlign: 'left', background: '#f8fafc', border: '1px solid var(--border)' }}
                >
                  <span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{item.id_siniestro}</strong>
                    <span style={{ display: 'block', color: 'var(--muted)', marginTop: 2 }}>{item.cobertura} · {item.beneficiario}</span>
                  </span>
                  <RiskPill level={item.nivel_riesgo || level.nivel} />
                  <strong style={{ color: level.color }}>{item.score}</strong>
                </button>
              )
            })}
          </div>
        </Panel>

        <Panel>
          <h3 style={{ margin: 0 }}>Senales IA y red</h3>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {networks.slice(0, 4).map((item) => (
              <div key={item.beneficiario} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <strong>{item.beneficiario}</strong>
                  <div style={{ color: 'var(--muted)', marginTop: 3 }}>
                    {item.total_casos} casos · {item.asegurados_unicos} asegurados · {item.vehiculos_unicos} vehiculos
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{item.indice_concentracion}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function RiskSummary({ label, value, percent, color }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
        <strong>{label}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18 }}>{value}</span>
        <span style={{ color: 'var(--muted)' }}>{percent}%</span>
      </div>
    </div>
  )
}

function Insight({ label, value, detail }) {
  return (
    <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 10 }}>
      <div style={{ color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase' }}>{label}</div>
      <strong style={{ display: 'block', marginTop: 3 }}>{value}</strong>
      <div style={{ color: 'var(--muted)', marginTop: 3 }}>{detail}</div>
    </div>
  )
}
