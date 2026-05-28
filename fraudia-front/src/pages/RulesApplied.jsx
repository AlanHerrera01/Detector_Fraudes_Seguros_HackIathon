const RULE_GROUPS = [
  {
    title: 'Reglas fuertes',
    description: 'Condiciones criticas que elevan la prioridad de revision.',
    rules: [
      ['RF-01', 'Perdida total por robo', 'Cobertura de perdida total por robo.', 20, 'rojo'],
      ['RF-02', 'Documentos inconsistentes', 'Documentos alterados o con inconsistencias.', 10, 'rojo'],
      ['RF-03', 'Lista restrictiva', 'Asegurado, beneficiario, proveedor o APS con coincidencia exacta.', 10, 'rojo'],
      ['RF-04', 'Dinamica imposible', 'Dinamica del accidente fisicamente imposible.', 6, 'rojo'],
      ['RF-05', 'Borde extremo de vigencia', 'Evento en primeras o ultimas 48 horas de vigencia.', 8, 'amarillo'],
      ['RF-06', 'Demora denuncia de robo', 'Robo reportado despues de 4 dias.', 8, 'amarillo'],
      ['RF-07', 'Narrativa identica clonada', 'Descripcion identica a otro siniestro del dataset activo.', 5, 'amarillo'],
    ],
  },
  {
    title: 'Parametros operativos',
    description: 'Senales de frecuencia, oportunidad, documentos y monto.',
    rules: [
      ['S-01', 'Borde cercano de vigencia', 'Evento dentro de los primeros o ultimos 30 dias.', '4-8', 'amarillo'],
      ['S-02', 'Reporte tardio', 'Reporte entre 4 y mas de 7 dias despues del evento.', '3-5', 'amarillo'],
      ['S-03', 'Frecuencia asegurado', 'Asegurado con 2 o mas siniestros previos.', '4-8', 'amarillo'],
      ['S-04', 'Frecuencia vehiculo', 'Vehiculo con 2 o mas siniestros previos.', '3-6', 'amarillo'],
      ['S-10', 'Frecuencia conductor', 'Conductor con 2 o mas siniestros previos.', '4-8', 'amarillo'],
      ['S-05', 'Solo RC recurrente', 'Reclamos de responsabilidad civil con recurrencia.', '3-6', 'amarillo'],
      ['S-06', 'Proveedor recurrente', 'Proveedor asociado a mas de 2 casos observados.', 5, 'amarillo'],
      ['S-07', 'Documentos incompletos', 'Falta documentacion requerida para el reclamo.', 4, 'amarillo'],
      ['S-08', 'Sin tercero identificado', 'No hay tercero o evidencia externa suficiente.', 5, 'amarillo'],
      ['S-09', 'Monto cercano a suma asegurada', 'Monto reclamado igual o superior al 95% de la suma asegurada.', 5, 'amarillo'],
    ],
  },
  {
    title: 'Reglas NLP',
    description: 'Lectura reproducible del texto libre del siniestro.',
    rules: [
      ['NLP-01', 'Narrativa inconsistente', 'Descripcion con contradicciones o inconsistencias.', 7, 'amarillo'],
      ['NLP-02', 'Narrativa poco detallada', 'Relato vago que dificulta validar la dinamica.', 4, 'amarillo'],
      ['NLP-03', 'Narrativa de alto riesgo', 'Terminos sensibles combinados con reporte tardio o falta de tercero.', 5, 'amarillo'],
    ],
  },
]

const SCORE_LEVELS = [
  ['Verde', '0 a 40', 'Revision normal'],
  ['Amarillo', '41 a 75', 'Revision prioritaria'],
  ['Rojo', '76 a 100', 'Revision especializada'],
]

export default function RulesApplied() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section>
        <h2 style={{ margin: 0, fontSize: 26 }}>Reglas aplicadas</h2>
        <p style={{ color: 'var(--muted)', marginTop: 6, maxWidth: 760 }}>
          Parametros que explican como se generan alertas y puntos de riesgo. Son criterios de priorizacion para revision humana, no confirmaciones de fraude.
        </p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {SCORE_LEVELS.map(([level, range, action]) => (
          <div key={level} style={cardStyle}>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>Nivel {level}</span>
            <strong style={{ fontSize: 22 }}>{range}</strong>
            <span>{action}</span>
          </div>
        ))}
      </section>

      {RULE_GROUPS.map((group) => (
        <section key={group.title} style={panelStyle}>
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{group.title}</h3>
            <p style={{ color: 'var(--muted)', marginTop: 4 }}>{group.description}</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Codigo', 'Regla', 'Condicion', 'Puntos', 'Nivel'].map((label) => (
                    <th key={label} style={thStyle}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rules.map(([code, name, condition, points, severity]) => (
                  <tr key={code}>
                    <td style={tdStyle}><strong style={{ fontFamily: 'var(--font-mono)' }}>{code}</strong></td>
                    <td style={tdStyle}>{name}</td>
                    <td style={tdStyle}>{condition}</td>
                    <td style={tdStyle}>{points}</td>
                    <td style={tdStyle}><RiskBadge level={severity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
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

const cardStyle = {
  ...panelStyle,
  display: 'grid',
  gap: 6,
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
