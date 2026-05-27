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
    subtitle: 'Miden senales criticas de fraude operativo: documentos alterados, listas restrictivas, perdida total por robo o dinamicas de alto riesgo.',
    color: 'var(--risk-red)',
  },
  {
    key: 's',
    title: 'S - Senales de negocio',
    subtitle: 'Miden comportamientos atipicos: fechas cercanas a vigencia, reporte tardio, frecuencia de reclamos, proveedor recurrente o monto elevado.',
    color: 'var(--risk-yellow)',
  },
  {
    key: 'nlp',
    title: 'NLP - Narrativa del reclamo',
    subtitle: 'Mide senales del texto libre: relato vago, inconsistente, terminos sensibles o combinaciones que requieren validacion documental.',
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

export default function SiniestroDetail() {
  const { id } = useParams()
  const api = useFraudData()
  const [item, setItem] = useState(null)
  const [explanation, setExplanation] = useState(null)
  const nav = useNavigate()

  useEffect(() => {
    api.getSiniestroById(id).then(setItem)
    api.getClaimExplanation(id).then(setExplanation).catch(() => setExplanation(null))
  }, [id])

  if (!item) return <div>Cargando...</div>

  const action = suggestedAction(item.score)
  const groupedAlerts = groupAlerts(item.alertas_detalle || [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18 }}>
      <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
        <button onClick={() => nav('/siniestros')} style={{ marginBottom: 12 }}>Volver a siniestros</button>
        <h3 style={{ marginTop: 0 }}>Caso 360: {item.id_siniestro}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <div><strong>Ramo:</strong> {item.ramo}</div>
          <div><strong>Monto:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(item.monto_reclamado || 0)}</span></div>
          <div><strong>Fecha:</strong> {formatDate(item.fecha_ocurrencia)}</div>
          <div><strong>Score:</strong> {item.score}</div>
          <div><strong>Proveedor:</strong> {item.beneficiario}</div>
          <div><strong>Nivel:</strong> {item.nivel_riesgo}</div>
        </div>

        <section style={{ marginTop: 14 }}>
          <h4>Resumen ejecutivo</h4>
          <div style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: 12, borderRadius: 8, lineHeight: 1.5 }}>
            {explanation?.resumen_ejecutivo || item.explicacion_ia}
          </div>
        </section>

        <section style={{ marginTop: 14 }}>
          <h4>Descripcion y senales NLP</h4>
          <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>{item.descripcion}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {(item.senales_narrativa || []).length
              ? item.senales_narrativa.map((signal) => (
                  <span key={signal} style={{ background: '#fef3c7', padding: '6px 8px', borderRadius: 8 }}>{signal}</span>
                ))
              : <span style={{ color: 'var(--muted)' }}>Sin senales narrativas criticas.</span>}
          </div>
        </section>

        <section style={{ marginTop: 14 }}>
          <h4>Alertas activadas</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
            {ALERT_GROUPS.map((group) => (
              <div key={group.key} style={{ border: '1px solid var(--border)', borderTop: `4px solid ${group.color}`, borderRadius: 8, padding: 12, background: '#f8fafc' }}>
                <strong style={{ display: 'block', color: '#111827' }}>{group.title}</strong>
                <p style={{ margin: '6px 0 0', color: 'var(--muted)', lineHeight: 1.45, fontSize: 13 }}>{group.subtitle}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {item.alertas_detalle.length
              ? groupedAlerts.map((group) => <AlertGroup key={group.key} group={group} />)
              : <div style={{ color: 'var(--muted)' }}>No hay alertas activadas.</div>}
          </div>
        </section>
      </div>

      <aside style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <div style={{ background: '#fff', padding: 16, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
          <ScoreGauge score={item.score} />
        </div>

        <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
          <h4>Accion sugerida</h4>
          <div style={{ padding: 12, borderRadius: 8, background: action.color, color: '#fff' }}>{action.action}</div>
        </div>

        <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
          <h4>Checklist de analista</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {(explanation?.acciones_recomendadas || []).map((step) => (
              <div key={step} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 8 }}>{step}</div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', padding: 12, borderRadius: 8, color: 'var(--muted)', lineHeight: 1.45 }}>
          {explanation?.nota_etica || 'Alerta para revision humana; no confirma fraude.'}
        </div>
      </aside>
    </div>
  )
}

function AlertGroup({ group }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '10px 12px', borderLeft: `4px solid ${group.color}`, background: '#f8fafc' }}>
        <div>
          <strong>{group.title}</strong>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{group.alerts.length} senales detectadas</div>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', color: group.color }}>{group.alerts.reduce((total, alert) => total + Number(alert.puntos || 0), 0)} pts</span>
      </div>

      <div style={{ display: 'grid', gap: 8, padding: 10 }}>
        {group.alerts.length
          ? group.alerts.map((alert) => <AlertCard key={alert.codigo} alert={alert} />)
          : <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin alertas de esta categoria.</div>}
      </div>
    </div>
  )
}
