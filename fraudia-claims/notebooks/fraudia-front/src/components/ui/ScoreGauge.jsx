import { useEffect, useRef } from 'react'
import { levelFromScore } from '../../utils/riskHelpers'

export default function ScoreGauge({ score=0, size=160 }){
  const r = (size/2)-10
  const c = 2*Math.PI*r
  const pct = Math.max(0, Math.min(100, score))
  const offset = c - (c * pct / 100)
  const { color, label } = levelFromScore(score)
  const circleRef = useRef(null)

  useEffect(()=>{
    if (circleRef.current) circleRef.current.style.strokeDashoffset = offset
  },[offset])

  return (
    <div style={{width:size,height:size,display:'grid',placeItems:'center',position:'relative'}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} stroke="#e6eef6" strokeWidth="10" fill="none" />
        <circle ref={circleRef} cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c} style={{transition:'stroke-dashoffset 1s ease'}} />
      </svg>
      <div style={{position:'absolute', textAlign:'center'}}>
        <div style={{fontFamily:'var(--font-mono)', fontSize:20}}>{score}</div>
        <div style={{fontSize:12,color:'var(--muted)'}}>{label}</div>
      </div>
    </div>
  )
}
