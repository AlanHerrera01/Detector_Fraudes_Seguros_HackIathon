import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useFraudData from '../hooks/useFraudData'
import ScoreGauge from '../components/ui/ScoreGauge'
import AlertCard from '../components/ui/AlertCard'
import { suggestedAction, formatCurrency, formatDate } from '../utils/riskHelpers'

const ALERT_GROUPS = [
  {
    key: 'rf',
    title: 'RF - Reglas fuertes',
    subtitle: 'Documentos alterados, listas restrictivas, perdida total por robo o dinamicas de alto riesgo.',
    color: 'var(--risk-red)',
  },
  {
    key: 's',
    title: 'S - Senales de negocio',
    subtitle: 'Fechas cercanas a vigencia, reporte tardio, frecuencia, proveedor recurrente o monto elevado.',
    color: 'var(--risk-yellow)',
  },
  {
    key: 'nlp',
    title: 'NLP - Narrativa',
    subtitle: 'Relato vago, inconsistente, terminos sensibles o falta de soporte narrativo.',
    color: '#0ea5e9',
  },
]

function alertGroupKey(alert) {
  const code = String(alert?.codigo || '').toUpperCase()
  if (code.startsWith('RF-')) return 'rf'
  if (code.startsWith('NLP-')) return 'nlp'
  if (code.startsWith('S-')) return 's'
  return 's'
}

function groupAlerts(alerts = []) {
  return ALERT_GROUPS.map((group) => ({
    ...group,
    alerts: alerts.filter((alert) => alertGroupKey(alert) === group.key),
  }))
}

function riskTheme(level = 'verde') {
  if (level === 'rojo') {
    return {
      label: 'Revision especializada',
      badge: 'Alto riesgo',
      color: 'var(--risk-red)',
      soft: '#fef2f2',
      tint: '#fff7f7',
      border: '#fecaca',
    }
  }
  if (level === 'amarillo') {
    return {
      label: 'Revision documental',
      badge: 'Riesgo medio',
      color: 'var(--risk-yellow)',
      soft: '#fffbeb',
      tint: '#fffdf5',
      border: '#fed7aa',
    }
  }
  return {
    label: 'Flujo normal',
    badge: 'Bajo riesgo',
    color: 'var(--risk-green)',
    soft: '#f0fdf4',
    tint: '#f8fffb',
    border: '#bbf7d0',
  }
}

function splitSummarySentences(summary = '') {
  const clean = String(summary).replace(/\s+/g, ' ').trim()
  if (!clean) return []

  const sentences = []
  let start = 0

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i]
    if (!'.!?'.includes(char)) continue

    const previous = clean[i - 1] || ''
    const next = clean[i + 1] || ''
    if (/\d/.test(previous) && /\d/.test(next)) continue

    sentences.push(clean.slice(start, i + 1).trim())
    while (clean[i + 1] === ' ') i += 1
    start = i + 1
  }

  if (start < clean.length) sentences.push(clean.slice(start).trim())
  return sentences.filter(Boolean)
}

export default function SiniestroDetail() {
  const { id } = useParams()
  const api = useFraudData()
  const [item, setItem] = useState(null)
  const [explanation, setExplanation] = useState(null)
  const nav = useNavigate()

  useEffect(() => {
    api.getSiniestroById(id).then(setItem)
    api.getClaimExplanation(id).then(setExplanation).catch(() => setExplanation(null))
  }, [api, id])

  if (!item) return <div>Cargando...</div>

  const groupedAlerts = groupAlerts(item.alertas_detalle || [])

  return (
    <div className="detail-grid" style={pageGridStyle}>
      <main style={mainPanelStyle}>
        <button onClick={() => nav('/siniestros')} style={{ marginBottom: 12 }}>Volver a siniestros</button>
        <p style={ethicsInlineTextStyle}>
          {explanation?.nota_etica || 'Esta salida prioriza revision humana. No confirma fraude, no debe usarse para negar automaticamente un siniestro y puede contener falsos positivos.'}
        </p>
        <CaseHeader item={item} />
        <ChecklistSection steps={explanation?.acciones_recomendadas || []} />

        <ExecutiveSummary item={item} explanation={explanation} />
        <NarrativeSection item={item} />
        <AlertsSection groupedAlerts={groupedAlerts} hasAlerts={(item.alertas_detalle || []).length > 0} />
      </main>

    </div>
  )
}

