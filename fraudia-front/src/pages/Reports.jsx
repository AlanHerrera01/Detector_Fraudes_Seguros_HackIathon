import { useCallback, useEffect, useState } from 'react'
import useFraudData from '../hooks/useFraudData'

const LIMIT_OPTIONS = [50, 100, 500, 1000]

const METRIC_HELP = {
  general: {
    title: 'Qué muestra este cuadro',
    body: [
      'Resume la evidencia técnica del motor de riesgo sobre el dataset activo. Si hay base PostgreSQL activa, viene de la base; si no, del CSV cargado o dataset activo.',
      'Sirve para demostrar que FraudIA no solo lista casos: también mide desempeño, anomalías, señales narrativas y coherencia entre reglas y score.',
      'Estas métricas apoyan la revisión humana. No confirman fraude ni autorizan rechazos automáticos.',
    ],
  },
  supervised: {
    title: 'Modelo supervisado',
    body: [
      'Evalúa el modelo cuando existe una etiqueta simulada de posible fraude. Precision indica qué tan limpios son los casos marcados; recall indica cuántos casos relevantes logra encontrar.',
      'F1-score equilibra precision y recall. AUC-ROC mide qué tan bien separa casos normales de posibles casos de fraude.',
      'La matriz de confusión muestra aciertos y errores: normales bien clasificados, normales marcados como alerta, fraudes omitidos y fraudes detectados.',
    ],
  },
  nlp: {
    title: 'NLP narrativo',
    body: [
      'Analiza las descripciones de los siniestros para detectar señales como narrativa vaga, términos sensibles, inconsistencias o narrativas repetidas.',
      'El porcentaje muestra cuántos casos tienen señales de texto relevantes. Las etiquetas frecuentes ayudan a explicar patrones de lenguaje repetidos.',
      'Es NLP transparente basado en reglas de extracción; no reemplaza la validación documental del analista.',
    ],
  },
  anomalies: {
    title: 'Ranking de anomalías',
    body: [
      'Ordena los casos que se comportan de forma más atípica o riesgosa frente al portafolio activo.',
      'Combina el score calculado con señales del modelo y reglas para priorizar revisión. Un caso arriba del ranking no significa fraude confirmado.',
      'Este bloque ayuda al analista a decidir qué revisar primero cuando hay muchos siniestros cargados.',
    ],
  },
  rules: {
    title: 'Validación con reglas',
    body: [
      'Contrasta las alertas explicables con los casos marcados por el sistema. Si los casos de mayor riesgo tienen más alertas, el score es más trazable.',
      'El promedio de alertas por caso muestra la intensidad general del portafolio. Las alertas en casos marcados muestran si los amarillos y rojos tienen razones claras.',
      'Los casos sin alertas sirven como control: ayudan a detectar si el modelo está marcando casos sin suficiente explicación.',
    ],
  },
}

