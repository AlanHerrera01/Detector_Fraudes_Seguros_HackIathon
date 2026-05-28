import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import useFraudData from '../../hooks/useFraudData'

const AI_PROVIDERS = [
  { value: 'gemini', label: 'Gemini' },
  // Futura implementacion: OpenAI, GitHub Models y Local.
]

const INITIAL_MESSAGE = {
  from: 'assistant',
  text: 'Hola, soy el asistente de FraudIA. ¿Qué necesitas revisar?\n- Explicar el score o semáforo de este siniestro.\n- Ver los casos con mayor riesgo.\n- Revisar proveedores, documentos, montos atípicos o patrones.\n- Generar un resumen ejecutivo para comité.',
  sources: ['rules_engine', 'claims_scores'],
}

function cleanAssistantText(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s?/g, '')
    .trim()
}

function providerName(provider) {
  return AI_PROVIDERS.find((item) => item.value === provider)?.label || provider || 'IA'
}

function shouldUseActiveClaim(question) {
  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const caseTerms = [
    'este siniestro',
    'este caso',
    'caso activo',
    'por que',
    'porque',
    'explica',
    'explicame',
    'alto riesgo',
    'rojo',
    'amarillo',
    'verde',
    'semaforo',
    'score',
    'alerta',
    'marcado',
    'nivel',
  ]
  return caseTerms.some((term) => normalized.includes(term))
}

export default function AIAssistantPanel() {
  const api = useFraudData()
  const location = useLocation()
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [aiProvider, setAiProvider] = useState('gemini')
  const speechSupported = useMemo(() => typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition), [])
  const activeClaimId = useMemo(() => {
    const match = location.pathname.match(/^\/siniestros\/([^/]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }, [location.pathname])

  async function send(text = input) {
    const question = text.trim()
    if (!question || loading) return
    setMessages((current) => [...current, { from: 'user', text: question }])
    setInput('')
    setLoading(true)
    try {
      const useActiveClaim = Boolean(activeClaimId && shouldUseActiveClaim(question))
      const scopedQuestion = useActiveClaim ? `[Caso activo ${activeClaimId}] ${question}` : question
      const result = await api.queryAgent(scopedQuestion, aiProvider, useActiveClaim ? activeClaimId : null)
      const answer = cleanAssistantText(result.answer) || 'No recibi una respuesta util de Gemini. Intenta de nuevo.'
      setMessages((current) => [
        ...current,
        {
          from: 'assistant',
          text: answer,
          sources: result.sources || [],
          provider: result.provider || aiProvider,
          requestedProvider: aiProvider,
        },
      ])
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
    recognition.maxAlternatives = 1
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
            <p style={{ color: '#a7f3d0', marginTop: 2, fontSize: 12 }}>{providerName(aiProvider)}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMessages([INITIAL_MESSAGE])} style={resetStyle}>Nuevo</button>
          <button onClick={() => setCollapsed(true)} title="Reducir asistente IA" style={resetStyle}>Cerrar</button>
        </div>
      </header>

      <section style={chatIntroStyle}>
        <strong>Asistente IA FraudIA</strong>
        <span style={chatIntroSubtitleStyle}>
          {activeClaimId ? `Contexto activo: siniestro ${activeClaimId}` : 'Analisis conversacional de siniestros'}
        </span>
      </section>

      <section style={messagesStyle}>
        {messages.map((message, index) => (
          <Message key={`${message.from}-${index}`} message={message} />
        ))}
        {loading && <div style={thinkingStyle}>Analizando casos y reglas...</div>}
      </section>

      <footer style={composerStyle}>
        <select value={aiProvider} onChange={(event) => setAiProvider(event.target.value)} style={providerSelectStyle} aria-label="Modelo IA">
          {AI_PROVIDERS.map((provider) => (
            <option key={provider.value} value={provider.value}>{provider.label}</option>
          ))}
        </select>
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
        <div style={{ display: 'grid', gridTemplateColumns: speechSupported ? '44px 1fr' : '1fr', gap: 8 }}>
          {speechSupported && (
            <button
              onClick={startVoice}
              disabled={listening}
              title={listening ? 'Escuchando' : 'Dictar'}
              aria-label={listening ? 'Escuchando' : 'Dictar'}
              style={iconButtonStyle}
            >
              <MicIcon />
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
  if (!text) return null
  return (
    <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
      <div style={isUser ? userBubbleStyle : assistantBubbleStyle}>
        {!isUser && (
          <div style={assistantBubbleHeaderStyle}>
            <span>Asistente IA FraudIA</span>
            {message.provider && <small style={assistantBubbleModelStyle}>{providerName(message.provider)}</small>}
          </div>
        )}
        <div style={messageTextStyle}>{text}</div>
      </div>
    </div>
  )
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
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

const providerSelectStyle = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 10px',
  font: 'inherit',
  color: '#111827',
  background: '#fff',
}

const chatIntroStyle = {
  padding: '12px 14px',
  borderBottom: '1px solid var(--border)',
  display: 'grid',
  gap: 2,
  background: '#fff',
  color: '#0f172a',
  fontSize: 14,
}

const chatIntroSubtitleStyle = {
  color: '#64748b',
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

const iconButtonStyle = {
  background: '#eef2f7',
  color: '#111827',
  display: 'grid',
  placeItems: 'center',
  padding: 0,
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

const assistantBubbleHeaderStyle = {
  display: 'grid',
  gap: 2,
  color: '#0f766e',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  marginBottom: 8,
}

const assistantBubbleModelStyle = {
  color: '#64748b',
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'none',
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