function ChecklistSection({ steps }) {
  return (
    <section style={checklistSectionStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h4 style={{ margin: 0 }}>Checklist de analista</h4>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>Pasos sugeridos para revisar el caso antes de decidir.</div>
        </div>
      </div>
      <div className="detail-checklist-grid" style={checklistGridStyle}>
        {steps.length
          ? steps.map((step) => <div key={step} style={checkItemStyle}>{step}</div>)
          : <div style={emptyStateStyle}>Sin acciones recomendadas registradas para este caso.</div>}
      </div>
    </section>
  )
}

function CaseHeader({ item }) {
  const theme = riskTheme(item.nivel_riesgo)
  const action = suggestedAction(item.score)
  const facts = [
    { label: 'Ramo', value: item.ramo },
    { label: 'Monto', value: formatCurrency(item.monto_reclamado || 0), mono: true },
    { label: 'Fecha', value: formatDate(item.fecha_ocurrencia) },
    { label: 'Proveedor', value: item.beneficiario },
    { label: 'Nivel', value: item.nivel_riesgo },
    { label: 'Clasificacion', value: item.clasificacion_riesgo },
  ]

  return (
    <section className="detail-case-header" style={caseHeaderStyle}>
      <div style={caseIdentityStyle}>
        <div>
          <span style={caseEyebrowStyle}>Caso 360</span>
          <h3 style={caseTitleStyle}>{item.id_siniestro}</h3>
        </div>
      </div>

      <div className="detail-facts-grid" style={caseFactsStyle}>
        {facts.map((fact) => (
          <div key={fact.label} style={caseFactStyle}>
            <span style={caseFactLabelStyle}>{fact.label}</span>
            <strong style={fact.mono ? { fontFamily: 'var(--font-mono)' } : undefined}>{fact.value || '-'}</strong>
          </div>
        ))}
      </div>

      <div className="detail-case-risk" style={caseRiskPanelStyle}>
        <span style={statusBadgeStyle(theme)}>{theme.badge}</span>
        <div style={caseGaugeWrapStyle}>
          <ScoreGauge score={item.score} size={124} />
        </div>
        <div style={caseActionPanelStyle}>
          <span style={caseFactLabelStyle}>Accion sugerida</span>
          <strong style={{ ...caseActionBadgeStyle, background: action.color }}>{action.action}</strong>
        </div>
      </div>
    </section>
  )
}

function ExecutiveSummary({ item, explanation }) {
  const theme = riskTheme(item.nivel_riesgo)
  const summary = explanation?.resumen_ejecutivo || item.explicacion_ia || 'Sin resumen disponible.'
  const sentences = splitSummarySentences(summary)
  const lead = sentences[0] || summary
  const favorable = sentences.find((sentence) => sentence.toLowerCase().startsWith('a favor'))
  const recommendation = [...sentences].reverse().find((sentence) => {
    const lower = sentence.toLowerCase()
    return lower.includes('recomendacion') || lower.includes('requiere revision') || lower.includes('no requiere revision')
  })
  const signals = explanation?.senales_principales || []
  const contextItems = [
    item.cobertura && { label: 'Cobertura', value: item.cobertura },
    item.beneficiario && { label: 'Proveedor', value: item.beneficiario },
    item.monto_reclamado !== undefined && { label: 'Monto', value: formatCurrency(item.monto_reclamado || 0) },
    item.suma_asegurada !== undefined && { label: 'Suma asegurada', value: formatCurrency(item.suma_asegurada || 0) },
  ].filter(Boolean)

  return (
    <section style={summaryCardStyle(theme)}>
      <div style={summaryHeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={statusDotStyle(theme)} />
          <div>
            <h4 style={{ margin: 0 }}>Resumen ejecutivo</h4>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>{theme.label}</div>
          </div>
        </div>
        <div style={scorePillStyle(theme)}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Score</span>
          <strong>{item.score}/100</strong>
        </div>
      </div>

      <div style={summaryLeadStyle}>{lead}</div>

      <div className="detail-summary-grid" style={summaryGridStyle}>
        <SummaryPanel theme={theme} label="Decision operativa">
          <strong style={{ color: theme.color, display: 'block', marginBottom: 6 }}>{theme.label}</strong>
          <p style={summaryPanelTextStyle}>
            {recommendation || 'Continuar con la validacion humana correspondiente al nivel de riesgo.'}
          </p>
        </SummaryPanel>

        <SummaryPanel theme={theme} label="Evidencia clave">
          <p style={summaryPanelTextStyle}>
            {favorable || (signals.length ? 'El caso tiene senales trazables del motor de reglas.' : 'No se activaron alertas relevantes en reglas ni narrativa.')}
          </p>
        </SummaryPanel>
      </div>

      <div className="detail-summary-grid" style={summaryBottomGridStyle}>
        <SummaryPanel theme={theme} label="Contexto del reclamo">
          <div style={chipRowStyle}>
            {contextItems.map((fact) => (
              <span key={fact.label} style={factChipStyle}>
                <strong>{fact.label}:</strong> {fact.value}
              </span>
            ))}
          </div>
        </SummaryPanel>

        <SummaryPanel theme={theme} label="Senales de score">
          {signals.length ? (
            <div style={chipRowStyle}>
              {signals.slice(0, 3).map((signal) => (
                <span key={signal.codigo || signal.nombre} style={signalChipStyle(theme)}>
                  {signal.codigo ? `${signal.codigo} - ` : ''}{signal.nombre || signal.mensaje}
                </span>
              ))}
            </div>
          ) : (
            <div style={emptyStateStyle}>Sin alertas activadas.</div>
          )}
        </SummaryPanel>
      </div>
    </section>
  )
}

function SummaryPanel({ theme, label, children }) {
  return (
    <div style={summaryPanelStyle(theme)}>
      <span style={panelLabelStyle}>{label}</span>
      {children}
    </div>
  )
}

function NarrativeSection({ item }) {
  const signals = item.senales_narrativa || []

  return (
    <section style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h4 style={{ margin: 0 }}>Narrativa del reclamo</h4>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>Descripcion reportada y resultado NLP</div>
        </div>
        <span style={signals.length ? nlpBadgeActiveStyle : nlpBadgeNeutralStyle}>
          {signals.length ? `${signals.length} senal(es) NLP` : 'Sin senales NLP'}
        </span>
      </div>

      <div style={narrativeBodyStyle}>
        <p style={descriptionTextStyle}>{item.descripcion || 'Sin descripcion registrada.'}</p>
      </div>

      <div style={nlpPanelStyle}>
        <span style={panelLabelStyle}>Resultado NLP</span>
        {signals.length ? (
          <div style={chipRowStyle}>
            {signals.map((signal) => (
              <span key={signal} style={nlpSignalChipStyle}>{signal}</span>
            ))}
          </div>
        ) : (
          <div style={emptyStateStyle}>No se detectaron contradicciones, vaguedad critica ni terminos de alto riesgo en el relato.</div>
        )}
      </div>
    </section>
  )
}

function AlertsSection({ groupedAlerts, hasAlerts }) {
  return (
    <section style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h4 style={{ margin: 0 }}>Alertas activadas</h4>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>Reglas separadas por origen de senal</div>
        </div>
      </div>

      <div className="detail-alert-intro-grid" style={alertIntroGridStyle}>
        {ALERT_GROUPS.map((group) => (
          <div key={group.key} style={{ ...alertIntroCardStyle, borderTop: `4px solid ${group.color}` }}>
            <strong style={{ display: 'block', color: 'var(--text)', fontSize: 15 }}>{group.title}</strong>
            <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', lineHeight: 1.45, fontSize: 13 }}>{group.subtitle}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {hasAlerts
          ? groupedAlerts.map((group) => <AlertGroup key={group.key} group={group} />)
          : <div style={emptyAlertStateStyle}>No hay alertas activadas para este caso.</div>}
      </div>
    </section>
  )
}

function AlertGroup({ group }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--panel-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '10px 12px', borderLeft: `4px solid ${group.color}`, background: 'var(--card-bg)' }}>
        <div>
          <strong>{group.title}</strong>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>{group.alerts.length} senales detectadas</div>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', color: group.color }}>{group.alerts.reduce((total, alert) => total + Number(alert.puntos || 0), 0)} pts</span>
      </div>

      <div style={{ display: 'grid', gap: 8, padding: 10 }}>
        {group.alerts.length
          ? group.alerts.map((alert) => <AlertCard key={alert.codigo} alert={alert} />)
          : <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin alertas de esta categoria.</div>}
      </div>
    </div>
  )
}

const pageGridStyle = {
  display: 'block',
}

const mainPanelStyle = {
  background: 'var(--panel-bg)',
  padding: 20,
  borderRadius: 8,
  width: '100%',
}

const caseHeaderStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 340px)',
  gap: 18,
  border: '1px solid var(--border)',
  background: 'var(--card-bg)',
  borderRadius: 8,
  padding: 14,
  marginBottom: 14,
}

