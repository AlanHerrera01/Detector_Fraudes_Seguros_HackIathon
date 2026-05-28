import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useFraudData from '../hooks/useFraudData'
import StatCard from '../components/ui/StatCard'
import { levelFromScore } from '../utils/riskHelpers'

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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: 'var(--card-bg)', color, fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      {label}
    </span>
  )
}

function Panel({ children, style }) {
  return (
    <section style={{ background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: '0 0 15px rgba(96, 165, 250, 0.05)', ...style }}>
      {children}
    </section>
  )
}

function uploadStepFromProgress(progress) {
  if (progress >= 100) return 'Dashboard actualizado'
  if (progress >= 78) return 'Preparando indicadores'
  if (progress >= 54) return 'Recalculando scores'
  if (progress >= 28) return 'Validando estructura'
  return 'Leyendo archivo'
}

export default function Dashboard() {
  const api = useFraudData()
  const [stats, setStats] = useState(null)
  const [claims, setClaims] = useState([])
  const [networks, setNetworks] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadElapsed, setUploadElapsed] = useState(0)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadNotice, setUploadNotice] = useState('')
  const nav = useNavigate()
  const location = useLocation()

  const refreshDashboard = useCallback(async () => {
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
  }, [api])

  useEffect(() => {
    const initialLoad = setTimeout(refreshDashboard, 0)
    const timer = setInterval(refreshDashboard, 60000)
    return () => {
      clearTimeout(initialLoad)
      clearInterval(timer)
    }
  }, [refreshDashboard])

  useEffect(() => {
    if (location.state?.uploadMessage) {
      const timer = setTimeout(() => setUploadNotice(location.state.uploadMessage), 0)
      window.history.replaceState({}, document.title)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [location.state])

  useEffect(() => {
    if (!uploading) return undefined
    const timer = setInterval(() => {
      setUploadProgress((current) => Math.min(current + (current < 70 ? 7 : 3), 92))
      setUploadElapsed((current) => current + 0.7)
    }, 700)
    return () => clearInterval(timer)
  }, [uploading])

  const uploadDataset = async () => {
    if (!uploadFile) return
    setUploading(true)
    setUploadProgress(6)
    setUploadElapsed(0)
    setUploadError('')
    setUploadResult(null)
    try {
      const result = await api.uploadDataset(uploadFile)
      setUploadProgress(96)
      setUploadResult(result)
      await refreshDashboard()
      setUploadProgress(100)
      setUploadNotice(result?.message || 'Archivo cargado. Dashboard actualizado.')
      await new Promise((resolve) => setTimeout(resolve, 900))
      setUploadOpen(false)
      setUploadFile(null)
      setUploadResult(null)
    } catch (exc) {
      setUploadError(exc.message || 'No se pudo cargar el archivo')
    } finally {
      setUploading(false)
      setUploadElapsed(0)
    }
  }

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
          <button onClick={() => setUploadOpen(true)} style={uploadButtonStyle}>
            Cargar archivo
          </button>
        </div>
      </section>

      {uploadNotice && (
        <div style={noticeStyle}>
          <div>
            <strong>Dashboard listo con la ultima carga</strong>
            <div style={{ color: '#bbf7d0', marginTop: 4 }}>{uploadNotice}</div>
          </div>
          <button onClick={() => setUploadNotice('')} style={noticeButtonStyle}>Entendido</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        <StatCard label="Siniestros analizados" value={summary.total} accent="var(--accent)" hint="Total de incidentes en el panel" />
        <StatCard label="Casos criticos" value={summary.critical} accent="#7f1d1d" hint="Puntos de auditoria inmediata" />
        <StatCard label="Score promedio" value={(stats.score_promedio ?? 0).toFixed(1)} accent="var(--risk-yellow)" hint="Riesgo agregado promedio" />
        <StatCard label="Casos con alerta" value={summary.claimsWithAlerts} accent="var(--risk-green)" hint="Siniestros con senales detectadas" />
      </div>

      <Panel style={{ padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'stretch' }}>
          <div>
            <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>Siguiente accion</span>
            <h3 style={{ margin: '6px 0 6px' }}>{summary.red ? `Revisar ${summary.red} casos rojos primero` : 'Portafolio sin casos rojos'}</h3>
            <p style={{ color: 'var(--muted)', lineHeight: 1.45 }}>
              Empieza por los siniestros con score mas alto y luego revisa proveedores con concentracion anormal.
            </p>
          </div>
          <ActionTile label="Alta prioridad" value={summary.red} color="var(--risk-red)" onClick={() => nav('/siniestros')} />
          <ActionTile label="Requiere monitoreo" value={summary.yellow} color="var(--risk-yellow)" onClick={() => nav('/siniestros')} />
          <ActionTile label="Redes a revisar" value={networks.length} color="var(--accent)" onClick={() => nav('/providers')} />
        </div>
      </Panel>

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
              <div style={{ display: 'flex', height: 20, borderRadius: 999, overflow: 'hidden', background: 'var(--border)' }}>
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

        <PriorityClaimsPanel claims={summary.top} nav={nav} />
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
              <h3 style={{ margin: 0, fontSize: 16 }}>Riesgo por proveedor</h3>
              <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>Score promedio.</p>
            </div>
            <button onClick={() => nav('/providers')} style={panelButtonStyle}>Ver red</button>
          </div>
          <PieChart data={summary.topRiskProviders} labelKey="provider" valueKey="promedio" />
        </Panel>

        <BusinessMixPanel
          ramoItems={summary.ramoBreakdown}
          coverageItems={summary.coverageBreakdown}
          nav={nav}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <QuickSummaryPanel networks={networks} summary={summary} />

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
              <div key={item.beneficiario} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', background: 'var(--panel-bg)', borderRadius: 'var(--radius-lg)', padding: 14, border: '1px solid var(--border)' }}>
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

      {uploadOpen && (
        <UploadModal
          file={uploadFile}
          setFile={setUploadFile}
          loading={uploading}
          progress={uploadProgress}
          elapsedSeconds={uploadElapsed}
          result={uploadResult}
          error={uploadError}
          onClose={() => {
            if (uploading) return
            setUploadOpen(false)
            setUploadResult(null)
            setUploadError('')
          }}
          onUpload={uploadDataset}
        />
      )}
    </div>
  )
}

function UploadModal({ file, setFile, loading, progress, elapsedSeconds, result, error, onClose, onUpload }) {
  const isPdf = result?.document_type === 'pdf'
  const currentStep = uploadStepFromProgress(progress)
  return (
    <div style={modalOverlayStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <span style={modalEyebrowStyle}>Ingreso inteligente</span>
            <h3 style={{ margin: '4px 0 0', fontSize: 22 }}>Cargar archivo al motor FraudIA</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.45 }}>
              Sube un CSV para recalcular el portafolio o un PDF para revisar narrativa y soporte documental.
            </p>
          </div>
          <button onClick={onClose} disabled={loading} style={closeButtonStyle}>Cerrar</button>
        </div>

        <label style={dropzoneStyle}>
          <input
            type="file"
            accept=".csv,.pdf,text/csv,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            disabled={loading}
            style={{ display: 'none' }}
          />
          <span style={uploadIconStyle}>+</span>
          <strong>{file ? file.name : 'Selecciona tu archivo'}</strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Formatos permitidos: CSV para scoring masivo, PDF para soporte narrativo.
          </span>
        </label>

        {loading && (
          <div style={analysisBoxStyle}>
            <div style={spinnerStyle} />
            <div>
              <strong>{currentStep}</strong>
              <div style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
                Este proceso puede tardar mientras se lee el archivo, se valida la estructura y se recalculan alertas explicables.
              </div>
              <div style={progressTrackStyle}>
                <div style={{ ...progressBarStyle, width: `${Math.max(6, progress)}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
                <span>{Math.round(progress)}% completado</span>
                <span>{Math.ceil(elapsedSeconds)}s transcurridos</span>
              </div>
              <div style={analysisStepsStyle}>
                {['Lectura', 'Validacion', 'Scoring', 'Dashboard'].map((step, index) => (
                  <span key={step} style={{ ...analysisStepStyle, opacity: progress >= [8, 28, 54, 78][index] ? 1 : 0.48 }}>{step}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && <div style={errorBoxStyle}>{error}</div>}

        {result && (
          <div style={resultBoxStyle}>
            <strong>{result.message}</strong>
            {result.total_claims && <span>Total de siniestros cargados: {result.total_claims}</span>}
            {isPdf && (
              <>
                <span>
                  Senales narrativas:{' '}
                  {(result.signals?.senales_narrativa || []).length
                    ? result.signals.senales_narrativa.join(', ')
                    : 'sin senales criticas detectadas'}
                </span>
                <span style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>{result.text_preview}</span>
              </>
            )}
          </div>
        )}

        <div style={modalFooterStyle}>
          <button onClick={onClose} disabled={loading} style={secondaryButtonStyle}>Cancelar</button>
          <button onClick={onUpload} disabled={!file || loading} style={primaryButtonStyle}>
            {loading ? 'Analizando...' : 'Analizar archivo'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionTile({ label, value, color, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'grid', gap: 8, alignContent: 'center', minHeight: 112, textAlign: 'left', background: '#111827', border: '1px solid var(--border-light)', borderRadius: 8, padding: 16 }}>
      <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 700 }}>{label}</span>
      <strong style={{ color, fontSize: 30, lineHeight: 1 }}>{value}</strong>
      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Abrir vista</span>
    </button>
  )
}

function PriorityClaimsPanel({ claims, nav }) {
  return (
    <Panel>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>Casos recientes prioritarios</h3>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>Siniestros con mayor puntaje para revision inmediata.</p>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {claims.map((item) => {
          const level = levelFromScore(item.score)
          return (
            <button key={item.id_siniestro} onClick={() => nav(`/siniestros/${item.id_siniestro}`)} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', background: 'var(--panel-bg)', border: '1px solid var(--border)', padding: 14, borderRadius: 'var(--radius-lg)', textAlign: 'left' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>{item.id_siniestro}</div>
                <div style={{ color: 'var(--muted)', marginTop: 6, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.cobertura || 'Cobertura desconocida'} • {item.beneficiario || 'Proveedor'}
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                <RiskPill level={item.nivel_riesgo || level.nivel} />
                <strong style={{ color: level.color, fontSize: 20 }}>{item.score}</strong>
              </div>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

function QuickSummaryPanel({ networks, summary }) {
  return (
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
  )
}

function BusinessMixPanel({ ramoItems, coverageItems, nav }) {
  const [view, setView] = useState('ramos')
  const activeItems = view === 'ramos' ? ramoItems : coverageItems
  const activeColor = view === 'ramos' ? 'var(--risk-green)' : 'var(--risk-yellow)'

  return (
    <Panel>
      <div style={panelHeaderStyle}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Ramos y coberturas frecuentes</h3>
          <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>Distribucion del portafolio por tipo de negocio.</p>
        </div>
        <button onClick={() => nav('/siniestros')} style={panelButtonStyle}>Explorar</button>
      </div>

      <div style={segmentedControlStyle}>
        <button onClick={() => setView('ramos')} style={view === 'ramos' ? segmentedActiveStyle : segmentedButtonStyle}>Ramos</button>
        <button onClick={() => setView('coberturas')} style={view === 'coberturas' ? segmentedActiveStyle : segmentedButtonStyle}>Coberturas</button>
      </div>

      <BreakdownChart items={activeItems} color={activeColor} />
    </Panel>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ display: 'grid', gap: 6, padding: 14, background: 'var(--panel-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: '0 0 10px rgba(96, 165, 250, 0.05)' }}>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      <strong style={{ color, fontSize: 18 }}>{value}</strong>
    </div>
  )
}

function SummaryLine({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--panel-bg)', border: '1px solid var(--border)', boxShadow: '0 0 10px rgba(96, 165, 250, 0.05)' }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <strong style={{ color: '#10b981' }}>{value}</strong>
    </div>
  )
}

const panelButtonStyle = {
  background: 'var(--card-bg)',
  color: 'var(--accent)',
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 10,
  border: '1px solid var(--border-light)',
  whiteSpace: 'nowrap',
  flex: '0 0 auto',
  transition: 'all 180ms ease',
  boxShadow: '0 0 8px rgba(96, 165, 250, 0.1)',
}

const panelHeaderStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 12,
  alignItems: 'start',
  marginBottom: 8,
}

const segmentedControlStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
  padding: 4,
  marginTop: 12,
  borderRadius: 8,
  background: '#111827',
  border: '1px solid var(--border-light)',
}

const segmentedButtonStyle = {
  background: 'transparent',
  border: '1px solid transparent',
  color: 'var(--muted)',
  fontWeight: 800,
}

const segmentedActiveStyle = {
  ...segmentedButtonStyle,
  background: 'rgba(96, 165, 250, 0.16)',
  border: '1px solid rgba(96, 165, 250, 0.35)',
  color: '#dbeafe',
}

const uploadButtonStyle = {
  background: 'var(--accent)',
  color: '#fff',
  border: '1px solid var(--accent)',
  fontWeight: 800,
}

const noticeStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 12,
  alignItems: 'center',
  padding: 14,
  borderRadius: 8,
  background: 'rgba(16, 185, 129, 0.14)',
  border: '1px solid rgba(16, 185, 129, 0.38)',
}

const noticeButtonStyle = {
  background: 'rgba(15, 23, 42, 0.72)',
  color: '#d1fae5',
  border: '1px solid rgba(16, 185, 129, 0.42)',
}

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 80,
  display: 'grid',
  placeItems: 'center',
  padding: 20,
  background: 'rgba(2, 6, 23, 0.72)',
  backdropFilter: 'blur(8px)',
}

const modalStyle = {
  width: 'min(720px, 100%)',
  maxHeight: 'calc(100vh - 40px)',
  overflow: 'auto',
  background: '#0f172a',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  boxShadow: '0 24px 70px rgba(0, 0, 0, 0.45)',
  padding: 20,
  color: 'var(--text)',
  display: 'grid',
  gap: 16,
}

const modalHeaderStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 16,
  alignItems: 'start',
}

const modalEyebrowStyle = {
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const closeButtonStyle = {
  background: '#111827',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-light)',
}

const dropzoneStyle = {
  display: 'grid',
  placeItems: 'center',
  gap: 8,
  minHeight: 170,
  padding: 20,
  border: '1px dashed var(--accent)',
  borderRadius: 8,
  background: 'rgba(96, 165, 250, 0.08)',
  cursor: 'pointer',
  textAlign: 'center',
}

const uploadIconStyle = {
  width: 42,
  height: 42,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1,
}

const analysisBoxStyle = {
  display: 'grid',
  gridTemplateColumns: '42px 1fr',
  gap: 12,
  alignItems: 'center',
  background: '#111827',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: 14,
}

const analysisStepsStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 12,
}

const progressTrackStyle = {
  height: 9,
  width: '100%',
  marginTop: 12,
  borderRadius: 999,
  overflow: 'hidden',
  background: 'rgba(148, 163, 184, 0.22)',
}

const progressBarStyle = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--accent), var(--risk-green))',
  transition: 'width 450ms ease',
}

const analysisStepStyle = {
  padding: '5px 8px',
  borderRadius: 999,
  background: 'rgba(96, 165, 250, 0.12)',
  border: '1px solid rgba(96, 165, 250, 0.26)',
  color: '#bfdbfe',
  fontSize: 12,
  fontWeight: 800,
}

const spinnerStyle = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: '4px solid rgba(96, 165, 250, 0.22)',
  borderTopColor: 'var(--accent)',
  animation: 'spin 850ms linear infinite',
}

const errorBoxStyle = {
  padding: 12,
  borderRadius: 8,
  background: 'rgba(239, 68, 68, 0.12)',
  border: '1px solid rgba(239, 68, 68, 0.35)',
  color: '#fecaca',
}

const resultBoxStyle = {
  display: 'grid',
  gap: 8,
  padding: 14,
  borderRadius: 8,
  background: 'rgba(16, 185, 129, 0.12)',
  border: '1px solid rgba(16, 185, 129, 0.35)',
  color: 'var(--text)',
}

const modalFooterStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
}

const secondaryButtonStyle = {
  background: '#111827',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-light)',
}

const primaryButtonStyle = {
  background: 'var(--accent)',
  color: '#fff',
  border: '1px solid var(--accent)',
  fontWeight: 800,
}

const chartInsightStyle = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 10,
  alignItems: 'center',
  width: '100%',
  padding: 12,
  borderRadius: 8,
  background: '#111827',
  border: '1px solid var(--border-light)',
}

function PieChart({ data, labelKey, valueKey }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#f43f5e', '#a855f7']
  const validData = data && data.length > 0 ? data : []
  const total = validData.reduce((sum, item) => sum + Number(item[valueKey] || 0), 0)
  
  if (validData.length === 0 || total === 0) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', gap: 12, marginTop: 14, minHeight: 200, background: 'var(--panel-bg)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 48 }}>📊</div>
        <div style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>No hay datos para mostrar en este gráfico.</div>
      </div>
    )
  }

  const size = 200
  const center = size / 2
  const radius = 70

  const slices = validData.reduce((acc, item, index) => {
    const value = Number(item[valueKey] || 0)
    const sliceAngle = (value / total) * 360
    const startAngle = acc.endAngle
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
    
    acc.items.push({
      path: pathData,
      color: colors[index % colors.length],
      label: String(item[labelKey] || 'Otro'),
      value,
      pct,
      labelX,
      labelY,
    })
    acc.endAngle = endAngle
    return acc
  }, { endAngle: 0, items: [] }).items
  const activeSlice = slices[Math.min(activeIndex, slices.length - 1)] || slices[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 14 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 280, height: 280 }}>
        {slices.map((slice, idx) => (
          <g key={idx}>
            <path
              d={slice.path}
              fill={slice.color}
              opacity={activeIndex === idx ? 1 : 0.72}
              stroke={activeIndex === idx ? '#e0f2fe' : '#fff'}
              strokeWidth={activeIndex === idx ? 4 : 2}
              onClick={() => setActiveIndex(idx)}
              onMouseEnter={() => setActiveIndex(idx)}
              style={{ cursor: 'pointer', transition: 'opacity 200ms ease, stroke-width 200ms ease' }}
            />
            {slice.pct > 5 && (
              <text x={slice.labelX} y={slice.labelY} textAnchor="middle" dy="0.3em" style={{ fontSize: 12, fontWeight: 700, fill: '#fff', pointerEvents: 'none' }}>
                {slice.pct}%
              </text>
            )}
          </g>
        ))}
      </svg>
      {activeSlice && (
        <div style={chartInsightStyle}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: activeSlice.color }} />
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeSlice.label}</strong>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>{activeSlice.value} registros, {activeSlice.pct}% del total visible</span>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gap: 8, width: '100%' }}>
        {slices.map((slice, idx) => (
          <button key={idx} onClick={() => setActiveIndex(idx)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, textAlign: 'left', background: activeIndex === idx ? 'rgba(96, 165, 250, 0.12)' : 'transparent', border: '1px solid var(--border)', padding: '7px 8px' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: slice.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slice.label}</span>
            <strong style={{ flexShrink: 0 }}>{slice.value}</strong>
          </button>
        ))}
      </div>
    </div>
  )
}

function BreakdownChart({ items, color }) {
  const [activeLabel, setActiveLabel] = useState(items[0]?.label || '')
  const total = items.reduce((sum, item) => sum + item.count, 0)
  const activeItem = items.find((item) => item.label === activeLabel) || items[0]
  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
      {items.map((item) => {
        const width = total ? Math.round((item.count / total) * 100) : 0
        return (
          <button key={item.label} onClick={() => setActiveLabel(item.label)} style={{ display: 'grid', gap: 6, textAlign: 'left', background: activeLabel === item.label ? 'rgba(96, 165, 250, 0.12)' : 'transparent', border: '1px solid var(--border)', padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
              <span>{item.label}</span>
              <span>{item.count}</span>
            </div>
            <div style={{ height: 10, width: '100%', background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${width}%`, height: '100%', borderRadius: 999, background: color }} />
            </div>
          </button>
        )
      })}
      {activeItem && (
        <div style={chartInsightStyle}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
          <div>
            <strong>{activeItem.label}</strong>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              {activeItem.count} casos, {total ? Math.round((activeItem.count / total) * 100) : 0}% de esta grafica.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TrendLineChart({ data, series, height = 210 }) {
  const [selectedPoint, setSelectedPoint] = useState(null)
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
  const fallbackPoint = data.length ? { ...data[data.length - 1], serie: series[0] } : null
  const activePoint = selectedPoint || fallbackPoint

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
            <circle
              key={`${serie.key}-${idx}`}
              cx={point.x}
              cy={point.y}
              r={activePoint?.date === point.date && activePoint?.serie?.key === serie.key ? 6 : 3}
              fill={serie.color}
              stroke="#0f172a"
              strokeWidth="2"
              onClick={() => setSelectedPoint({ ...point, serie })}
              onMouseEnter={() => setSelectedPoint({ ...point, serie })}
              style={{ cursor: 'pointer' }}
            />
          ))
        ))}
      </svg>
      {activePoint && (
        <div style={chartInsightStyle}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: activePoint.serie.color }} />
          <div>
            <strong>{activePoint.label} · {activePoint.serie.label}</strong>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              {activePoint[activePoint.serie.key] || 0} casos de {activePoint.total || 0} reportados ese dia.
            </div>
          </div>
        </div>
      )}
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
