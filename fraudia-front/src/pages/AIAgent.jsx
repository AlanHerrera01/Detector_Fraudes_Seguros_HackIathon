import { useMemo, useState } from 'react'
import useFraudData from '../hooks/useFraudData'

const SUGGESTIONS = [
  {
    title: 'Resumen para comite',
    prompt: 'Dame un resumen ejecutivo para comite.',
    detail: 'Portafolio, riesgos y recomendacion.',
  },
  {
    title: 'Proveedor critico',
    prompt: 'Que proveedor concentra mas alertas rojas?',
    detail: 'Ranking y concentracion de alertas.',
  },
  {
    title: 'Top riesgos',
    prompt: 'Cuales son los 10 siniestros con mayor riesgo?',
    detail: 'Casos que debe revisar primero el analista.',
  },
  {
    title: 'Narrativa NLP',
    prompt: 'Que senales narrativas deberia revisar?',
    detail: 'Texto vago, inconsistente o sensible.',
  },
  {
    title: 'Explicar caso',
    prompt: 'Explicame el caso SIN-0002 como analista experto.',
    detail: 'Score, reglas y siguientes pasos.',
  },
]

const AI_PROVIDERS = [
  { value: 'gemini', label: 'Gemini' },
  // Futura implementacion: OpenAI, GitHub Models y Local.
]

const INITIAL_MESSAGE = {
  from: 'assistant',
  text: 'Hola, soy el agente experto de FraudIA. Puedo ayudarte a priorizar casos, explicar scores, revisar proveedores, detectar senales narrativas y preparar un resumen para comite. Mis respuestas son alertas para revision humana, no confirmaciones de fraude.',
  sources: ['portfolio_summary', 'rules_engine', 'ethics_guardrail'],
}

function sourceLabel(source) {
  const labels = {
    portfolio_summary: 'Portafolio',
    claims_scores: 'Scores',
    provider_ranking: 'Proveedores',
    rules_engine: 'Reglas',
    top_claims: 'Top casos',
    claim_detail: 'Detalle caso',
    narrative_signals: 'NLP',
    ethics_guardrail: 'Etica',
    city_summary: 'Ciudades',
    system: 'Sistema',
  }
  return labels[source] || source
}

function providerLabel(provider) {
  return AI_PROVIDERS.find((item) => item.value === provider)?.label || provider || 'IA'
}

export default function AIAgent() {
  const api = useFraudData()
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [listening, setListening] = useState(false)
  const [activePrompt, setActivePrompt] = useState(SUGGESTIONS[0].prompt)
  const [aiProvider, setAiProvider] = useState('gemini')
  const speechSupported = useMemo(() => typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition), [])

  async function send(text = input) {
    const question = text.trim()
    if (!question || typing) return
    setActivePrompt(question)
    setMessages((current) => [...current, { from: 'user', text: question }])
    setInput('')
    setTyping(true)
    try {
      const res = await api.queryAgent(question, aiProvider)
      setMessages((current) => [...current, { from: 'assistant', text: res.answer, sources: res.sources || [], provider: res.provider || aiProvider }])
    } catch (exc) {
      setMessages((current) => [...current, { from: 'assistant', text: `No pude consultar el agente: ${exc.message}`, sources: ['system'] }])
    } finally {
      setTyping(false)
    }
  }

  function startVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) return
    const recognition = new Recognition()
    recognition.lang = 'es-CO'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    setListening(true)
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript
      setInput(text)
      setListening(false)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
  }

  const lastSources = [...messages].reverse().find((message) => message.sources?.length)?.sources || []

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="agent-hero" style={heroStyle}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={avatarStyle}>IA</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 26, color: '#fff' }}>Agente experto FraudIA</h2>
              <p style={{ marginTop: 5, color: '#cbd5e1' }}>Analisis conversacional con Gemini para siniestros, proveedores, narrativa y explicabilidad.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatusChip label="Conectado a scores" />
            <StatusChip label="Reglas trazables" />
            <StatusChip label="NLP narrativo" />
            <StatusChip label="Revision humana" />
          </div>
        </div>
        <div style={heroPanelStyle}>
          <span style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' }}>Consulta activa</span>
          <strong style={{ color: '#fff', lineHeight: 1.4 }}>{activePrompt}</strong>
          <label style={providerFieldStyle}>
            <span>Modelo IA</span>
            <select value={aiProvider} onChange={(event) => setAiProvider(event.target.value)} style={providerSelectStyle}>
              {AI_PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>{provider.label}</option>
              ))}
            </select>
          </label>
          <button onClick={() => setMessages([INITIAL_MESSAGE])} style={{ background: 'var(--card-bg)', color: 'var(--text)', marginTop: 8 }}>Nueva conversacion</button>
        </div>
      </section>

      <div className="agent-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 330px', gap: 16 }}>
        <section style={chatShellStyle}>
          <div style={messagesStyle}>
            {messages.map((message, index) => (
              <MessageBubble key={`${message.from}-${index}`} message={message} />
            ))}
            {typing && <TypingBubble />}
          </div>

          <footer style={composerStyle}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SUGGESTIONS.slice(0, 3).map((item) => (
                <button key={item.title} onClick={() => send(item.prompt)} style={smallActionStyle}>{item.title}</button>
              ))}
            </div>
            <div className="agent-composer-grid" style={{ display: 'grid', gridTemplateColumns: speechSupported ? '1fr auto auto' : '1fr auto', gap: 8 }}>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                }}
                placeholder="Escribe tu pregunta: explica un caso, pide ranking, solicita resumen para comite..."
                rows={2}
                style={textareaStyle}
              />
              {speechSupported && (
                <button onClick={startVoice} disabled={listening} style={{ ...sendButtonStyle, background: listening ? 'var(--risk-yellow)' : '#eef2f7', color: listening ? '#fff' : '#111827' }}>
                  {listening ? 'Escuchando' : 'Dictar'}
                </button>
              )}
              <button onClick={() => send()} disabled={!input.trim() || typing} style={sendButtonStyle}>Enviar</button>
            </div>
          </footer>
        </section>

        <aside style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <Panel title="Acciones inteligentes">
            <div style={{ display: 'grid', gap: 8 }}>
              {SUGGESTIONS.map((item) => (
                <button key={item.title} onClick={() => send(item.prompt)} style={suggestionStyle}>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Fuentes usadas">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {lastSources.length ? lastSources.map((source) => <SourceChip key={source} source={source} />) : <span style={{ color: 'var(--muted)' }}>Aun sin fuentes.</span>}
            </div>
          </Panel>

          <Panel title="Guardrail etico">
            <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
              El agente prioriza revision y explica senales. No confirma fraude, no decide rechazos y siempre recomienda validacion humana.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

function MessageBubble({ message }) {
  const isUser = message.from === 'user'
  return (
    <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '84%', display: 'grid', gap: 6 }}>
      <div style={isUser ? userBubbleStyle : assistantBubbleStyle}>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 5 }}>{isUser ? 'Tu pregunta' : 'Agente experto'}</div>
        {!isUser && message.provider && <div style={{ fontSize: 12, color: '#0f766e', marginBottom: 5 }}>{providerLabel(message.provider)}</div>}
        <div style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>
      </div>
      {!isUser && message.sources?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {message.sources.map((source) => <SourceChip key={source} source={source} />)}
        </div>
      )}
    </div>
  )
}

