import { useState } from 'react'
import useFraudData from '../hooks/useFraudData'

const SUGGESTIONS = [
  'Cuales son los 10 siniestros con mayor riesgo?',
  'Que proveedor concentra mas alertas rojas?',
  'Dame un resumen ejecutivo para comite.',
  'Que ciudades tienen mayor score promedio?',
]

export default function AIAgent() {
  const api = useFraudData()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)

  async function send(text = input) {
    if (!text.trim()) return
    const user = { from: 'user', text }
    setMessages((m) => [...m, user])
    setInput('')
    setTyping(true)
    const res = await api.queryAgent(text)
    setTyping(false)
    setMessages((m) => [...m, { from: 'assistant', text: res.answer }])
  }

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 900 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SUGGESTIONS.map((item) => (
          <button key={item} onClick={() => send(item)}>{item}</button>
        ))}
      </div>

      <div style={{ background: '#fff', padding: 12, borderRadius: 8, minHeight: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{ alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', background: m.from === 'user' ? '#0f172a' : '#f1f5f9', color: m.from === 'user' ? '#fff' : '#000', padding: 10, borderRadius: 8, maxWidth: '80%', lineHeight: 1.45 }}>{m.text}</div>
          ))}
          {typing && <div style={{ color: 'var(--muted)' }}>Asistente analizando...</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)' }} />
          <button onClick={() => send()} style={{ padding: '8px 12px', background: '#0f172a', color: '#fff' }}>Enviar</button>
        </div>
      </div>
    </div>
  )
}
