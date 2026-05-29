import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import Dashboard from './pages/Dashboard'
import SiniestrosList from './pages/SiniestrosList'
import SiniestroDetail from './pages/SiniestroDetail'
import Providers from './pages/Providers'
import RulesApplied from './pages/RulesApplied'
import Reports from './pages/Reports'
import AIAgent from './pages/AIAgent'
import UploadEvidence from './pages/UploadEvidence'
import AIAssistantPanel from './components/ai/AIAssistantPanel'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

function AppLayout() {
  const [assistantOpen, setAssistantOpen] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <TopBar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/siniestros" element={<SiniestrosList />} />
            <Route path="/siniestros/:id" element={<SiniestroDetail />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/rules" element={<RulesApplied />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/upload" element={<UploadEvidence />} />
            <Route path="/agent" element={<AIAgent />} />
          </Routes>
        </main>
      </div>
      <AIAssistantPanel
        variant="floating"
        open={assistantOpen}
        onOpen={() => setAssistantOpen(true)}
        onClose={() => setAssistantOpen(false)}
      />
    </div>
  )
}
