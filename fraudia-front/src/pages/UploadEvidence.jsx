import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useFraudData from '../hooks/useFraudData'

export default function UploadEvidence() {
  const api = useFraudData()
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function upload() {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const uploadResult = await api.uploadDataset(file)
      setResult(uploadResult)
      if (uploadResult?.document_type !== 'pdf') {
        navigate('/', {
          state: {
            uploadMessage: uploadResult?.message || 'Archivo cargado. Dashboard actualizado.',
          },
        })
      }
    } catch (exc) {
      setError(exc.message)
    } finally {
      setLoading(false)
    }
  }

  const isPdf = result?.document_type === 'pdf'

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 960 }}>
      <section style={{ background: 'var(--panel-bg)', padding: 18, borderRadius: 8, display: 'grid', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Ingreso de archivo</h3>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>
            Carga CSV o Excel para recalcular el portafolio, o PDF como soporte documental para analisis narrativo.
          </p>
        </div>

        <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 18, display: 'grid', gap: 10 }}>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>
            CSV/Excel: debe contener columnas de siniestros. PDF: se usa para extraer texto y senales de narrativa.
          </div>
          <button onClick={upload} disabled={!file || loading} style={{ width: 180, background: '#0f172a', color: '#fff' }}>
            {loading ? 'Analizando...' : 'Cargar archivo'}
          </button>
        </div>

        {error && <div style={{ padding: 12, borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>{error}</div>}

        {result && (
          <div style={{ padding: 14, borderRadius: 8, background: '#f8fafc', display: 'grid', gap: 10 }}>
            <strong>{result.message}</strong>
            {result.total_claims && <div>Total de siniestros cargados: {result.total_claims}</div>}
            {isPdf && (
              <>
                <div>
                  <strong>Senales narrativas:</strong>{' '}
                  {(result.signals?.senales_narrativa || []).length
                    ? result.signals.senales_narrativa.join(', ')
                    : 'sin senales criticas detectadas'}
                </div>
                <div style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                  {result.text_preview}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <div style={{ background: 'var(--panel-bg)', padding: 14, borderRadius: 8 }}>
          <strong>CSV estructurado</strong>
          <p style={{ color: 'var(--muted)', marginTop: 8 }}>
            Actualiza la base activa de siniestros, recalcula reglas, modelo IA, semaforo y explicaciones.
          </p>
        </div>
        <div style={{ background: 'var(--panel-bg)', padding: 14, borderRadius: 8 }}>
          <strong>PDF soporte</strong>
          <p style={{ color: 'var(--muted)', marginTop: 8 }}>
            Extrae texto para detectar narrativa vaga, inconsistente o sensible. No reemplaza el CSV de scoring.
          </p>
        </div>
      </section>
    </div>
  )
}
