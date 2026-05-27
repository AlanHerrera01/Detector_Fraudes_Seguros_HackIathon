import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import Dashboard from './pages/Dashboard'
import SiniestrosList from './pages/SiniestrosList'
import SiniestroDetail from './pages/SiniestroDetail'
import Providers from './pages/Providers'
import AIAgent from './pages/AIAgent'
import UploadEvidence from './pages/UploadEvidence'
import AIAssistantPanel from './components/ai/AIAssistantPanel'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{display: 'flex', minHeight: '100vh'}}>
        <Sidebar />
        <div style={{flex: 1, background: 'var(--page-bg)', minWidth: 0}}>
          <TopBar />
          <main style={{padding: 24}}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/siniestros" element={<SiniestrosList />} />
              <Route path="/siniestros/:id" element={<SiniestroDetail />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/upload" element={<UploadEvidence />} />
              <Route path="/agent" element={<AIAgent />} />
            </Routes>
          </main>
        </div>
        <AIAssistantPanel />
      </div>
    </BrowserRouter>
  )
}
