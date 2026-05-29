import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import useFraudData from '../../hooks/useFraudData'

const AI_PROVIDERS = [
  { value: 'gemini', label: 'Gemini' },
  // Futura implementacion: OpenAI, GitHub Models y Local.
]

const INITIAL_MESSAGE = {
  from: 'assistant',
  text: 'Hola, soy el asistente de FraudIA. Te ayudo a entender alertas y priorizar revisiones. ¿Qué necesitas?\n- Explicar por qué un siniestro salió crítico, medio o bajo.\n- Ver los casos con mayor riesgo.\n- Revisar proveedores, documentos faltantes, montos atípicos o patrones.\n- Preparar un resumen ejecutivo para comité.',
  sources: ['rules_engine', 'claims_scores'],
}

const WELCOME_MESSAGE = {
  ...INITIAL_MESSAGE,
  text: 'Hola, soy FraudIA. Puedo ayudarte a explicar un siniestro, priorizar riesgos o preparar un resumen para revision humana. ¿Qué quieres revisar?',
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

export default function AIAssistantPanel({ open = true, onOpen, onClose, variant = 'inline' }) {
  const api = useFraudData()
  const location = useLocation()
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [aiProvider, setAiProvider] = useState('gemini')
  const messagesEndRef = useRef(null)
  const speechSupported = useMemo(() => typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition), [])
  const activeClaimId = useMemo(() => {
    const match = location.pathname.match(/^\/siniestros\/([^/]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
    return () => cancelAnimationFrame(frame)
  }, [messages, loading, open])

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

  if (!open && variant === 'floating') {
    return (
      <aside className="ai-assistant-panel-collapsed" style={collapsedPanelStyle} aria-label="Asistente IA compacto">
        <button
          onClick={onOpen}
          title="Conversar con la IA"
          style={collapsedToggleStyle}
        >
          IA
        </button>
      </aside>
    )
  }

  if (!open) return null

  const isFloating = variant === 'floating'
  const isDrawer = variant === 'drawer'

  return (
      <aside
        className={`ai-assistant-panel ${isFloating ? 'assistant-floating-panel' : ''} ${isDrawer ? 'assistant-drawer-panel' : 'assistant-inline-panel'}`}
        style={isFloating ? floatingPanelStyle : isDrawer ? drawerPanelStyle : panelStyle}
        aria-label="Asistente IA FraudIA"
      >
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={avatarStyle}>IA</div>
            <div>
              <h3 style={{ margin: 0, color: '#fff' }}>Asistente IA FraudIA</h3>
              <p style={{ color: '#bfdbfe', marginTop: 3, fontSize: 12 }}>
                {activeClaimId ? `Caso activo: ${activeClaimId}` : 'Analisis conversacional'} · {providerName(aiProvider)}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setMessages([WELCOME_MESSAGE])} style={resetStyle}>Nuevo</button>
            {onClose && <button onClick={onClose} title="Cerrar asistente IA" style={resetStyle}>Cerrar</button>}
          </div>
        </header>

        <section style={messagesStyle}>
          {messages.map((message, index) => (
            <Message key={`${message.from}-${index}`} message={message} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </section>

        <footer style={composerStyle}>
          <div style={composerTopStyle}>
            <select value={aiProvider} onChange={(event) => setAiProvider(event.target.value)} style={providerSelectStyle} aria-label="Modelo IA">
              {AI_PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>{provider.label}</option>
              ))}
            </select>
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
          </div>
          <div style={isDrawer ? composerInputRowWideStyle : composerInputRowStyle}>
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
              rows={1}
              style={textAreaStyle}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading} style={isDrawer ? sendWideStyle : sendStyle}>Enviar</button>
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

function TypingIndicator() {
  return (
    <div style={thinkingStyle}>
      <span>Escribiendo</span>
      <span className="typing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
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
  width: '100%',
  height: 520,
  minHeight: 520,
  maxHeight: 520,
  background: 'var(--panel-bg)',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 18px 38px rgba(0, 0, 0, 0.24)',
}

const floatingPanelStyle = {
  ...panelStyle,
  position: 'fixed',
  right: 22,
  bottom: 22,
  zIndex: 60,
  width: 'min(420px, calc(100vw - 128px))',
  height: 'min(540px, calc(100vh - 90px))',
  minHeight: 420,
  maxHeight: 540,
  boxShadow: '0 24px 58px rgba(0, 0, 0, 0.36)',
}

const drawerPanelStyle = {
  ...panelStyle,
  position: 'fixed',
  right: 24,
  top: 92,
  zIndex: 70,
  width: 'min(580px, calc(100vw - 48px))',
  height: 'min(720px, calc(100vh - 116px))',
  minHeight: 560,
  maxHeight: 'calc(100vh - 116px)',
  boxShadow: '0 24px 70px rgba(0, 0, 0, 0.42)',
}

const collapsedPanelStyle = {
  position: 'fixed',
  right: 22,
  bottom: 22,
  zIndex: 60,
  width: 62,
  height: 62,
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'none',
}

const collapsedToggleStyle = {
  width: 62,
  height: 62,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 55%, #10b981 100%)',
  color: '#fff',
  fontWeight: 900,
  fontSize: 18,
  padding: 0,
  border: '1px solid rgba(191, 219, 254, 0.8)',
  boxShadow: '0 16px 36px rgba(14, 165, 233, 0.35)',
  pointerEvents: 'auto',
}

const headerStyle = {
  background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0ea5e9 100%)',
  padding: 14,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
}

const avatarStyle = {
  width: 34,
  height: 34,
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--accent)',
  color: '#0a0e27',
  fontWeight: 900,
  boxShadow: '0 0 12px rgba(96, 165, 250, 0.4)',
}

const resetStyle = {
  background: 'rgba(255,255,255,0.14)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.2)',
}

const providerSelectStyle = {
  // Estilos base vienen de index.css
}

const messagesStyle = {
  flex: 1,
  overflow: 'auto',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  background: '#081027',
  borderTop: '1px solid rgba(96, 165, 250, 0.16)',
  borderBottom: '1px solid rgba(96, 165, 250, 0.16)',
}

const composerStyle = {
  padding: 12,
  borderTop: '1px solid var(--border)',
  display: 'grid',
  gap: 8,
  background: 'var(--card-bg)',
}

const composerTopStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(120px, 1fr) auto',
  gap: 8,
  alignItems: 'center',
}

const composerInputRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 8,
  alignItems: 'stretch',
}

const composerInputRowWideStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 120px',
  gap: 8,
  alignItems: 'stretch',
}

const textAreaStyle = {
  resize: 'none',
  lineHeight: 1.35,
  minHeight: 44,
  maxHeight: 92,
  // Otros estilos vienen de index.css
}

const sendStyle = {
  background: '#0f172a',
  color: '#fff',
  minWidth: '100%',
  fontWeight: 800,
}

const sendWideStyle = {
  ...sendStyle,
  minWidth: 120,
}

const iconButtonStyle = {
  background: 'var(--card-bg)',
  color: 'var(--text)',
  display: 'grid',
  placeItems: 'center',
  padding: 0,
}

const userBubbleStyle = {
  background: '#0f172a',
  color: '#fff',
  padding: 9,
  borderRadius: 8,
  lineHeight: 1.45,
  fontSize: 13,
}

const assistantBubbleStyle = {
  background: 'var(--panel-bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  padding: 10,
  borderRadius: 8,
  lineHeight: 1.55,
  fontSize: 13,
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
  color: 'var(--text-muted)',
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  padding: 10,
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 700,
}
