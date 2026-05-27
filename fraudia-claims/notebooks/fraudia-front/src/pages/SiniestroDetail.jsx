import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useFraudData from '../hooks/useFraudData'
import ScoreGauge from '../components/ui/ScoreGauge'
import AlertCard from '../components/ui/AlertCard'
import { suggestedAction, formatCurrency, formatDate } from '../utils/riskHelpers'

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
          <div style={{ display: 'grid', gap: 8 }}>
            {item.alertas_detalle.length
              ? item.alertas_detalle.map((a) => <AlertCard key={a.codigo} alert={a} />)
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
