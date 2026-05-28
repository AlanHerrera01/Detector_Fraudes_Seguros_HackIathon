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

function RiskPill({ level }) {
  const colors = {
    rojo: 'var(--risk-red)',
    amarillo: 'var(--risk-yellow)',
    verde: 'var(--risk-green)',
  }
  return (
    <span style={{ background: colors[level] || '#64748b', color: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>
      {level || 'sin nivel'}
    </span>
  )
}

function Badge({ label, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: '#f8fafc', color, fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      {label}
    </span>
  )
}

function Panel({ children, style }) {
  return (
    <section style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 20, ...style }}>
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
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const nav = useNavigate()

  const refreshDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      const [statsData, claimsData, networksData] = await Promise.all([
        api.getDashboardStats(),
        api.getSiniestros({ limit: 200 }),
        api.getProviderNetworks(8),
      ])

      setStats(statsData)
      setClaims(claimsData.items || claimsData || [])
      setNetworks(networksData || [])
      setLastUpdated(new Date())
    } catch (exc) {
      setError(exc.message || 'Error desconocido al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshDashboard()
    const timer = setInterval(refreshDashboard, 60000)
    return () => clearInterval(timer)
  }, [])

  const summary = useMemo(() => {
    const total = stats?.total_siniestros || claims.length || 0
    const red = stats?.casos_rojos ?? stats?.casos_rojo ?? claims.filter((item) => item.nivel_riesgo === 'rojo').length
    const yellow = stats?.casos_amarillos ?? stats?.casos_amarillo ?? claims.filter((item) => item.nivel_riesgo === 'amarillo').length
    const green = stats?.casos_verdes ?? stats?.casos_verde ?? claims.filter((item) => item.nivel_riesgo === 'verde').length
    const critical = stats?.casos_criticos ?? claims.filter((item) => item.clasificacion_riesgo === 'critico' || Number(item.score || 0) >= 90).length
    const top = [...claims].sort((a, b) => b.score - a.score).slice(0, 6)
    const claimsWithAlerts = claims.filter((item) => (item.alertas_detalle || []).length > 0).length

    const providerMap = claims.reduce((acc, item) => {
      const provider = item.beneficiario || 'Proveedor desconocido'
      const bucket = acc[provider] || { provider, total: 0, rojos: 0, scoreSum: 0 }
      bucket.total += 1
      bucket.scoreSum += Number(item.score || 0)
      if (item.nivel_riesgo === 'rojo') bucket.rojos += 1
      acc[provider] = bucket
      return acc
    }, {})

    const topProviders = Object.values(providerMap)
      .map((item) => ({
        ...item,
        promedio: item.total ? Math.round(item.scoreSum / item.total) : 0,
        rojoPct: item.total ? pct(item.rojos, item.total) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    const topRiskProviders = Object.values(providerMap)
      .map((item) => ({
        ...item,
        promedio: item.total ? Math.round(item.scoreSum / item.total) : 0,
        rojoPct: item.total ? pct(item.rojos, item.total) : 0,
      }))
      .sort((a, b) => b.promedio - a.promedio)
      .slice(0, 5)

    const coverageBreakdown = Object.entries(
      claims.reduce((acc, item) => {
        const label = item.cobertura || 'Sin cobertura'
        acc[label] = (acc[label] || 0) + 1
        return acc
      }, {})
    )
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const ramoBreakdown = Object.entries(
      claims.reduce((acc, item) => {
        const label = item.ramo || 'Sin ramo'
        acc[label] = (acc[label] || 0) + 1
        return acc
      }, {})
    )
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const trendMap = claims.reduce((acc, item) => {
      const rawDate = item.fecha_reporte || item.fecha_ocurrencia || ''
      const key = String(rawDate).slice(0, 10)
      if (!key) return acc
      const bucket = acc[key] || { verde: 0, amarillo: 0, rojo: 0, total: 0 }
      bucket[item.nivel_riesgo || 'verde'] += 1
      bucket.total += 1
      acc[key] = bucket
      return acc
    }, {})

    const trend = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        label: shortDateLabel(date),
        date,
        verde: values.verde,
        amarillo: values.amarillo,
        rojo: values.rojo,
        total: values.total,
      }))

    return {
      total,
      red,
      yellow,
      green,
      critical,
      top,
      claimsWithAlerts,
      topProviders,
      topRiskProviders,
      topProvidersMax: topProviders.reduce((max, item) => Math.max(max, item.total), 0),
      coverageBreakdown,
      ramoBreakdown,
      trend,
    }
  }, [stats, claims])

  if (error) {
    return (
      <Panel>
        <h3 style={{ margin: 0 }}>No se pudo cargar el dashboard</h3>
        <p style={{ color: 'var(--muted)', marginTop: 8 }}>{error}</p>
        <button onClick={refreshDashboard} style={{ marginTop: 12, background: '#0f172a', color: '#fff' }}>Reintentar</button>
      </Panel>
    )
  }

  if (!stats) return <div>Cargando dashboard...</div>

  const redPct = pct(summary.red, summary.total)
  const yellowPct = pct(summary.yellow, summary.total)
  const greenPct = pct(summary.green, summary.total)

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28 }}>Panel ejecutivo antifraude</h2>
          <p style={{ color: 'var(--muted)', marginTop: 8, maxWidth: 760 }}>
            Visualiza los indicadores clave, tendencias y proveedores mas riesgosos de tu sistema en tiempo real.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'right' }}>
            <div>Ultima actualizacion</div>
            <div style={{ fontWeight: 700 }}>{lastUpdated ? lastUpdated.toLocaleTimeString('es-CO') : 'Cargando...'}</div>
          </div>
          <button onClick={refreshDashboard} disabled={loading} style={{ background: '#0f172a', color: '#fff' }}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        <StatCard label="Siniestros analizados" value={summary.total} accent="var(--accent)" hint="Total de incidentes en el panel" />
        <StatCard label="Casos criticos" value={summary.critical} accent="#7f1d1d" hint="Puntos de auditoria inmediata" />
        <StatCard label="Score promedio" value={(stats.score_promedio ?? 0).toFixed(1)} accent="var(--risk-yellow)" hint="Riesgo agregado promedio" />
        <StatCard label="Casos con alerta" value={summary.claimsWithAlerts} accent="var(--risk-green)" hint="Siniestros con senales detectadas" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Estado del portafolio</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>Distribucion de siniestros por nivel de riesgo.</p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13 }}>
              <Badge color="var(--risk-green)" label="Verde" />
              <Badge color="var(--risk-yellow)" label="Amarillo" />
              <Badge color="var(--risk-red)" label="Rojo" />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', height: 20, borderRadius: 999, overflow: 'hidden', background: '#eef2f7' }}>
                <div style={{ width: `${greenPct}%`, background: 'var(--risk-green)' }} />
                <div style={{ width: `${yellowPct}%`, background: 'var(--risk-yellow)' }} />
                <div style={{ width: `${redPct}%`, background: 'var(--risk-red)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
                <span>{greenPct}% verde</span>
                <span>{yellowPct}% amarillo</span>
                <span>{redPct}% rojo</span>
              </div>
            </div>
            <div style={{ minWidth: 120, display: 'grid', gap: 10 }}>
              <MiniStat label="Verde" value={summary.green} color="var(--risk-green)" />
              <MiniStat label="Rojo" value={summary.red} color="var(--risk-red)" />
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <h4 style={{ margin: 0, fontSize: 15 }}>Tendencia de casos</h4>
            <p style={{ color: 'var(--muted)', marginTop: 6 }}>Monitoreo diario de alertas por color.</p>
            <TrendLineChart data={summary.trend} series={[{ key: 'rojo', label: 'Rojo', color: 'var(--risk-red)' }, { key: 'amarillo', label: 'Amarillo', color: 'var(--risk-yellow)' }, { key: 'verde', label: 'Verde', color: 'var(--risk-green)' }]} />
          </div>
        </Panel>

        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Resumen rapido</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>Principales indicadores del sistema.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            <SummaryLine label="Proveedores evaluados" value={networks.length} />
            <SummaryLine label="Casos con alertas" value={summary.claimsWithAlerts} />
            <SummaryLine label="Coberturas principales" value={summary.coverageBreakdown.length} />
            <SummaryLine label="Ramos activos" value={summary.ramoBreakdown.length} />
          </div>
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        <Panel>
          <div style={panelHeaderStyle}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Top proveedores</h3>
              <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>Casos por proveedor.</p>
            </div>
            <button onClick={() => nav('/providers')} style={panelButtonStyle}>Ver red</button>
          </div>
          <PieChart data={summary.topProviders} labelKey="provider" valueKey="total" />
        </Panel>

        <Panel>
          <div style={panelHeaderStyle}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Ramos frecuentes</h3>
              <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>Distribucion por ramo.</p>
            </div>
            <button onClick={() => nav('/siniestros')} style={panelButtonStyle}>Explorar</button>
          </div>
          <BreakdownChart items={summary.ramoBreakdown} color="var(--risk-green)" />
        </Panel>

        <Panel>
          <div style={panelHeaderStyle}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Riesgo por proveedor</h3>
              <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>Score promedio.</p>
            </div>
            <button onClick={() => nav('/providers')} style={panelButtonStyle}>Ver red</button>
          </div>
          <PieChart data={summary.topRiskProviders} labelKey="provider" valueKey="promedio" />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel>
          <div style={panelHeaderStyle}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Coberturas frecuentes</h3>
              <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>Segmentos principales.</p>
            </div>
            <button onClick={() => nav('/siniestros')} style={panelButtonStyle}>Explorar</button>
          </div>
          <BreakdownChart items={summary.coverageBreakdown} color="var(--risk-yellow)" />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Casos recientes prioritarios</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>Siniestros con mayor puntaje para revision inmediata.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {summary.top.map((item) => {
              const level = levelFromScore(item.score)
              return (
                <button key={item.id_siniestro} onClick={() => nav(`/siniestros/${item.id_siniestro}`)} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center', background: '#f8fafc', border: '1px solid var(--border)', padding: 16, borderRadius: 12, textAlign: 'left' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>{item.id_siniestro}</div>
                    <div style={{ color: 'var(--muted)', marginTop: 6 }}>{item.cobertura || 'Cobertura desconocida'} • {item.beneficiario || 'Proveedor'} • {item.ramo || 'Categoria'}</div>
                  </div>
                  <div style={{ display: 'grid', gap: 8, alignItems: 'end' }}>
                    <RiskPill level={item.nivel_riesgo || level.nivel} />
                    <strong style={{ color: level.color, fontSize: 20 }}>{item.score}</strong>
                  </div>
                </button>
              )
            })}
          </div>
        </Panel>

        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Concentracion por proveedor</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>Redes de riesgo con los mayores indicadores.</p>
            </div>
            <button onClick={() => nav('/providers')} style={panelButtonStyle}>Explorar</button>
          </div>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            {networks.slice(0, 5).map((item) => (
              <div key={item.beneficiario} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', background: '#fafbff', borderRadius: 12, padding: 14, border: '1px solid #eef2f7' }}>
                <div>
                  <strong>{item.beneficiario}</strong>
                  <div style={{ color: 'var(--muted)', marginTop: 6, fontSize: 13 }}>
                    {item.total_casos ?? 0} casos • {item.asegurados_unicos ?? 0} asegurados • {item.vehiculos_unicos ?? 0} vehiculos
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{item.indice_concentracion ?? 'N/A'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>Indice</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ display: 'grid', gap: 6, padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      <strong style={{ color, fontSize: 18 }}>{value}</strong>
    </div>
  )
}

function SummaryLine({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

const panelButtonStyle = {
  background: '#eef2f7',
  color: '#111827',
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 10,
  border: '1px solid #dbeafe',
  whiteSpace: 'nowrap',
  flex: '0 0 auto',
  transition: 'transform 180ms ease, background 180ms ease',
}

const panelHeaderStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 12,
  alignItems: 'start',
  marginBottom: 8,
}

function PieChart({ data, labelKey, valueKey }) {
  const colors = ['#2563eb', '#7c3aed', '#06b6d4', '#0d9488', '#ea580c', '#dc2626', '#d97706', '#0891b2', '#4f46e5', '#4338ca']
  const validData = data && data.length > 0 ? data : []
  const total = validData.reduce((sum, item) => sum + Number(item[valueKey] || 0), 0)
  
  if (validData.length === 0 || total === 0) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', gap: 12, marginTop: 14, minHeight: 200, background: '#f8fafc', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 48 }}>📊</div>
        <div style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>No hay datos para mostrar en este gráfico.</div>
      </div>
    )
  }

  const size = 200
  const center = size / 2
  const radius = 70

  let startAngle = 0
  const slices = validData.map((item, index) => {
    const value = Number(item[valueKey] || 0)
    const sliceAngle = (value / total) * 360
    const endAngle = startAngle + sliceAngle
    
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180
    const x1 = center + radius * Math.cos(startRad)
    const y1 = center + radius * Math.sin(startRad)
    const x2 = center + radius * Math.cos(endRad)
    const y2 = center + radius * Math.sin(endRad)
    
    const largeArc = sliceAngle > 180 ? 1 : 0
    const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
    
    const labelAngle = startAngle + sliceAngle / 2
    const labelRad = (labelAngle * Math.PI) / 180
    const labelX = center + (radius * 0.65) * Math.cos(labelRad)
    const labelY = center + (radius * 0.65) * Math.sin(labelRad)
    
    const pct = Math.round((value / total) * 100)
    
    const result = {
      path: pathData,
      color: colors[index % colors.length],
      label: String(item[labelKey] || 'Otro'),
      value,
      pct,
      labelX,
      labelY,
    }
    
    startAngle = endAngle
    return result
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 14 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 280, height: 280 }}>
        {slices.map((slice, idx) => (
          <g key={idx}>
            <path d={slice.path} fill={slice.color} opacity={0.9} stroke="#fff" strokeWidth="2" style={{ transition: 'opacity 200ms ease' }} />
            {slice.pct > 5 && (
              <text x={slice.labelX} y={slice.labelY} textAnchor="middle" dy="0.3em" style={{ fontSize: 12, fontWeight: 700, fill: '#fff', pointerEvents: 'none' }}>
                {slice.pct}%
              </text>
            )}
          </g>
        ))}
      </svg>
      <div style={{ display: 'grid', gap: 8, width: '100%' }}>
        {slices.map((slice, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: slice.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slice.label}</span>
            <strong style={{ flexShrink: 0 }}>{slice.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarChart({ data, labelKey, valueKey, color }) {
  const max = Math.max(1, ...data.map((item) => Number(item[valueKey] || 0)))
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
      {data.map((item) => {
        const value = Number(item[valueKey] || 0)
        const width = `${Math.round((value / max) * 100)}%`
        return (
          <div key={`${item[labelKey]}-${value}`} style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: 'var(--muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item[labelKey]}</span>
              <strong>{value}</strong>
            </div>
            <div style={{ height: 12, width: '100%', background: '#eef2f7', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width, height: '100%', borderRadius: 999, background: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BreakdownChart({ items, color }) {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
      {items.map((item) => {
        const width = total ? Math.round((item.count / total) * 100) : 0
        return (
          <div key={item.label} style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
              <span>{item.label}</span>
              <span>{item.count}</span>
            </div>
            <div style={{ height: 10, width: '100%', background: '#eef2f7', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${width}%`, height: '100%', borderRadius: 999, background: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TrendLineChart({ data, series, height = 210 }) {
  const width = 520
  const pad = 18
  const maxValue = Math.max(1, ...data.flatMap((item) => series.map((serie) => item[serie.key] || 0)))
  const points = series.map((serie) => ({
    serie,
    values: data.map((item, index) => {
      const x = pad + (index * (width - pad * 2)) / Math.max(1, data.length - 1)
      const y = height - pad - ((item[serie.key] || 0) / maxValue) * (height - pad * 2)
      return { ...item, x, y }
    }),
  }))

  const svgPath = (values) => values.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  if (!data.length) {
    return <div style={{ color: 'var(--muted)', marginTop: 14 }}>Sin datos de tendencia.</div>
  }

  return (
    <div style={{ marginTop: 14, overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = height - pad - tick * (height - pad * 2)
          return <line key={tick} x1={pad} x2={width - pad} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
        })}
        {points.map(({ values, serie }) => (
          <path key={serie.key} d={svgPath(values)} fill="none" stroke={serie.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
        ))}
        {points.map(({ values, serie }) => (
          values.map((point, idx) => (
            <circle key={`${serie.key}-${idx}`} cx={point.x} cy={point.y} r="3" fill={serie.color} />
          ))
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>
        <span>{data[0]?.label || ''}</span>
        <span>{data.length} dias</span>
        <span>{data[data.length - 1]?.label || ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        {series.map((serie) => (
          <Badge key={serie.key} label={serie.label} color={serie.color} />
        ))}
      </div>
    </div>
  )
}
