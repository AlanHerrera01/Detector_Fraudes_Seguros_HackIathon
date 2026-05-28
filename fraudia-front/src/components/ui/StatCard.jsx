export default function StatCard({ label, value, accent, hint, info }){
  return (
    <div style={{background:'var(--panel-bg)', borderRadius:'var(--radius-md)', padding:16, display:'grid', gap:8, border:'1px solid var(--border)', borderLeft:`5px solid ${accent || 'var(--accent)'}`}}>
      <div style={{flex:1}}>
        <div style={{fontSize:12, textTransform:'uppercase', color:'var(--text-muted)', letterSpacing:0}}>{label}</div>
        <div style={{fontFamily:'var(--font-mono)', fontSize:24, marginTop:6, color:'var(--text)'}}>{value}</div>
        {hint && <div style={{fontSize:13, color:'var(--muted)', marginTop:6}}>{hint}</div>}
        {info && <div style={{fontSize:12, color:'var(--text-secondary)', marginTop:6, lineHeight:1.35}}>{info}</div>}
      </div>
    </div>
  )
}