function TypingBubble() {
  return (
    <div style={{ alignSelf: 'flex-start', background: 'var(--card-bg)', border: '1px solid var(--border)', padding: 12, borderRadius: 8, color: 'var(--text-muted)' }}>
      Analizando portafolio, reglas, NLP y proveedores...
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <section style={{ background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
      <h4 style={{ margin: '0 0 10px' }}>{title}</h4>
      {children}
    </section>
  )
}

function StatusChip({ label }) {
  return <span style={{ background: 'rgba(255,255,255,0.1)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.16)', padding: '6px 9px', borderRadius: 999, fontSize: 13 }}>{label}</span>
}

function SourceChip({ source }) {
  return <span style={{ fontSize: 12, color: '#334155', background: '#eef2f7', border: '1px solid #e2e8f0', padding: '4px 7px', borderRadius: 999 }}>{sourceLabel(source)}</span>
}

const heroStyle = {
  background: 'linear-gradient(135deg, var(--sidebar-bg) 0%, var(--card-bg) 52%, #0f766e 100%)',
  borderRadius: 8,
  padding: 20,
  display: 'grid',
  gridTemplateColumns: '1fr 320px',
  gap: 18,
  alignItems: 'center',
  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.16)',
}

const avatarStyle = {
  width: 54,
  height: 54,
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  background: '#e0f2fe',
  color: '#0f172a',
  fontWeight: 900,
  letterSpacing: 0,
}

const heroPanelStyle = {
  background: 'rgba(15, 23, 42, 0.52)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 8,
  padding: 14,
  display: 'grid',
  gap: 6,
}

const providerFieldStyle = {
  display: 'grid',
  gap: 6,
  color: '#cbd5e1',
  fontSize: 12,
  marginTop: 4,
}

const providerSelectStyle = {
  width: '100%',
  // Otros estilos vienen de index.css
}

const chatShellStyle = {
  background: 'var(--panel-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  minHeight: 590,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const messagesStyle = {
  flex: 1,
  overflow: 'auto',
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 13,
  background: 'var(--page-bg)',
}

const composerStyle = {
  padding: 14,
  borderTop: '1px solid var(--border)',
  display: 'grid',
  gap: 10,
  background: 'var(--card-bg)',
}

const assistantBubbleStyle = {
  background: 'var(--card-bg)',
  color: 'var(--text)',
  padding: 13,
  borderRadius: 8,
  lineHeight: 1.5,
  border: '1px solid var(--border)',
  boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)',
}

const userBubbleStyle = {
  background: '#0f172a',
  color: '#fff',
  padding: 13,
  borderRadius: 8,
  lineHeight: 1.5,
}

const textareaStyle = {
  resize: 'none',
  lineHeight: 1.45,
  // Otros estilos vienen de index.css
}

const sendButtonStyle = {
  background: '#0f172a',
  color: '#fff',
  minWidth: 88,
}

const smallActionStyle = {
  background: '#eef6ff',
  color: '#1e3a8a',
  border: '1px solid #dbeafe',
}

const suggestionStyle = {
  textAlign: 'left',
  display: 'grid',
  gap: 4,
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  padding: 11,
}