export default function Reports() {
  const api = useFraudData()
  const [limit, setLimit] = useState(500)
  const [filters, setFilters] = useState({ upload_batch_id: '', date_from: '', date_to: '', provider: '' })
  const [filterOptions, setFilterOptions] = useState({ uploads: [], providers: [] })
  const [rows, setRows] = useState([])
  const [modelMetrics, setModelMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [downloading, setDownloading] = useState('')
  const [error, setError] = useState('')

  const loadReportFilters = useCallback(() => {
    return api.getReportFilters()
      .then((data) => setFilterOptions(data || { uploads: [], providers: [] }))
      .catch(() => setFilterOptions({ uploads: [], providers: [] }))
  }, [api])

  const loadAuditReport = useCallback(() => {
    setLoading(true)
    setError('')
    return api.getAuditReport({ limit, ...filters })
      .then((data) => setRows(data || []))
      .catch((exc) => setError(exc.message))
      .finally(() => setLoading(false))
  }, [api, filters, limit])

  const loadModelMetrics = useCallback(() => {
    setMetricsLoading(true)
    return api.getModelMetrics()
      .then((data) => setModelMetrics(data || null))
      .catch((exc) => setError(exc.message))
      .finally(() => setMetricsLoading(false))
  }, [api])

  useEffect(() => {
    const timer = setTimeout(loadReportFilters, 0)
    return () => clearTimeout(timer)
  }, [loadReportFilters])

  useEffect(() => {
    const timer = setTimeout(loadAuditReport, 0)
    return () => clearTimeout(timer)
  }, [loadAuditReport])

  useEffect(() => {
    const timer = setTimeout(loadModelMetrics, 0)
    return () => clearTimeout(timer)
  }, [loadModelMetrics])

  async function downloadReport(format) {
    setDownloading(format)
    setError('')
    try {
      await api.downloadAuditReport(format, { limit, ...filters })
    } catch (exc) {
      setError(exc.message)
    } finally {
      setDownloading('')
    }
  }

  const red = rows.filter((item) => item.nivel_riesgo === 'rojo').length
  const yellow = rows.filter((item) => item.nivel_riesgo === 'amarillo').length
  const avg = rows.length ? Math.round(rows.reduce((sum, item) => sum + Number(item.score_riesgo || 0), 0) / rows.length) : 0

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="reports-header" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26 }}>Reportes</h2>
          <p style={{ color: 'var(--muted)', marginTop: 6, maxWidth: 760 }}>
            Genera un PDF ejecutivo con resumen, tipos de alerta y casos prioritarios, o descarga el CSV con la tabla completa para auditoria.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => downloadReport('csv')} disabled={Boolean(downloading) || loading} style={{ background: '#0f172a', color: '#fff' }}>
            {downloading === 'csv' ? 'Generando...' : 'Descargar CSV'}
          </button>
          <button onClick={() => downloadReport('pdf')} disabled={Boolean(downloading) || loading}>
            {downloading === 'pdf' ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>
      </section>

      {error && <section style={errorStyle}>{error}</section>}

      <section className="reports-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <Metric label="Registros" value={rows.length} />
        <Metric label="Casos rojos" value={red} />
        <Metric label="Casos amarillos" value={yellow} />
        <Metric label="Score promedio" value={avg} />
      </section>

      <ModelMetricsSection metrics={modelMetrics} loading={metricsLoading} />

      <section style={panelStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Reporte de auditoria</h3>
            <p style={{ color: 'var(--muted)', marginTop: 4 }}>Vista previa de los primeros registros del reporte descargable.</p>
          </div>
          <div className="reports-filters-grid" style={filtersGridStyle}>
            <label style={fieldStyle}>
              <span>Archivo ingresado</span>
              <select value={filters.upload_batch_id} onChange={(event) => setFilters((current) => ({ ...current, upload_batch_id: event.target.value }))} style={selectStyle}>
                <option value="">Ultimo archivo activo</option>
                {filterOptions.uploads?.map((upload) => (
                  <option key={upload.upload_batch_id} value={upload.upload_batch_id}>
                    {upload.source_filename} - {upload.uploaded_at?.slice(0, 10)} ({upload.total_claims})
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Desde fecha reporte</span>
              <input type="date" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} style={selectStyle} />
            </label>
            <label style={fieldStyle}>
              <span>Hasta fecha reporte</span>
              <input type="date" value={filters.date_to} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} style={selectStyle} />
            </label>
            <label style={fieldStyle}>
              <span>Proveedor</span>
              <select value={filters.provider} onChange={(event) => setFilters((current) => ({ ...current, provider: event.target.value }))} style={selectStyle}>
                <option value="">Todos</option>
                {filterOptions.providers?.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Limite</span>
              <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} style={selectStyle} aria-label="Limite de registros">
                {LIMIT_OPTIONS.map((option) => <option key={option} value={option}>{option} registros</option>)}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--muted)' }}>Cargando reporte...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Siniestro', 'Beneficiario', 'Score', 'Clasificacion', 'Nivel', 'Alertas', 'Nota'].map((label) => (
                    <th key={label} style={thStyle}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 12).map((row) => (
                  <tr key={row.id_siniestro}>
                    <td style={tdStyle}><strong style={{ fontFamily: 'var(--font-mono)' }}>{row.id_siniestro}</strong></td>
                    <td style={tdStyle}>{row.beneficiario}</td>
                    <td style={tdStyle}>{row.score_riesgo}</td>
                    <td style={tdStyle}>{row.clasificacion_riesgo}</td>
                    <td style={tdStyle}><RiskBadge level={row.nivel_riesgo} /></td>
                    <td style={tdStyle}>{row.codigos_alerta || 'Sin alertas'}</td>
                    <td style={tdStyle}>{row.nota_etica}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div style={panelStyle}>
      <span style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</span>
      <strong style={{ display: 'block', marginTop: 6, fontSize: 24 }}>{value}</strong>
    </div>
  )
}

function ModelMetricsSection({ metrics, loading }) {
  const [helpTopic, setHelpTopic] = useState(null)
  const supervised = metrics?.modelo_supervisado || {}
  const nlp = metrics?.metricas_nlp || {}
  const rules = metrics?.validacion_reglas || {}
  const anomalies = metrics?.ranking_anomalias || []
  const confusion = supervised.matriz_confusion || []
  const hasSupervised = supervised.disponible !== false
  const help = helpTopic ? METRIC_HELP[helpTopic] : null

  return (
    <section style={panelStyle}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Métricas del modelo
            <HelpButton label="Explicar métricas del modelo" onClick={() => setHelpTopic('general')} />
          </h3>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>
            Evidencia técnica para jurado: desempeño supervisado, anomalías, NLP y validación con reglas.
          </p>
        </div>
        <span style={pillStyle}>IA + reglas</span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', marginTop: 16 }}>Cargando métricas del modelo...</div>
      ) : (
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div className="model-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <Metric label="Casos evaluados" value={metrics?.total_casos ?? 0} />
            <Metric label="Casos marcados" value={`${metrics?.porcentaje_casos_marcados ?? 0}%`} />
            <Metric label="Señales NLP" value={nlp.casos_con_senales_narrativa ?? 0} />
            <Metric label="Casos con alertas" value={rules.casos_con_alertas ?? 0} />
          </div>

          <div className="model-two-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 14 }}>
            <div style={subPanelStyle}>
              <div style={subHeaderStyle}>
                <div>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Modelo supervisado
                    <HelpButton label="Explicar modelo supervisado" onClick={() => setHelpTopic('supervised')} />
                  </h4>
                  <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>
                    Usa etiqueta simulada y umbral operativo amarillo o rojo.
                  </p>
                </div>
                <span style={hasSupervised ? successPillStyle : warningPillStyle}>{hasSupervised ? 'Disponible' : 'Sin etiqueta'}</span>
              </div>
              {hasSupervised ? (
                <>
                  <div style={scoreGridStyle}>
                    <ScoreMetric label="Precision" value={supervised.precision} />
                    <ScoreMetric label="Recall" value={supervised.recall} />
                    <ScoreMetric label="F1-score" value={supervised.f1_score} />
                    <ScoreMetric label="AUC-ROC" value={supervised.auc_roc} />
                  </div>
                  <ConfusionMatrix matrix={confusion} />
                </>
              ) : (
                <p style={{ color: 'var(--muted)', marginTop: 12 }}>{supervised.motivo}</p>
              )}
            </div>

            <div style={subPanelStyle}>
              <div style={subHeaderStyle}>
                <div>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    NLP narrativo
                    <HelpButton label="Explicar NLP narrativo" onClick={() => setHelpTopic('nlp')} />
                  </h4>
                  <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>Extracción de señales textuales y narrativas repetidas.</p>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                <SummaryLine label="Casos con narrativa marcada" value={`${nlp.porcentaje_casos_con_senales_narrativa ?? 0}%`} />
                <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>{nlp.criterio_calidad_extraccion || 'Sin criterio reportado.'}</div>
                <TagCloud items={nlp.senales_mas_frecuentes || {}} />
              </div>
            </div>
          </div>

          <div className="model-two-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={subPanelStyle}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Ranking de anomalías
                <HelpButton label="Explicar ranking de anomalías" onClick={() => setHelpTopic('anomalies')} />
              </h4>
              <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>Casos ordenados por rareza/riesgo para priorización.</p>
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {anomalies.slice(0, 5).map((item) => (
                  <div key={item.id_siniestro} style={anomalyRowStyle}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{item.id_siniestro}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.beneficiario}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong>{item.score_riesgo}</strong>
                      <div><RiskBadge level={item.nivel_riesgo} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={subPanelStyle}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Validación con reglas
                <HelpButton label="Explicar validación con reglas" onClick={() => setHelpTopic('rules')} />
              </h4>
              <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>Contraste entre alertas explicables y casos marcados.</p>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                <SummaryLine label="Promedio alertas por caso" value={rules.promedio_alertas_por_caso ?? 0} />
                <SummaryLine label="Alertas en casos marcados" value={rules.promedio_alertas_casos_marcados ?? 0} />
                <SummaryLine label="Casos sin alertas" value={rules.casos_sin_alertas ?? 0} />
              </div>
            </div>
          </div>
        </div>
      )}
      {help && <HelpModal title={help.title} body={help.body} onClose={() => setHelpTopic(null)} />}
    </section>
  )
}

function HelpButton({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} style={helpButtonStyle}>
      ?
    </button>
  )
}

function HelpModal({ title, body, onClose }) {
  return (
    <div style={modalOverlayStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
          <div>
            <span style={pillStyle}>Ayuda</span>
            <h3 style={{ margin: '10px 0 0' }}>{title}</h3>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>Cerrar</button>
        </div>
        <div style={{ display: 'grid', gap: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {body.map((line) => <p key={line}>{line}</p>)}
        </div>
      </div>
    </div>
  )
}

function ScoreMetric({ label, value }) {
  const pct = Math.round(Number(value || 0) * 100)
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <strong>{value ?? 'N/D'}</strong>
      </div>
      <div style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--border)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
      </div>
    </div>
  )
}

function ConfusionMatrix({ matrix }) {
  if (!matrix.length) return null
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>Matriz de confusión</div>
      <div style={matrixStyle}>
        <span></span>
        <strong>Pred. normal</strong>
        <strong>Pred. alerta</strong>
        <strong>Real normal</strong>
        <MatrixCell value={matrix[0]?.[0]} />
        <MatrixCell value={matrix[0]?.[1]} />
        <strong>Real fraude</strong>
        <MatrixCell value={matrix[1]?.[0]} />
        <MatrixCell value={matrix[1]?.[1]} />
      </div>
    </div>
  )
}

function MatrixCell({ value }) {
  return <span style={matrixCellStyle}>{value ?? 0}</span>
}

function TagCloud({ items }) {
  const entries = Object.entries(items)
  if (!entries.length) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin señales frecuentes.</div>
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {entries.slice(0, 8).map(([label, value]) => (
        <span key={label} style={tagStyle}>{label}: {value}</span>
      ))}
    </div>
  )
}

