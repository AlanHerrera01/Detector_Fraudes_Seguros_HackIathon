export default function StatCard({ label, value, accent, hint }){
  return (
    <div style={{background:'#fff', borderRadius:'var(--radius-md)', padding:16, display:'grid', gap:8, border:'1px solid var(--border)', borderLeft:`5px solid ${accent || 'var(--accent)'}`}}>
      <div style={{flex:1}}>
        <div style={{fontSize:12, textTransform:'uppercase', color:'var(--muted)', letterSpacing:0}}>{label}</div>
        <div style={{fontFamily:'var(--font-mono)', fontSize:24, marginTop:6, color:'#111827'}}>{value}</div>
        {hint && <div style={{fontSize:13, color:'var(--muted)', marginTop:6}}>{hint}</div>}
      </div>
    </div>
  )
}
