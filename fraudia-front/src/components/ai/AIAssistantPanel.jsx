import { useMemo, useState } from 'react'
import useFraudData from '../../hooks/useFraudData'

const QUICK_PROMPTS = [
  'Recomienda que casos deberia revisar primero el analista.',
  'Que proveedores concentran mas alertas rojas?',
  'Que documentos faltan en los casos criticos?',
  'Genera un resumen ejecutivo de los casos criticos.',
]

const INITIAL_MESSAGE = {
  from: 'assistant',
  text: 'Hola, soy tu analista FraudIA. Puedes preguntarme como a un colega: que caso revisar primero, por que un siniestro salio alto, que proveedor preocupa o que resumen llevar al comite.',
  sources: ['rules_engine', 'claims_scores'],
}

function sourceName(source) {
  const names = {
    top_claims: 'Top casos',
    claims_scores: 'Scores',
    provider_ranking: 'Proveedores',
    rules_engine: 'Reglas',
    document_review: 'Documentos',
    amount_outliers: 'Montos',
    portfolio_summary: 'Resumen',
    ethics_guardrail: 'Etica',
    claim_detail: 'Caso',
    narrative_signals: 'NLP',
  }
  return names[source] || source
}

function cleanAssistantText(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s?/g, '')
    .trim()
}

export default function AIAssistantPanel() {
  const api = useFraudData()
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const speechSupported = useMemo(() => typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition), [])

  async function send(text = input) {
    const question = text.trim()
    if (!question || loading) return
    setMessages((current) => [...current, { from: 'user', text: question }])
    setInput('')
    setLoading(true)
    try {
      const result = await api.queryAgent(question)
      setMessages((current) => [...current, { from: 'assistant', text: result.answer, sources: result.sources || [] }])
    } catch (exc) {
      setMessages((current) => [...current, { from: 'assistant', text: `No pude consultar el agente: ${exc.message}`, sources: ['system'] }])
    } finally {
      setLoading(false)
    }
  }

  function startVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) return
    const recognition = new Recognition()
    recognition.lang = 'es-CO'
    recognition.interimResults = false
    setListening(true)
    recognition.onresult = (event) => {
      setInput(event.results[0][0].transcript)
      setListening(false)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
  }

  if (collapsed) {
    return (
      <aside style={collapsedPanelStyle} aria-label="Asistente IA compacto">
        <button
          onClick={() => setCollapsed(false)}
          title="Expandir asistente IA"
          style={collapsedToggleStyle}
        >
          IA
        </button>
        <div style={collapsedRailTextStyle}>Asistente</div>
      </aside>
    )
  }

  return (
    <aside style={panelStyle}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={avatarStyle}>IA</div>
          <div>
            <h3 style={{ margin: 0, color: '#fff' }}>AI Assistant</h3>
            <p style={{ color: '#a7f3d0', marginTop: 2, fontSize: 12 }}>Analista experto en linea</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMessages([INITIAL_MESSAGE])} style={resetStyle}>Nuevo</button>
          <button onClick={() => setCollapsed(true)} title="Reducir asistente IA" style={resetStyle}>Cerrar</button>
        </div>
      </header>

      <section style={toolsStyle}>
        <div style={toolCardStyle}>
          <strong>Respuesta trazable</strong>
          <span>Usa reglas, scores, NLP y PostgreSQL.</span>
        </div>
        <div style={toolGridStyle}>
          {QUICK_PROMPTS.slice(0, 3).map((prompt) => (
            <button key={prompt} onClick={() => send(prompt)} style={quickStyle}>
              {prompt.replace('?', '').slice(0, 34)}
            </button>
          ))}
        </div>
      </section>

      <section style={messagesStyle}>
        {messages.map((message, index) => (
          <Message key={`${message.from}-${index}`} message={message} />
        ))}
        {loading && <div style={thinkingStyle}>Analizando casos y reglas...</div>}
      </section>

      <footer style={composerStyle}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
          placeholder="Pregunta al agente..."
          rows={3}
          style={textAreaStyle}
        />
        <div style={{ display: 'grid', gridTemplateColumns: speechSupported ? 'auto 1fr' : '1fr', gap: 8 }}>
          {speechSupported && (
            <button onClick={startVoice} disabled={listening} style={secondaryButtonStyle}>
              {listening ? 'Escuchando' : 'Dictar'}
            </button>
          )}
          <button onClick={() => send()} disabled={!input.trim() || loading} style={sendStyle}>Enviar</button>
        </div>
      </footer>
    </aside>
  )
}