const ethicsInlineTextStyle = {
  margin: '0 0 12px',
  color: 'var(--text-secondary)',
  lineHeight: 1.45,
  fontSize: 14,
}

const caseIdentityStyle = {
  display: 'block',
}

const caseEyebrowStyle = {
  display: 'block',
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
}

const caseTitleStyle = {
  margin: '3px 0 0',
  fontSize: 24,
}

const caseFactsStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
}

const caseRiskPanelStyle = {
  gridRow: '1 / span 2',
  gridColumn: 2,
  display: 'grid',
  gap: 8,
  alignContent: 'center',
  justifyItems: 'center',
  padding: '4px 0 0',
}

const caseGaugeWrapStyle = {
  display: 'grid',
  placeItems: 'center',
  minHeight: 136,
}

const caseActionPanelStyle = {
  display: 'grid',
  gap: 7,
  width: '100%',
}

const caseActionBadgeStyle = {
  display: 'block',
  borderRadius: 8,
  color: '#fff',
  padding: '10px 12px',
  lineHeight: 1.25,
}

const caseFactStyle = {
  border: '1px solid var(--border)',
  background: 'var(--card-bg)',
  borderRadius: 8,
  padding: '9px 10px',
}

const caseFactLabelStyle = {
  display: 'block',
  color: 'var(--muted)',
  fontSize: 12,
  marginBottom: 4,
}

