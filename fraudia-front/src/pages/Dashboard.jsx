import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useFraudData from '../hooks/useFraudData'
import StatCard from '../components/ui/StatCard'
import { formatCurrency, levelFromScore } from '../utils/riskHelpers'

function pct(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function shortDateLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '')
  return date.toLocaleDateString('es-CO', { month: 'short', day: '2-digit' })
}

function alertFamily(code = '') {
  const normalized = String(code).toUpperCase()
  if (normalized.startsWith('RF-')) return 'Regla fuerte'
  if (normalized.startsWith('NLP-')) return 'Narrativa NLP'
  return 'Senal de negocio'
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
  const [networks, setNetworks] = useState([])
  const [error, setError] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    Promise.all([
      api.getDashboardStats(),
      api.getSiniestros({ limit: 100 }),
      api.getProviderNetworks(5),
    ])
      .then(([statsData, claimsData, networksData]) => {
        setStats(statsData)
        setClaims(claimsData.items || [])
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
    const redByDate = claims.reduce((acc, item) => {
      const rawDate = item.fecha_reporte || item.fecha_ocurrencia || 'sin fecha'
      const key = String(rawDate).slice(0, 10)
      if (!acc[key]) acc[key] = { count: 0, red: 0, score: 0 }
      acc[key].count += 1
      acc[key].score += Number(item.score || 0)
      if (item.nivel_riesgo === 'rojo') acc[key].red += 1
      return acc
    }, {})
    let redTrend = Object.entries(redByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        label: shortDateLabel(date),
        date,
        value: values.red,
        count: values.count,
        avgScore: Math.round(values.score / values.count),
      }))
    if (redTrend.length <= 1 && claims.length > 1) {
      redTrend = [...claims]
        .sort((a, b) => String(a.fecha_reporte || a.fecha_ocurrencia || a.id_siniestro).localeCompare(String(b.fecha_reporte || b.fecha_ocurrencia || b.id_siniestro)))
        .map((item) => ({
          label: shortDateLabel(item.fecha_reporte || item.fecha_ocurrencia || item.id_siniestro),
          date: item.fecha_reporte || item.fecha_ocurrencia || item.id_siniestro,
          value: item.nivel_riesgo === 'rojo' ? 1 : 0,
          count: 1,
          avgScore: Number(item.score || 0),
        }))
    }
    const alertMap = claims.reduce((acc, item) => {
      ;(item.alertas_detalle || []).forEach((alert) => {
        const code = alert.codigo || 'ALR'
        if (!acc[code]) {
          acc[code] = {
            label: code,
            value: 0,
            points: 0,
            family: alertFamily(code),
          }
        }
        acc[code].value += 1
        acc[code].points += Number(alert.puntos || 0)
      })
      return acc
    }, {})
    const fraudSignals = Object.values(alertMap)
      .sort((a, b) => b.points - a.points || b.value - a.value)
      .slice(0, 6)
    return { total, red, yellow, green, top, nlpCases, redTrend, fraudSignals }
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
          <button onClick={() => nav('/siniestros')}>Revisar casos</button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <StatCard label="Siniestros analizados" value={summary.total} accent="var(--accent)" hint="Portafolio activo" />
        <StatCard label="Casos rojos" value={summary.red} accent="var(--risk-red)" hint={`${redPct}% requieren prioridad`} />
        <StatCard label="Casos con NLP" value={summary.nlpCases} accent="var(--risk-yellow)" hint="Narrativas con senales" />
        <StatCard label="Score promedio" value={stats.score_promedio ?? formatCurrency(stats.ahorro_potencial || 0)} accent="var(--risk-green)" hint="Riesgo agregado" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Evolucion de casos rojos</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>Cantidad de siniestros de prioridad roja por fecha de reporte.</p>
            </div>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>alertas rojas</span>
          </div>
          <LineChart data={summary.redTrend} color="var(--risk-red)" label="fechas con riesgo rojo" />
        </Panel>

        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Senales que disparan riesgo</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>Reglas y NLP que mas aportan puntos al score.</p>
            </div>
          </div>
          <HorizontalBarChart data={summary.fraudSignals} />
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
                    <span style={{ display: 'block', color: 'var(--muted)', marginTop: 2 }}>{item.cobertura} - {item.beneficiario}</span>
                  </span>
                  <RiskPill level={item.nivel_riesgo || level.nivel} />
                  <strong style={{ color: level.color }}>{item.score}</strong>
                </button>
              )
            })}
          </div>
        </Panel>

        <Panel>
          <h3 style={{ margin: 0 }}>Concentracion sospechosa por proveedor</h3>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>Proveedores con mas casos, asegurados/vehiculos relacionados y alertas rojas.</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {networks.slice(0, 4).map((item) => (
              <div key={item.beneficiario} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <strong>{item.beneficiario}</strong>
                  <div style={{ color: 'var(--muted)', marginTop: 3 }}>
                    {item.total_casos} casos - {item.asegurados_unicos} asegurados - {item.vehiculos_unicos} vehiculos
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

function LineChart({ data, color = '#2563eb', label = 'fechas' }) {
  const width = 520
  const height = 190
  const pad = 18
  const maxValue = Math.max(1, ...data.map((item) => item.value || 0))
  const points = data.map((item, index) => {
    const x = pad + (index * (width - pad * 2)) / Math.max(1, data.length - 1)
    const y = height - pad - (Math.max(0, item.value || 0) / maxValue) * (height - pad * 2)
    return { ...item, x, y }
  })
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  if (!points.length) {
    return <div style={{ color: 'var(--muted)', marginTop: 14 }}>Sin fechas suficientes para calcular tendencia.</div>
  }

  return (
    <div style={{ marginTop: 14, overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 210, display: 'block' }}>
        <defs>
          <linearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = height - pad - tick * (height - pad * 2)
          return <line key={tick} x1={pad} x2={width - pad} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
        })}
        {points.length > 0 && <path d={`${path} L ${points[points.length - 1].x} ${height - pad} L ${points[0].x} ${height - pad} Z`} fill="url(#scoreFill)" />}
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="4" fill="#fff" stroke={color} strokeWidth="2" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--muted)', fontSize: 12 }}>
        <span>{points[0].label}</span>
        <span>{points.length} {label} - max {maxValue}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}

function HorizontalBarChart({ data }) {
  const max = Math.max(1, ...data.map((item) => item.value || 0))

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
      {data.length ? data.map((item) => (
        <div key={item.label} style={{ display: 'grid', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{item.label}</strong>
              <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 12 }}>{item.family}</span>
            </div>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{item.value} casos - {item.points} pts</span>
          </div>
          <div style={{ height: 12, background: '#eef2f7', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(6, (item.value / max) * 100)}%`, height: '100%', background: item.family === 'Regla fuerte' ? 'var(--risk-red)' : item.family === 'Narrativa NLP' ? '#0ea5e9' : 'var(--risk-yellow)' }} />
          </div>
        </div>
      )) : <div style={{ color: 'var(--muted)' }}>Sin alertas suficientes para graficar.</div>}
    </div>
  )
}