function SummaryLine({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--muted)', fontSize: 13 }}>
      <span>{label}</span>
      <strong style={{ color: 'var(--text)' }}>{value}</strong>
    </div>
  )
}

function RiskBadge({ level }) {
  const color = level === 'rojo' ? 'var(--risk-red)' : level === 'amarillo' ? 'var(--risk-yellow)' : 'var(--risk-green)'
  return <span style={{ background: color, color: '#fff', borderRadius: 999, padding: '4px 8px', fontSize: 12, fontWeight: 700 }}>{level}</span>
}

const panelStyle = {
  background: 'var(--panel-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 16,
}

const errorStyle = {
  ...panelStyle,
  color: 'var(--error-text)',
  borderColor: 'var(--risk-red)',
  background: 'var(--error-bg)',
}

const subPanelStyle = {
  background: '#111827',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: 14,
}

const subHeaderStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 10,
  alignItems: 'start',
}

const scoreGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  marginTop: 12,
}

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '5px 10px',
  background: 'rgba(96, 165, 250, 0.14)',
  color: '#dbeafe',
  border: '1px solid rgba(96, 165, 250, 0.32)',
  fontSize: 12,
  fontWeight: 800,
}

const successPillStyle = {
  ...pillStyle,
  background: 'rgba(16, 185, 129, 0.14)',
  color: '#bbf7d0',
  border: '1px solid rgba(16, 185, 129, 0.32)',
}