const checklistSectionStyle = {
  marginBottom: 14,
  border: '1px solid var(--border)',
  background: 'var(--panel-bg)',
  borderRadius: 8,
  padding: 14,
}

const checklistGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
}

const summaryHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
}

const summaryLeadStyle = {
  marginTop: 14,
  color: 'var(--text)',
  fontSize: 18,
  lineHeight: 1.45,
  fontWeight: 750,
  maxWidth: 840,
}

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  marginTop: 16,
}

const summaryBottomGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  marginTop: 10,
}

const panelLabelStyle = {
  display: 'block',
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  marginBottom: 8,
}

const summaryPanelTextStyle = {
  margin: 0,
  color: 'var(--text-secondary)',
  lineHeight: 1.45,
  fontSize: 14,
}

const chipRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const factChipStyle = {
  border: '1px solid var(--border)',
  background: '#111827',
  color: 'var(--text)',
  borderRadius: 8,
  padding: '7px 9px',
  fontSize: 13,
  lineHeight: 1.25,
}

const sectionCardStyle = {
  marginTop: 14,
  border: '1px solid var(--border)',
  background: 'var(--panel-bg)',
  borderRadius: 8,
  padding: 14,
}

const sectionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
}

const narrativeBodyStyle = {
  border: '1px solid var(--border)',
  background: 'var(--card-bg)',
  borderRadius: 8,
  padding: 12,
}

