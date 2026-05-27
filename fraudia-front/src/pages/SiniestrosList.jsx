import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useFraudData from '../hooks/useFraudData'
import { formatCurrency, formatDate } from '../utils/riskHelpers'

export default function SiniestrosList() {
  const api = useFraudData()
  const [list, setList] = useState([])
  const [search, setSearch] = useState('')
  const [riesgo, setRiesgo] = useState('todos')
  const nav = useNavigate()

  useEffect(() => {
    api.getSiniestros({ search, riesgo, limit: 100 }).then((r) => setList(r.items))
  }, [search, riesgo])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input placeholder="Buscar por ID" value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setRiesgo('todos')}>Todos</button>
          <button onClick={() => setRiesgo('rojo')} style={{ background: 'var(--risk-red)', color: '#fff' }}>Rojo</button>
          <button onClick={() => setRiesgo('amarillo')} style={{ background: 'var(--risk-yellow)', color: '#fff' }}>Amarillo</button>
          <button onClick={() => setRiesgo('verde')} style={{ background: 'var(--risk-green)', color: '#fff' }}>Verde</button>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 8, padding: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ textAlign: 'left', color: 'var(--muted)' }}>
            <tr>
              <th>ID</th><th>Ramo</th><th>Cobertura</th><th>Monto</th><th>Fecha</th><th>NLP</th><th>Score</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id_siniestro} style={{ cursor: 'pointer' }} onClick={() => nav(`/siniestros/${s.id_siniestro}`)}>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{s.id_siniestro}</td>
                <td>{s.ramo}</td>
                <td>{s.cobertura}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(s.monto_reclamado)}</td>
                <td>{formatDate(s.fecha_ocurrencia)}</td>
                <td>{(s.senales_narrativa || []).length}</td>
                <td>{s.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