const warningPillStyle = {
  ...pillStyle,
  background: 'rgba(245, 158, 11, 0.14)',
  color: '#fde68a',
  border: '1px solid rgba(245, 158, 11, 0.32)',
}

const matrixStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 6,
  alignItems: 'center',
  fontSize: 12,
  color: 'var(--muted)',
}

const matrixCellStyle = {
  display: 'grid',
  placeItems: 'center',
  minHeight: 38,
  borderRadius: 8,
  background: 'rgba(96, 165, 250, 0.12)',
  color: 'var(--text)',
  fontWeight: 800,
}

const tagStyle = {
  borderRadius: 999,
  padding: '5px 9px',
  background: 'rgba(96, 165, 250, 0.12)',
  border: '1px solid rgba(96, 165, 250, 0.24)',
  color: '#dbeafe',
  fontSize: 12,
  fontWeight: 700,
}

const anomalyRowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 10,
  alignItems: 'center',
  padding: 10,
  borderRadius: 8,
  background: 'var(--panel-bg)',
  border: '1px solid var(--border)',
}

const helpButtonStyle = {
  width: 24,
  height: 24,
  minWidth: 24,
  display: 'inline-grid',
  placeItems: 'center',
  padding: 0,
  borderRadius: 999,
  background: 'rgba(96, 165, 250, 0.14)',
  border: '1px solid rgba(96, 165, 250, 0.36)',
  color: '#dbeafe',
  fontSize: 13,
  fontWeight: 900,
}

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 90,
  display: 'grid',
  placeItems: 'center',
  padding: 20,
  background: 'rgba(2, 6, 23, 0.72)',
  backdropFilter: 'blur(8px)',
}

const modalStyle = {
  width: 'min(560px, 100%)',
  background: '#0f172a',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  boxShadow: '0 24px 70px rgba(0, 0, 0, 0.45)',
  padding: 20,
  color: 'var(--text)',
  display: 'grid',
  gap: 16,
}

const closeButtonStyle = {
  background: '#111827',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-light)',
}

const selectStyle = {
  // Los estilos base vienen de index.css
}

const filtersGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
}

const fieldStyle = {
  display: 'grid',
  gap: 5,
  color: 'var(--text-muted)',
  fontSize: 12,
}

const thStyle = {
  textAlign: 'left',
  color: 'var(--text-muted)',
  fontSize: 12,
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border)',
  padding: '10px 8px',
}

const tdStyle = {
  borderBottom: '1px solid var(--border)',
  padding: '10px 8px',
  verticalAlign: 'top',
}
