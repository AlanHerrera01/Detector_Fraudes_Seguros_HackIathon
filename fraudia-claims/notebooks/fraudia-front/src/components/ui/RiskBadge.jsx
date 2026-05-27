import { levelFromScore } from '../../utils/riskHelpers'

export default function RiskBadge({ score, size='md' }){
  const { label, color, nivel } = levelFromScore(score)
  const sizes = { sm: {fontSize:12, padding:'4px 8px'}, md: {fontSize:14, padding:'6px 10px'}, lg: {fontSize:16, padding:'8px 12px'} }
  const emoji = nivel === 'verde'? '🟢' : nivel === 'amarillo'? '🟡' : '🔴'
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:8, background:'rgba(255,255,255,0.06)', borderRadius:999, color:'#fff', ...sizes[size]}}>
      <span>{emoji}</span>
      <span style={{fontSize: sizes[size].fontSize}}>{label}</span>
      <span style={{fontFamily:'var(--font-mono)', opacity:0.9}}>{score}</span>
    </div>
  )
}
