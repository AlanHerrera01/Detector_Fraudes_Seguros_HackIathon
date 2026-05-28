import { useEffect, useMemo, useState } from 'react'
import useFraudData from '../hooks/useFraudData'

function riskColor(value = 0) {
  if (value >= 2) return 'var(--risk-red)'
  if (value === 1) return 'var(--risk-yellow)'
  return 'var(--risk-green)'
}

export default function Providers() {
  const api = useFraudData()
  const [list, setList] = useState([])
  const [network, setNetwork] = useState([])

  useEffect(() => {
    api.getProveedores().then(setList)
    api.getProviderNetworks(8).then(setNetwork)
  }, [api])

  const summary = useMemo(() => {
    const providers = network.length || list.length
    const redAlerts = list.reduce((total, item) => total + Number(item.alertas_rojas ?? item.alertas ?? 0), 0)
    const cases = network.reduce((total, item) => total + Number(item.total_casos || 0), 0)
    const top = network[0] || list[0] || {}
    return { providers, redAlerts, cases, top: top.beneficiario || top.nombre || '-' }
  }, [list, network])

  const maxScore = Math.max(...list.map((p) => Number(p.score_promedio || p.alertas || 0)), 1)

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <span style={eyebrowStyle}>Red de riesgo</span>
          <h3 style={titleStyle}>Concentraciones por proveedor</h3>
          <p style={subtitleStyle}>
            Vista para detectar focos donde se repiten casos, asegurados, vehiculos y alertas rojas.
          </p>
        </div>
        <div style={metricGridStyle}>
          <Metric label="Proveedores" value={summary.providers} />
          <Metric label="Casos vinculados" value={summary.cases} />
          <Metric label="Alertas rojas" value={summary.redAlerts} tone="red" />
          <Metric label="Foco principal" value={summary.top} wide />
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h4 style={sectionTitleStyle}>Nodos con mayor concentracion</h4>
            <p style={sectionSubtitleStyle}>Indice combinado por casos, asegurados, vehiculos y alertas.</p>
          </div>
        </div>

        <div style={networkGridStyle}>
          {network.slice(0, 4).map((item) => (
            <NetworkCard key={item.beneficiario} item={item} />
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h4 style={sectionTitleStyle}>Ranking de proveedores</h4>
            <p style={sectionSubtitleStyle}>Prioriza por alertas rojas y score promedio.</p>
          </div>
        </div>

        <div style={rankingStyle}>
          {list.map((p, idx) => {
            const score = Number(p.score_promedio || p.alertas || 0)
            const redAlerts = Number(p.alertas_rojas ?? p.alertas ?? 0)
            return (
              <div key={p.beneficiario || p.id} style={rankingRowStyle}>
                <div style={rankNumberStyle}>{idx + 1}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={rowTitleStyle}>{p.beneficiario || p.nombre}</div>
                  <div style={barTrackStyle}>
                    <div
                      style={{
                        ...barFillStyle,
                        width: `${Math.max(4, Math.min(100, (score / maxScore) * 100))}%`,
                        background: riskColor(redAlerts),
                      }}
                    />
                  </div>
                </div>
                <div style={rowStatsStyle}>
                  <strong>{redAlerts}</strong>
                  <span>rojas</span>
                </div>
                <div style={scoreStyle}>
                  <strong>{score.toFixed ? score.toFixed(1) : score}</strong>
                  <span>score</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, tone, wide }) {
  return (
    <div style={{ ...metricStyle, gridColumn: wide ? 'span 2' : undefined }}>
      <span style={metricLabelStyle}>{label}</span>
      <strong style={{ ...metricValueStyle, color: tone === 'red' ? 'var(--risk-red)' : 'var(--text)' }}>{value}</strong>
    </div>
  )
}

function NetworkCard({ item }) {
  const redAlerts = Number(item.alertas_rojas || 0)
  return (
    <article style={networkCardStyle}>
      <div style={networkTopStyle}>
        <div>
          <h4 style={providerTitleStyle}>{item.beneficiario}</h4>
          <p style={providerSubtitleStyle}>{redAlerts ? 'Requiere revision prioritaria' : 'Sin alertas rojas concentradas'}</p>
        </div>
        <div style={{ ...indexBadgeStyle, borderColor: riskColor(redAlerts), color: riskColor(redAlerts) }}>
          {item.indice_concentracion}
          <span>indice</span>
        </div>
      </div>
      <div style={cardStatGridStyle}>
        <SmallStat label="Casos" value={item.total_casos} />
        <SmallStat label="Asegurados" value={item.asegurados_unicos} />
        <SmallStat label="Vehiculos" value={item.vehiculos_unicos} />
        <SmallStat label="Rojas" value={item.alertas_rojas} danger={redAlerts > 0} />
      </div>
    </article>
  )
}

function SmallStat({ label, value, danger }) {
  return (
    <div style={smallStatStyle}>
      <strong style={{ color: danger ? 'var(--risk-red)' : 'var(--text)' }}>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

const pageStyle = {
  display: 'grid',
  gap: 16,
}

const heroStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 520px',
  gap: 16,
  alignItems: 'stretch',
  background: 'var(--panel-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 18,
}

const eyebrowStyle = {
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const titleStyle = {
  margin: '4px 0 0',
  fontSize: 26,
}

const subtitleStyle = {
  color: 'var(--text-secondary)',
  marginTop: 8,
  lineHeight: 1.5,
  maxWidth: 720,
}

const metricGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 10,
}

const metricStyle = {
  background: '#111827',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: 12,
  minHeight: 76,
}

const metricLabelStyle = {
  display: 'block',
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
}

const metricValueStyle = {
  display: 'block',
  marginTop: 9,
  fontSize: 22,
  lineHeight: 1.1,
}

const sectionStyle = {
  background: 'var(--panel-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 14,
}

const sectionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 12,
}

const sectionTitleStyle = {
  margin: 0,
}

const sectionSubtitleStyle = {
  color: 'var(--text-secondary)',
  marginTop: 4,
  fontSize: 13,
}

const networkGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const networkCardStyle = {
  background: '#111827',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: 14,
}

const networkTopStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'start',
}

const providerTitleStyle = {
  margin: 0,
  fontSize: 17,
}

const providerSubtitleStyle = {
  marginTop: 4,
  color: 'var(--text-secondary)',
  fontSize: 13,
}

const indexBadgeStyle = {
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: '7px 10px',
  minWidth: 74,
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  fontWeight: 900,
}

const cardStatGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 8,
  marginTop: 14,
}

const smallStatStyle = {
  background: 'var(--panel-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 9,
  display: 'grid',
  gap: 2,
  fontSize: 12,
  color: 'var(--muted)',
}

const rankingStyle = {
  display: 'grid',
  gap: 8,
}

const rankingRowStyle = {
  background: '#111827',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: 12,
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr) 90px 90px',
  alignItems: 'center',
  gap: 12,
}

const rankNumberStyle = {
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--panel-bg)',
  color: 'var(--accent)',
  fontWeight: 900,
}

const rowTitleStyle = {
  fontWeight: 850,
  marginBottom: 8,
  color: 'var(--text)',
}

const barTrackStyle = {
  height: 8,
  background: '#334155',
  borderRadius: 8,
  overflow: 'hidden',
}

const barFillStyle = {
  height: 8,
  borderRadius: 8,
}

const rowStatsStyle = {
  display: 'grid',
  justifyItems: 'end',
  color: 'var(--text-secondary)',
  fontSize: 12,
}

const scoreStyle = {
  display: 'grid',
  justifyItems: 'end',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
}
