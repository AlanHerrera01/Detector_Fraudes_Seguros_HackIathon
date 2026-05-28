import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useFraudData from '../hooks/useFraudData'
import { formatCurrency, formatDate } from '../utils/riskHelpers'

function riskColor(level) {
  if (level === 'rojo') return 'var(--risk-red)'
  if (level === 'amarillo') return 'var(--risk-yellow)'
  return 'var(--risk-green)'
}

export default function SiniestrosList() {
  const api = useFraudData()
  const [list, setList] = useState([])
  const [search, setSearch] = useState('')
  const [riesgo, setRiesgo] = useState('todos')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  const nav = useNavigate()

  useEffect(() => {
    api.getSiniestros({ search, riesgo: 'todos', limit: 500 }).then((r) => setList(r.items))
  }, [api, search])

  useEffect(() => {
    setPage(1)
  }, [search, riesgo, pageSize])

  const visibleList = useMemo(() => {
    if (riesgo === 'todos') return list
    return list.filter((item) => item.nivel_riesgo === riesgo)
  }, [list, riesgo])

  const totalPages = Math.max(1, Math.ceil(visibleList.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const pageRows = visibleList.slice(pageStart, pageStart + pageSize)

  const summary = useMemo(() => {
    const red = list.filter((item) => item.nivel_riesgo === 'rojo').length
    const yellow = list.filter((item) => item.nivel_riesgo === 'amarillo').length
    const green = list.filter((item) => item.nivel_riesgo === 'verde').length
    const avg = list.length ? Math.round(list.reduce((sum, item) => sum + Number(item.score || 0), 0) / list.length) : 0
    const maxAmount = list.length ? Math.max(...list.map((item) => Number(item.monto_reclamado || 0))) : 0
    const top = [...list].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0]
    return { total: list.length, red, yellow, green, avg, maxAmount, top }
  }, [list])

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <span style={eyebrowStyle}>Siniestros</span>
          <h3 style={titleStyle}>Bandeja de revision</h3>
          <p style={subtitleStyle}>Filtra, compara y abre cada caso para revisar score, reglas y evidencia.</p>
          {summary.top && (
            <div style={insightStyle}>
              <span style={insightDotStyle(summary.top.nivel_riesgo)} />
              <span>
                Prioridad actual: <strong>{summary.top.id_siniestro}</strong> con score <strong>{summary.top.score}/100</strong>.
                Revisa primero los casos rojos y montos altos antes de autorizar pagos.
              </span>
            </div>
          )}
        </div>
        <div style={summaryGridStyle}>
          <Metric label="Resultados" value={summary.total} />
          <Metric label="Score prom." value={summary.avg} />
          <Metric label="Rojos" value={summary.red} tone="red" />
          <Metric label="Amarillos" value={summary.yellow} tone="yellow" />
          <Metric label="Verdes" value={summary.green} tone="green" />
          <Metric label="Mayor monto" value={formatCurrency(summary.maxAmount)} />
        </div>
      </section>

      <section style={toolbarStyle}>
        <input
          placeholder="Buscar por ID, proveedor o cobertura"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchStyle}
        />
        <div style={filterGroupStyle}>
          {[
            ['todos', 'Todos', summary.total],
            ['rojo', 'Rojo', summary.red],
            ['amarillo', 'Amarillo', summary.yellow],
            ['verde', 'Verde', summary.green],
          ].map(([value, label, count]) => (
            <button key={value} onClick={() => setRiesgo(value)} style={filterButtonStyle(value, riesgo)}>
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </div>
        <div style={pageSizeGroupStyle}>
          <span style={pageSizeLabelStyle}>Ver</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} style={pageSizeSelectStyle}>
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </section>

      <section style={tableCardStyle}>
        <div style={tableHeaderStyle}>
          <span>ID</span>
          <span>Ramo / cobertura</span>
          <span>Monto</span>
          <span>Fecha</span>
          <span>Clasificacion</span>
          <span>Score</span>
        </div>

        <div style={rowsStyle}>
          {pageRows.map((s) => (
            <button key={s.id_siniestro} style={rowStyle} onClick={() => nav(`/siniestros/${s.id_siniestro}`)}>
              <span style={idCellStyle}>
                <strong>{s.id_siniestro}</strong>
                <small style={idCellStyleSmall}>{s.beneficiario || 'Sin proveedor'}</small>
              </span>
              <span style={coverageCellStyle}>
                <strong>{s.ramo}</strong>
                <span>{s.cobertura}</span>
              </span>
              <span style={monoCellStyle}>{formatCurrency(s.monto_reclamado)}</span>
              <span style={mutedCellStyle}>{formatDate(s.fecha_ocurrencia)}</span>
              <span style={levelPillStyle(s.nivel_riesgo)}>{s.clasificacion_riesgo || s.nivel_riesgo}</span>
              <span style={scoreCellStyle}>
                <strong>{s.score}</strong>
                <span style={scoreTrackStyle}>
                  <span style={{ ...scoreFillStyle, width: `${Math.min(100, Number(s.score || 0))}%`, background: riskColor(s.nivel_riesgo) }} />
                </span>
              </span>
            </button>
          ))}
          {!visibleList.length && <div style={emptyStyle}>No hay siniestros para el filtro seleccionado.</div>}
        </div>

        {visibleList.length > 0 && (
          <div style={paginationStyle}>
            <span>
              Mostrando {pageStart + 1}-{Math.min(pageStart + pageSize, visibleList.length)} de {visibleList.length}
            </span>
            <div style={paginationButtonsStyle}>
              <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>
                Anterior
              </button>
              <strong>{currentPage} / {totalPages}</strong>
              <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages}>
                Siguiente
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value, tone }) {
  const color = tone === 'red' ? 'var(--risk-red)' : tone === 'yellow' ? 'var(--risk-yellow)' : tone === 'green' ? 'var(--risk-green)' : 'var(--text)'
  return (
    <div style={metricStyle}>
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  )
}

const pageStyle = {
  display: 'grid',
  gap: 14,
}

const heroStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(420px, 560px)',
  gap: 16,
  background: 'var(--panel-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 16,
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
  lineHeight: 1.45,
}

const insightStyle = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  maxWidth: 720,
  marginTop: 16,
  background: '#111827',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: 12,
  color: 'var(--text-secondary)',
  lineHeight: 1.45,
}

