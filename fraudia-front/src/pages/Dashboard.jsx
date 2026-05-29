import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useFraudData from '../hooks/useFraudData'
import StatCard from '../components/ui/StatCard'
import { formatCurrency } from '../utils/riskHelpers'

function pct(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function shortDateLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '')
  return date.toLocaleDateString('es-CO', { month: 'short', day: '2-digit' })
}

function dateTimeLabel(value) {
  if (!value) return 'Sesion actual'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sesion actual'
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

function topLabelFromMap(map, fallback) {
  const [label] = Object.entries(map).sort((a, b) => b[1] - a[1])[0] || []
  return label || fallback
}

function cityPoint(city) {
  const key = String(city || '').trim().toLowerCase()
  const points = {
    quito: { x: 52, y: 26 },
    guayaquil: { x: 32, y: 62 },
    cuenca: { x: 45, y: 76 },
    manta: { x: 20, y: 49 },
    portoviejo: { x: 24, y: 53 },
    esmeraldas: { x: 30, y: 18 },
    ambato: { x: 50, y: 42 },
    riobamba: { x: 50, y: 52 },
    loja: { x: 48, y: 88 },
    machala: { x: 35, y: 82 },
    ibarra: { x: 54, y: 18 },
    latacunga: { x: 50, y: 36 },
    tulcan: { x: 56, y: 10 },
    'santo domingo': { x: 39, y: 34 },
    quevedo: { x: 34, y: 49 },
    babahoyo: { x: 35, y: 58 },
    milagro: { x: 37, y: 62 },
    duran: { x: 34, y: 64 },
    bogota: { x: 76, y: 15 },
    medellin: { x: 66, y: 24 },
    cali: { x: 70, y: 38 },
  }
  return points[key]
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
  const [activeDataset, setActiveDataset] = useState(null)
  const nav = useNavigate()
  const location = useLocation()

  const refreshDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsData, claimsData] = await Promise.all([
        api.getDashboardStats(),
        api.getSiniestros({ limit: 500 }),
      ])

      setStats(statsData)
      setClaims(claimsData.items || claimsData || [])
      setActiveDataset((current) => ({
        filename: statsData.active_source_filename || current?.filename || 'Archivo no identificado',
        label: statsData.active_dataset_label || current?.label || 'Archivo activo',
        storage: statsData.active_dataset_storage || current?.storage || 'api',
        uploadedAt: statsData.active_uploaded_at || current?.uploadedAt || null,
        visibleClaims: statsData.total_siniestros ?? (claimsData.items || claimsData || []).length,
        trainingClaims: current?.trainingClaims ?? null,
      }))
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
      setActiveDataset({
        filename: result?.source_filename || uploadFile.name,
        label: result?.document_type === 'pdf' ? 'PDF analizado como soporte' : 'Ultimo archivo cargado',
        storage: result?.storage || 'api',
        uploadedAt: result?.uploaded_at || new Date().toISOString(),
        visibleClaims: result?.visible_claims ?? result?.total_claims ?? null,
        trainingClaims: result?.training_claims ?? null,
      })
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
    const top = [...claims].sort((a, b) => b.score - a.score).slice(0, 25)
    const claimsWithAlerts = stats?.casos_con_alertas ?? claims.filter((item) => (item.alertas_detalle || []).length > 0).length
    const uniqueProviders = new Set(claims.map((item) => item.beneficiario || '').filter(Boolean)).size
    const uniqueCoverages = new Set(claims.map((item) => item.cobertura || '').filter(Boolean)).size
    const uniqueLines = new Set(claims.map((item) => item.ramo || '').filter(Boolean)).size
    const uniqueCities = new Set(claims.map((item) => item.ciudad || '').filter(Boolean)).size

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

    const cityMap = claims.reduce((acc, item) => {
      const city = item.ciudad || 'Ciudad no registrada'
      const level = item.nivel_riesgo || 'verde'
      const coverage = item.cobertura || 'Sin cobertura'
      const line = item.ramo || 'Sin ramo'
      const bucket = acc[city] || {
        city,
        total: 0,
        rojo: 0,
        amarillo: 0,
        verde: 0,
        scoreSum: 0,
        coverages: {},
        lines: {},
      }
      bucket.total += 1
      bucket[level] = (bucket[level] || 0) + 1
      bucket.scoreSum += Number(item.score || 0)
      bucket.coverages[coverage] = (bucket.coverages[coverage] || 0) + 1
      bucket.lines[line] = (bucket.lines[line] || 0) + 1
      acc[city] = bucket
      return acc
    }, {})

    const topCities = Object.values(cityMap)
      .map((item) => ({
        ...item,
        scoreAvg: item.total ? Math.round(item.scoreSum / item.total) : 0,
        topCoverage: topLabelFromMap(item.coverages, 'Sin cobertura'),
        topLine: topLabelFromMap(item.lines, 'Sin ramo'),
      }))
      .sort((a, b) => b.total - a.total || b.scoreAvg - a.scoreAvg)
      .slice(0, 6)

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
      uniqueProviders,
      uniqueCoverages,
      uniqueLines,
      uniqueCities,
      topProviders,
      topRiskProviders,
      topProvidersMax: topProviders.reduce((max, item) => Math.max(max, item.total), 0),
      topCities,
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
      <section className="dashboard-header" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
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

      <div style={dashboardOverviewStyle}>
        <ActiveDatasetPanel dataset={activeDataset} total={summary.total} />

        <div className="dashboard-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14, marginTop: 16 }}>
          <StatCard label="Siniestros analizados" value={summary.total} accent="var(--accent)" hint="Archivo activo" info="Total de casos cargados para revision." />
          <StatCard label="Casos criticos" value={summary.critical} accent="#7f1d1d" hint="Auditoria inmediata" info="Casos con score critico o cercano a 90+." />
          <StatCard label="Score promedio" value={(stats.score_promedio ?? 0).toFixed(1)} accent="var(--risk-yellow)" hint="Riesgo agregado" info="Promedio del score calculado por reglas, NLP y ML." />
          <StatCard label="Casos con alerta" value={summary.claimsWithAlerts} accent="var(--risk-green)" hint="Senales detectadas" info="Casos con al menos una alerta; no confirma fraude." />
          <StatCard label="Ahorro estimado" value={formatCurrency(stats.ahorro_potencial ?? 0)} accent="#14b8a6" hint="Potencial auditado" info="Estimacion referencial del monto que podria priorizarse para revision antes de pago." />
        </div>
      </div>

      <Panel style={{ padding: 22 }}>
        <div className="portfolio-header" style={portfolioHeaderStyle}>
          <div>
            <h3 style={{ margin: 0 }}>Estado del portafolio</h3>
            <p style={{ color: 'var(--muted)', marginTop: 6 }}>Distribucion y tendencia diaria de siniestros por nivel de riesgo.</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13 }}>
            <Badge color="var(--risk-green)" label="Bajo" />
            <Badge color="var(--risk-yellow)" label="Medio" />
            <Badge color="var(--risk-red)" label="Critico" />
          </div>
        </div>

        <div className="portfolio-action-grid" style={portfolioActionStyle}>
          <div>
            <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>Siguiente accion</span>
            <h4 style={{ margin: '6px 0 0', fontSize: 18 }}>
              {summary.red ? 'Priorizar revision especializada' : summary.yellow ? 'Revisar casos de riesgo medio' : 'Portafolio estable'}
            </h4>
            <p style={{ color: 'var(--muted)', marginTop: 6, lineHeight: 1.45 }}>
              {summary.red
                ? 'Empieza por los casos criticos y cruza la revision con proveedores concentrados.'
                : summary.yellow
                  ? 'No hay criticos activos; valida soportes de los casos medios antes del cierre.'
                  : 'No hay alertas prioritarias; mantiene monitoreo normal del archivo activo.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button onClick={() => nav('/siniestros')} style={panelButtonStyle}>Ver siniestros</button>
            <button onClick={() => nav('/providers')} style={panelButtonStyle}>Ver proveedores</button>
          </div>
        </div>

        <div className="portfolio-summary" style={portfolioSummaryStyle}>
          <div>
            <div style={{ display: 'flex', height: 22, borderRadius: 999, overflow: 'hidden', background: 'var(--border)' }}>
              <div style={{ width: `${greenPct}%`, background: 'var(--risk-green)' }} />
              <div style={{ width: `${yellowPct}%`, background: 'var(--risk-yellow)' }} />
              <div style={{ width: `${redPct}%`, background: 'var(--risk-red)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
              <span>{greenPct}% bajo</span>
              <span>{yellowPct}% medio</span>
              <span>{redPct}% critico</span>
            </div>
          </div>
          <div className="portfolio-stats" style={portfolioStatsStyle}>
            <MiniStat label="Bajo" value={summary.green} color="var(--risk-green)" info="Score 0-40: flujo normal con validacion basica." />
            <MiniStat label="Medio" value={summary.yellow} color="var(--risk-yellow)" info="Score 41-75: requiere monitoreo o revision documental." />
            <MiniStat label="Critico" value={summary.red} color="var(--risk-red)" info="Score 76-100: revision especializada antes de decidir." />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <h4 style={{ margin: 0, fontSize: 15 }}>Tendencia de casos</h4>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>Elige los niveles de riesgo que deseas ver en las lineas.</p>
        </div>
        <TrendLineChart
          data={summary.trend}
          height={420}
          series={[
            { key: 'rojo', label: 'Critico', color: 'var(--risk-red)' },
            { key: 'amarillo', label: 'Medio', color: 'var(--risk-yellow)' },
            { key: 'verde', label: 'Bajo', color: 'var(--risk-green)' },
          ]}
        />
      </Panel>

      <div className="dashboard-three-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        <Panel>
          <div style={panelHeaderStyle}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Top proveedores</h3>
              <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>
                Representa los 5 proveedores con mayor cantidad de siniestros en el archivo activo.
              </p>
            </div>
            <button onClick={() => nav('/providers')} style={panelButtonStyle}>Ver red</button>
          </div>
          <PieChart data={summary.topProviders} labelKey="provider" valueKey="total" />
        </Panel>

        <Panel>
          <div style={panelHeaderStyle}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Riesgo por proveedor</h3>
              <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>
                Representa los 5 proveedores con mayor score promedio de riesgo.
              </p>
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

      <CityCasesPanel cities={summary.topCities} total={summary.total} nav={nav} />

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

function ActiveDatasetPanel({ dataset, total }) {
  const filename = dataset?.filename || 'Dataset base'
  const label = dataset?.label || 'Archivo activo'
  const visibleClaims = dataset?.visibleClaims ?? total
  const trainingClaims = dataset?.trainingClaims
  const storage = dataset?.storage || 'api'

  return (
    <div className="active-dataset-grid" style={activeDatasetGridStyle}>
      <div style={{ minWidth: 0 }}>
        <span style={activeDatasetEyebrowStyle}>{label}</span>
        <h3 style={{ margin: '5px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filename}
        </h3>
        <p style={{ color: 'var(--muted)', marginTop: 6 }}>
          Este es el archivo que alimenta los indicadores, graficas, reportes y agente del dashboard.
        </p>
      </div>

      <div style={activeDatasetMetricStyle}>
        <span>Casos en este archivo</span>
        <strong style={activeDatasetMetricValueStyle}>{visibleClaims ?? 0}</strong>
      </div>

      <div style={activeDatasetMetricStyle}>
        <span>Historico entrenamiento</span>
        <strong style={activeDatasetMetricValueStyle}>{trainingClaims ?? 'N/A'}</strong>
      </div>

      <div style={activeDatasetMetricStyle}>
        <span>Almacenamiento</span>
        <strong style={activeDatasetMetricValueStyle}>{String(storage).toUpperCase()}</strong>
        <small style={{ color: 'var(--muted)' }}>{dateTimeLabel(dataset?.uploadedAt)}</small>
      </div>
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
              Sube un CSV o Excel para recalcular el portafolio, o un PDF para revisar narrativa y soporte documental.
            </p>
          </div>
          <button onClick={onClose} disabled={loading} style={closeButtonStyle}>Cerrar</button>
        </div>

        <label style={dropzoneStyle}>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            disabled={loading}
            style={{ display: 'none' }}
          />
          <span style={uploadIconStyle}>+</span>
          <strong>{file ? file.name : 'Selecciona tu archivo'}</strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Formatos permitidos: CSV/Excel para scoring masivo, PDF para soporte narrativo.
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

function BusinessMixPanel({ ramoItems, coverageItems, nav }) {
  const [view, setView] = useState('ramos')
  const activeItems = view === 'ramos' ? ramoItems : coverageItems

  return (
    <Panel>
      <div style={panelHeaderStyle}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Ramos y coberturas frecuentes</h3>
          <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>
            Representa las categorias mas frecuentes del archivo activo por ramo o cobertura.
          </p>
        </div>
        <button onClick={() => nav('/siniestros')} style={panelButtonStyle}>Explorar</button>
      </div>

      <div style={segmentedControlStyle}>
        <button onClick={() => setView('ramos')} style={view === 'ramos' ? segmentedActiveStyle : segmentedButtonStyle}>Ramos</button>
        <button onClick={() => setView('coberturas')} style={view === 'coberturas' ? segmentedActiveStyle : segmentedButtonStyle}>Coberturas</button>
      </div>

      <PieChart data={activeItems} labelKey="label" valueKey="count" />
    </Panel>
  )
}

function CityCasesPanel({ cities, total, nav }) {
  const [selectedCity, setSelectedCity] = useState(cities[0]?.city || '')
  const maxCases = Math.max(1, ...cities.map((item) => item.total || 0))
  const activeCity = cities.find((item) => item.city === selectedCity) || cities[0]
  const mapCities = cities.map((item, index) => {
    const fallback = { x: 78 + (index % 3) * 6, y: 34 + Math.floor(index / 3) * 13 }
    return { ...item, point: cityPoint(item.city) || fallback }
  })

  return (
    <Panel style={{ padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>Mapa de calor por ciudad</h3>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>
            Ubicacion aproximada por ciudad; el tamano del punto representa volumen y el color indica riesgo promedio.
          </p>
        </div>
        <button onClick={() => nav('/siniestros')} style={panelButtonStyle}>Ver casos</button>
      </div>

      {cities.length === 0 && (
        <div style={{ color: 'var(--muted)', padding: 14, border: '1px solid var(--border)', borderRadius: 8, marginTop: 16 }}>
          No hay ciudades registradas en el archivo activo.
        </div>
      )}

      {cities.length > 0 && (
        <>
          <div className="city-map-layout" style={cityMapLayoutStyle}>
            <div style={cityMapFrameStyle}>
              <svg viewBox="0 0 100 100" role="img" aria-label="Mapa de calor por ciudad" style={{ width: '100%', height: '100%', display: 'block' }}>
                <defs>
                  <linearGradient id="mapFill" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#0f2a4d" />
                    <stop offset="55%" stopColor="#10344d" />
                    <stop offset="100%" stopColor="#123139" />
                  </linearGradient>
                  <filter id="cityGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="2.4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <rect x="0" y="0" width="100" height="100" rx="8" fill="#0b1229" />
                <path
                  d="M52 6 L63 14 L59 25 L66 33 L60 44 L64 56 L56 66 L59 78 L50 92 L40 86 L33 91 L26 78 L18 72 L23 61 L14 51 L20 42 L17 30 L25 20 L37 17 L43 8 Z"
                  fill="url(#mapFill)"
                  stroke="#334155"
                  strokeWidth="1.2"
                />
                <path d="M45 9 C50 24 48 39 52 53 C56 66 51 78 49 91" fill="none" stroke="rgba(203,213,225,0.26)" strokeWidth="1.1" strokeDasharray="2 2" />
                <path d="M18 72 C28 66 36 63 46 60 C55 57 60 52 64 44" fill="none" stroke="rgba(96,165,250,0.18)" strokeWidth="1" />
                <text x="7" y="12" fill="#64748b" fontSize="3.4" fontWeight="700">Pacifico</text>
                <text x="72" y="92" fill="#64748b" fontSize="3.4" fontWeight="700">Amazonia</text>
                {mapCities.map((item) => {
                  const intensity = Math.max(0.2, item.total / maxCases)
                  const color = item.scoreAvg >= 76 ? '#ef4444' : item.scoreAvg >= 41 ? '#f59e0b' : '#10b981'
                  const radius = 2.2 + intensity * 4.2
                  const active = activeCity?.city === item.city
                  return (
                    <g key={item.city} filter="url(#cityGlow)" style={{ cursor: 'pointer' }} onClick={() => setSelectedCity(item.city)}>
                      <circle cx={item.point.x} cy={item.point.y} r={radius + 1.8} fill={color} opacity={active ? 0.28 : 0.1} />
                      <circle cx={item.point.x} cy={item.point.y} r={radius} fill={color} opacity={0.78} stroke={active ? '#e0f2fe' : '#0f172a'} strokeWidth={active ? 1.8 : 1} />
                      {active && (
                        <>
                          <rect x={Math.min(item.point.x + radius + 1.8, 72)} y={item.point.y - 7} width="24" height="12" rx="3" fill="rgba(15,23,42,0.82)" stroke="rgba(226,232,240,0.18)" />
                          <text x={Math.min(item.point.x + radius + 4, 74)} y={item.point.y - 2.2} fill="#e2e8f0" fontSize="3.2" fontWeight="800">{item.city}</text>
                          <text x={Math.min(item.point.x + radius + 4, 74)} y={item.point.y + 2.4} fill="#94a3b8" fontSize="2.8">{item.total} casos</text>
                        </>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>

            <div style={cityMapSideStyle}>
              {mapCities.map((item) => {
                const riskColor = item.scoreAvg >= 76 ? 'var(--risk-red)' : item.scoreAvg >= 41 ? 'var(--risk-yellow)' : 'var(--risk-green)'
                const isActive = activeCity?.city === item.city

                return (
                  <button
                    key={item.city}
                    onClick={() => setSelectedCity(item.city)}
                    style={cityMapListButtonStyle(riskColor, isActive)}
                    title={`${item.city}: ${item.total} casos, score promedio ${item.scoreAvg}`}
                  >
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 800 }}>{item.city}</span>
                    <strong>{item.total}</strong>
                    <small style={{ color: 'var(--muted)' }}>Score {item.scoreAvg}</small>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={cityHeatmapLegendStyle}>
            <span><b style={{ color: 'var(--risk-green)' }}>Bajo</b> score promedio</span>
            <span><b style={{ color: 'var(--risk-yellow)' }}>Medio</b> score promedio</span>
            <span><b style={{ color: 'var(--risk-red)' }}>Critico</b> score promedio</span>
            <span>Punto mas grande = mas casos</span>
          </div>
        </>
      )}

      {activeCity && (
        <div style={cityRowStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeCity.city}</strong>
              <span style={{ color: 'var(--accent)', fontWeight: 900 }}>{activeCity.total} casos</span>
            </div>
            <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: 'var(--border)', marginTop: 10 }}>
              <div title={`${pct(activeCity.verde, activeCity.total)}% bajo`} style={{ width: `${pct(activeCity.verde, activeCity.total)}%`, background: 'var(--risk-green)' }} />
              <div title={`${pct(activeCity.amarillo, activeCity.total)}% medio`} style={{ width: `${pct(activeCity.amarillo, activeCity.total)}%`, background: 'var(--risk-yellow)' }} />
              <div title={`${pct(activeCity.rojo, activeCity.total)}% critico`} style={{ width: `${pct(activeCity.rojo, activeCity.total)}%`, background: 'var(--risk-red)' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={cityTagStyle}>Ramo: {activeCity.topLine}</span>
              <span style={cityTagStyle}>Cobertura: {activeCity.topCoverage}</span>
              <span style={cityTagStyle}>{pct(activeCity.total, total)}% del archivo</span>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 6, justifyItems: 'end', alignContent: 'center' }}>
            <strong style={{ color: activeCity.scoreAvg >= 76 ? 'var(--risk-red)' : activeCity.scoreAvg >= 41 ? 'var(--risk-yellow)' : 'var(--risk-green)', fontSize: 22 }}>{activeCity.scoreAvg}</strong>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>Score prom.</span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{activeCity.rojo} criticos</span>
          </div>
        </div>
      )}
    </Panel>
  )
}

function MiniStat({ label, value, color, info }) {
  return (
    <div style={{ display: 'grid', gap: 6, padding: 14, background: 'var(--panel-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: '0 0 10px rgba(96, 165, 250, 0.05)' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
        {label}
        {info && <InfoMark info={info} />}
      </span>
      <strong style={{ color, fontSize: 18 }}>{value}</strong>
    </div>
  )
}

function InfoMark({ info }) {
  return (
    <span title={info} aria-label={info} style={infoMarkStyle}>
      ?
    </span>
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

const infoMarkStyle = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 18,
  height: 18,
  borderRadius: 999,
  border: '1px solid var(--border-light)',
  color: 'var(--accent)',
  fontSize: 11,
  fontWeight: 900,
  cursor: 'help',
  flex: '0 0 auto',
}

const panelHeaderStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 12,
  alignItems: 'start',
  marginBottom: 8,
}

const dashboardOverviewStyle = {
  background: 'var(--panel-bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 18,
  boxShadow: '0 0 15px rgba(96, 165, 250, 0.05)',
}

const activeDatasetGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.6fr) repeat(3, minmax(150px, 0.5fr))',
  gap: 12,
  alignItems: 'stretch',
}

const activeDatasetEyebrowStyle = {
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const activeDatasetMetricStyle = {
  display: 'grid',
  gap: 5,
  alignContent: 'center',
  minHeight: 86,
  padding: 12,
  borderRadius: 8,
  background: '#111827',
  border: '1px solid var(--border-light)',
  color: 'var(--muted)',
  fontSize: 12,
}

const activeDatasetMetricValueStyle = {
  color: 'var(--text)',
  fontSize: 20,
  lineHeight: 1.05,
}

const portfolioHeaderStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 12,
  alignItems: 'start',
}

const portfolioSummaryStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 420px)',
  gap: 20,
  alignItems: 'center',
  marginTop: 18,
}

const portfolioActionStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 14,
  alignItems: 'center',
  marginTop: 18,
  padding: 14,
  borderRadius: 8,
  background: '#111827',
  border: '1px solid var(--border-light)',
}

const portfolioStatsStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
}

const cityMapLayoutStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(190px, 260px)',
  gap: 14,
  marginTop: 16,
  alignItems: 'stretch',
}

const cityMapFrameStyle = {
  height: 300,
  borderRadius: 8,
  overflow: 'hidden',
  background: '#0b1229',
  border: '1px solid var(--border-light)',
}

const cityMapSideStyle = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  maxHeight: 300,
  overflowY: 'auto',
  paddingRight: 4,
}

function cityMapListButtonStyle(riskColor, active) {
  return {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '4px 10px',
    alignItems: 'center',
    textAlign: 'left',
    background: active ? 'rgba(96, 165, 250, 0.16)' : '#111827',
    border: `1px solid ${active ? riskColor : 'var(--border-light)'}`,
    color: 'var(--text)',
    borderRadius: 8,
    padding: '8px 10px',
  }
}

const cityHeatmapLegendStyle = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  alignItems: 'center',
  marginTop: 12,
  color: 'var(--muted)',
  fontSize: 12,
}

const cityRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(84px, auto)',
  gap: 14,
  alignItems: 'center',
  background: 'var(--panel-bg)',
  border: '1px solid var(--border)',
  padding: 14,
  borderRadius: 8,
  marginTop: 16,
}

const cityTagStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 26,
  padding: '5px 8px',
  borderRadius: 999,
  background: '#111827',
  border: '1px solid var(--border-light)',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 800,
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

const trendChartShellStyle = {
  display: 'grid',
  gap: 14,
  marginTop: 14,
  width: '100%',
}

const trendControlsStyle = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  alignItems: 'center',
}

function trendToggleStyle(color, active) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: active ? '#111827' : 'rgba(15, 23, 42, 0.42)',
    color: active ? 'var(--text)' : 'var(--muted)',
    border: `1px solid ${active ? color : 'var(--border)'}`,
    borderRadius: 999,
    padding: '8px 11px',
    fontWeight: 900,
    boxShadow: active ? `0 0 0 3px color-mix(in srgb, ${color} 16%, transparent)` : 'none',
  }
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

function TrendLineChart({ data, series, height = 320 }) {
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(series.map((serie) => serie.key)))
  const width = 1280
  const pad = { top: 24, right: 28, bottom: 46, left: 44 }
  const activeSeries = series.filter((serie) => selectedKeys.has(serie.key))
  const maxValue = Math.max(1, ...data.flatMap((item) => activeSeries.map((serie) => item[serie.key] || 0)))
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom
  const points = activeSeries.map((serie) => ({
    serie,
    values: data.map((item, index) => {
      const x = pad.left + (index * plotWidth) / Math.max(1, data.length - 1)
      const y = pad.top + plotHeight - ((item[serie.key] || 0) / maxValue) * plotHeight
      return { ...item, x, y }
    }),
  }))

  const svgPath = (values) => values.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const fallbackPoint = data.length && activeSeries.length ? { ...data[data.length - 1], serie: activeSeries[0] } : null
  const activePoint = selectedPoint || fallbackPoint
  const totalBySerie = series.reduce((acc, serie) => {
    acc[serie.key] = data.reduce((sum, item) => sum + Number(item[serie.key] || 0), 0)
    return acc
  }, {})

  const toggleSerie = (key) => {
    setSelectedPoint(null)
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key) && next.size > 1) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!data.length) {
    return <div style={{ color: 'var(--muted)', marginTop: 14 }}>Sin datos de tendencia.</div>
  }

  return (
    <div style={trendChartShellStyle}>
      <div style={trendControlsStyle}>
        {series.map((serie) => {
          const active = selectedKeys.has(serie.key)
          return (
            <button key={serie.key} onClick={() => toggleSerie(serie.key)} style={trendToggleStyle(serie.color, active)}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: serie.color }} />
              <span>{serie.label}</span>
              <strong>{totalBySerie[serie.key]}</strong>
            </button>
          )
        })}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, minHeight: height, display: 'block' }}>
        <rect x={pad.left} y={pad.top} width={plotWidth} height={plotHeight} rx="10" fill="#0b1229" stroke="var(--border)" />
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = pad.top + plotHeight - tick * plotHeight
          const label = Math.round(tick * maxValue)
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="rgba(148, 163, 184, 0.28)" strokeWidth="1" />
              <text x={pad.left - 12} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="12">{label}</text>
            </g>
          )
        })}
        {points.map(({ values, serie }) => (
          <path key={serie.key} d={svgPath(values)} fill="none" stroke={serie.color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" opacity={0.98} />
        ))}
        {data.map((item, index) => {
          const x = pad.left + (index * plotWidth) / Math.max(1, data.length - 1)
          return (
            <rect
              key={item.date || index}
              x={x - Math.max(3, plotWidth / Math.max(1, data.length) / 2)}
              y={pad.top}
              width={Math.max(6, plotWidth / Math.max(1, data.length))}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => {
                const strongest = points
                  .map(({ values, serie }) => ({ ...values[index], serie }))
                  .sort((a, b) => Number(b[b.serie.key] || 0) - Number(a[a.serie.key] || 0))[0]
                setSelectedPoint(strongest)
              }}
              style={{ cursor: 'crosshair' }}
            />
          )
        })}
        {activePoint && (
          <>
            <line x1={activePoint.x} x2={activePoint.x} y1={pad.top} y2={pad.top + plotHeight} stroke="rgba(203, 213, 225, 0.48)" strokeDasharray="4 4" />
            {points.map(({ values, serie }) => {
              const point = values.find((value) => value.date === activePoint.date)
              if (!point) return null
              return <circle key={serie.key} cx={point.x} cy={point.y} r={5.5} fill={serie.color} stroke="#020617" strokeWidth="2" />
            })}
          </>
        )}
        <text x={pad.left} y={height - 12} fill="#94a3b8" fontSize="12">{data[0]?.label || ''}</text>
        <text x={width / 2} y={height - 12} fill="#94a3b8" fontSize="12" textAnchor="middle">{data.length} dias reportados</text>
        <text x={width - pad.right} y={height - 12} fill="#94a3b8" fontSize="12" textAnchor="end">{data[data.length - 1]?.label || ''}</text>
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
    </div>
  )
}