function Message({ message }) {
  const isUser = message.from === 'user'
  const text = isUser ? message.text : cleanAssistantText(message.text)
  return (
    <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
      <div style={isUser ? userBubbleStyle : assistantBubbleStyle}>
        {!isUser && <div style={assistantLabelStyle}>Analisis FraudIA</div>}
        <div style={messageTextStyle}>{text}</div>
      </div>
      {!isUser && message.sources?.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
          {message.sources.slice(0, 3).map((source) => (
            <span key={source} style={sourceStyle}>{sourceName(source)}</span>
          ))}
        </div>
      )}
    </div>
  )
}

const panelStyle = {
  width: 380,
  minWidth: 380,
  background: '#ffffff',
  borderLeft: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  position: 'sticky',
  top: 0,
  transition: 'width 180ms ease, min-width 180ms ease',
  zIndex: 5,
}

const collapsedPanelStyle = {
  width: 64,
  minWidth: 64,
  background: '#ffffff',
  borderLeft: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  height: '100vh',
  position: 'sticky',
  top: 0,
  padding: '14px 8px',
  transition: 'width 180ms ease, min-width 180ms ease',
  zIndex: 5,
}

const collapsedToggleStyle = {
  width: 44,
  height: 44,
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  background: '#0f172a',
  color: '#fff',
  fontWeight: 900,
  padding: 0,
}

const collapsedRailTextStyle = {
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  color: '#64748b',
  fontSize: 12,
  letterSpacing: 0,
}

const headerStyle = {
  background: 'linear-gradient(135deg, #0f172a 0%, #115e59 100%)',
  padding: 16,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
}

const avatarStyle = {
  width: 38,
  height: 38,
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  background: '#ccfbf1',
  color: '#0f172a',
  fontWeight: 900,
}

const resetStyle = {
  background: 'rgba(255,255,255,0.14)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.2)',
}

const toolsStyle = {
  padding: 12,
  borderBottom: '1px solid var(--border)',
  display: 'grid',
  gap: 10,
}

const toolCardStyle = {
  display: 'grid',
  gap: 4,
  background: '#f8fafc',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 10,
  color: '#334155',
  fontSize: 13,
}

const toolGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 6,
}

const quickStyle = {
  textAlign: 'left',
  background: '#ecfeff',
  color: '#155e75',
  border: '1px solid #cffafe',
  fontSize: 12,
}

const messagesStyle = {
  flex: 1,
  overflow: 'auto',
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  background: '#fbfdff',
}

const composerStyle = {
  padding: 12,
  borderTop: '1px solid var(--border)',
  display: 'grid',
  gap: 8,
  background: '#fff',
}

const textAreaStyle = {
  resize: 'none',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 10,
  font: 'inherit',
  lineHeight: 1.45,
}

const sendStyle = {
  background: '#0f172a',
  color: '#fff',
}

const secondaryButtonStyle = {
  background: '#eef2f7',
}

const userBubbleStyle = {
  background: '#0f172a',
  color: '#fff',
  padding: 10,
  borderRadius: 8,
  lineHeight: 1.45,
  fontSize: 13,
}

const assistantBubbleStyle = {
  background: '#fff',
  color: '#111827',
  border: '1px solid var(--border)',
  padding: 12,
  borderRadius: 8,
  lineHeight: 1.55,
  fontSize: 14,
}

const assistantLabelStyle = {
  color: '#0f766e',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  marginBottom: 6,
}

const messageTextStyle = {
  whiteSpace: 'pre-line',
}

const thinkingStyle = {
  alignSelf: 'flex-start',
  color: 'var(--muted)',
  background: '#f8fafc',
  border: '1px solid var(--border)',
  padding: 10,
  borderRadius: 8,
}

const sourceStyle = {
  fontSize: 11,
  color: '#475569',
  background: '#eef2f7',
  padding: '3px 6px',
  borderRadius: 999,
}