const descriptionTextStyle = {
  color: 'var(--text)',
  lineHeight: 1.55,
  fontSize: 15,
}

const nlpPanelStyle = {
  marginTop: 10,
  border: '1px solid var(--border)',
  background: 'var(--card-bg)',
  borderRadius: 8,
  padding: 12,
}

const nlpBadgeNeutralStyle = {
  border: '1px solid var(--border)',
  background: 'var(--card-bg)',
  color: 'var(--accent)',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: 'nowrap',
}

const nlpBadgeActiveStyle = {
  ...nlpBadgeNeutralStyle,
  border: '1px solid var(--border-light)',
  background: 'var(--card-bg)',
  color: 'var(--risk-yellow)',
}

const nlpSignalChipStyle = {
  border: '1px solid var(--border-light)',
  background: 'var(--card-bg)',
  color: 'var(--risk-yellow)',
  borderRadius: 8,
  padding: '7px 9px',
  fontSize: 13,
  lineHeight: 1.25,
}

const alertIntroGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
  marginBottom: 12,
}

const alertIntroCardStyle = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 12,
  background: '#1f2937',
}

const emptyStateStyle = {
  color: 'var(--muted)',
  fontSize: 13,
  lineHeight: 1.45,
}

const emptyAlertStateStyle = {
  color: 'var(--muted)',
  border: '1px dashed #cbd5e1',
  background: 'var(--card-bg)',
  borderRadius: 8,
  padding: 12,
  fontSize: 14,
}

const checkItemStyle = {
  borderLeft: '3px solid var(--accent)',
  background: '#111827',
  borderRadius: 8,
  padding: '9px 10px 9px 12px',
  color: 'var(--text-secondary)',
  lineHeight: 1.45,
  fontSize: 14,
}

function summaryCardStyle(theme) {
  return {
    border: `1px solid ${theme.border}`,
    borderTop: `5px solid ${theme.color}`,
    background: '#0f1a35',
    borderRadius: 8,
    padding: 16,
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
  }
}

function statusDotStyle(theme) {
  return {
    width: 14,
    height: 14,
    borderRadius: 14,
    background: theme.color,
    boxShadow: '0 0 0 5px rgba(255, 255, 255, 0.92)',
    flex: '0 0 auto',
  }
}

function statusBadgeStyle(theme) {
  return {
    background: theme.soft,
    color: theme.color,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    alignSelf: 'start',
  }
}

function scorePillStyle(theme) {
  return {
    display: 'grid',
    gap: 2,
    justifyItems: 'end',
    border: `1px solid ${theme.border}`,
    background: theme.soft,
    color: theme.color,
    borderRadius: 8,
    padding: '8px 10px',
    fontFamily: 'var(--font-mono)',
    minWidth: 94,
  }
}

function summaryPanelStyle(theme) {
  return {
    border: `1px solid ${theme.border}`,
    background: '#111827',
    borderRadius: 8,
    padding: 12,
    minHeight: 92,
  }
}

function signalChipStyle(theme) {
  return {
    border: `1px solid ${theme.border}`,
    background: '#1f2937',
    color: '#f8fafc',
    borderRadius: 8,
    padding: '7px 9px',
    fontSize: 13,
    lineHeight: 1.25,
  }
}