function insightDotStyle(level) {
  return {
    width: 10,
    height: 10,
    flex: '0 0 10px',
    marginTop: 5,
    borderRadius: 999,
    background: riskColor(level),
    boxShadow: `0 0 0 4px color-mix(in srgb, ${riskColor(level)} 18%, transparent)`,
  }
}

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
}

const metricStyle = {
  background: '#111827',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: 10,
  display: 'grid',
  alignContent: 'space-between',
  minHeight: 72,
  color: 'var(--muted)',
  fontSize: 12,
}

const toolbarStyle = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  justifyContent: 'space-between',
  background: 'var(--panel-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 12,
}

const searchStyle = {
  minWidth: 320,
}

const filterGroupStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const pageSizeGroupStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 800,
}

const pageSizeLabelStyle = {
  color: 'var(--muted)',
}

const pageSizeSelectStyle = {
  minWidth: 84,
  background: '#111827',
  color: 'var(--text)',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: '8px 10px',
}

function filterButtonStyle(value, active) {
  const selected = value === active
  const color = value === 'rojo' ? 'var(--risk-red)' : value === 'amarillo' ? 'var(--risk-yellow)' : value === 'verde' ? 'var(--risk-green)' : 'var(--accent)'
  return {
    background: selected ? color : '#111827',
    color: selected ? '#fff' : color,
    border: `1px solid ${selected ? color : 'var(--border-light)'}`,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  }
}

const tableCardStyle = {
  background: 'var(--panel-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 12,
}

const tableHeaderStyle = {
  display: 'grid',
  gridTemplateColumns: '150px minmax(260px, 1fr) 140px 130px 150px 140px',
  gap: 12,
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  padding: '0 10px 10px',
}

const rowsStyle = {
  display: 'grid',
  gap: 8,
}

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '150px minmax(260px, 1fr) 140px 130px 150px 140px',
  gap: 12,
  alignItems: 'center',
  width: '100%',
  textAlign: 'left',
  background: '#111827',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: 10,
  color: 'var(--text)',
}

const idCellStyle = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--accent)',
  fontWeight: 900,
  display: 'grid',
  gap: 3,
}

const idCellStyleSmall = {
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-body)',
  fontSize: 12,
}

const coverageCellStyle = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
}

const monoCellStyle = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--text)',
}

const mutedCellStyle = {
  color: 'var(--text-secondary)',
}

function levelPillStyle(level) {
  const color = riskColor(level)
  return {
    justifySelf: 'start',
    border: `1px solid ${color}`,
    color,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: '6px 8px',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
  }
}

const scoreCellStyle = {
  display: 'grid',
  gap: 6,
  fontFamily: 'var(--font-mono)',
}

const scoreTrackStyle = {
  height: 7,
  background: '#334155',
  borderRadius: 8,
  overflow: 'hidden',
}

const scoreFillStyle = {
  display: 'block',
  height: 7,
  borderRadius: 8,
}

const emptyStyle = {
  color: 'var(--text-secondary)',
  background: '#111827',
  border: '1px dashed var(--border-light)',
  borderRadius: 8,
  padding: 14,
}

const paginationStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginTop: 12,
  color: 'var(--text-secondary)',
  fontSize: 13,
}

const paginationButtonsStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
}
