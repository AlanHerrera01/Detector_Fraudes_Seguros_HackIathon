import { useEffect, useState } from 'react'
import useFraudData from '../hooks/useFraudData'

export default function Providers() {
  const api = useFraudData()
  const [list, setList] = useState([])
  const [network, setNetwork] = useState([])

  useEffect(() => {
    api.getProveedores().then(setList)
    api.getProviderNetworks(8).then(setNetwork)
  }, [])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h3 style={{ margin: 0 }}>Red de riesgo</h3>
        <p style={{ color: 'var(--muted)', marginTop: 6 }}>
          Concentraciones entre proveedores, asegurados, vehiculos y ciudades.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {network.slice(0, 4).map((item) => (
          <div key={item.beneficiario} style={{ background: '#fff', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>{item.beneficiario}</strong>
              <span style={{ fontFamily: 'var(--font-mono)' }}>Indice {item.indice_concentracion}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12, fontSize: 13 }}>
              <span>{item.total_casos} casos</span>
              <span>{item.asegurados_unicos} asegurados</span>
              <span>{item.vehiculos_unicos} vehiculos</span>
              <span>{item.alertas_rojas} rojos</span>
            </div>
          </div>
        ))}
      </div>

      <h4 style={{ margin: '8px 0 0' }}>Ranking de proveedores</h4>
      <div style={{ display: 'grid', gap: 8 }}>
        {list.map((p, idx) => (
          <div key={p.beneficiario || p.id} style={{ background: '#fff', padding: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontWeight: 700 }}>{idx + 1}</div>
            <div style={{ flex: 1 }}>
              <div>{p.beneficiario || p.nombre}</div>
              <div style={{ height: 8, background: '#eef4fb', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
                <div
                  style={{
                    width: `${Math.min(100, p.score_promedio || p.alertas || 0)}%`,
                    height: 8,
                    background: (p.alertas_rojas || p.alertas) > 2 ? 'var(--risk-red)' : (p.score_promedio || 0) > 40 ? 'var(--risk-yellow)' : 'var(--risk-green)',
                  }}
                />
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)' }}>{p.alertas_rojas ?? p.alertas} alertas rojas</div>
          </div>
        ))}
      </div>
    </div>
  )
}
