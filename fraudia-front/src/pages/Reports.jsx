import { useEffect, useState } from 'react'
import useFraudData from '../hooks/useFraudData'

const LIMIT_OPTIONS = [50, 100, 500, 1000]

export default function Reports() {
  const api = useFraudData()
  const [limit, setLimit] = useState(500)
  const [filters, setFilters] = useState({ upload_batch_id: '', date_from: '', date_to: '', provider: '' })
  const [filterOptions, setFilterOptions] = useState({ uploads: [], providers: [] })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.getReportFilters()
      .then((data) => setFilterOptions(data || { uploads: [], providers: [] }))
      .catch(() => setFilterOptions({ uploads: [], providers: [] }))
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    api.getAuditReport({ limit, ...filters })
      .then((data) => setRows(data || []))
      .catch((exc) => setError(exc.message))
      .finally(() => setLoading(false))
  }, [limit, filters.upload_batch_id, filters.date_from, filters.date_to, filters.provider])

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
      <section style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
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

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <Metric label="Registros" value={rows.length} />
        <Metric label="Casos rojos" value={red} />
        <Metric label="Casos amarillos" value={yellow} />
        <Metric label="Score promedio" value={avg} />
      </section>

      <section style={panelStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Reporte de auditoria</h3>
            <p style={{ color: 'var(--muted)', marginTop: 4 }}>Vista previa de los primeros registros del reporte descargable.</p>
          </div>
          <div style={filtersGridStyle}>
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

function RiskBadge({ level }) {
  const color = level === 'rojo' ? 'var(--risk-red)' : level === 'amarillo' ? 'var(--risk-yellow)' : 'var(--risk-green)'
  return <span style={{ background: color, color: '#fff', borderRadius: 999, padding: '4px 8px', fontSize: 12, fontWeight: 700 }}>{level}</span>
}

const panelStyle = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 16,
}

const errorStyle = {
  ...panelStyle,
  color: '#991b1b',
  borderColor: '#fecaca',
  background: '#fef2f2',
}

const selectStyle = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 10px',
  font: 'inherit',
  background: '#fff',
}

const filtersGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
}

const fieldStyle = {
  display: 'grid',
  gap: 5,
  color: '#475569',
  fontSize: 12,
}

const thStyle = {
  textAlign: 'left',
  color: '#475569',
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
