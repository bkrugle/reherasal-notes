import { Routes, Route, Navigate } from 'react-router-dom'
import { SessionProvider, useSession } from './lib/session'
import LandingPage from './pages/LandingPage'
import CreatePage from './pages/CreatePage'
import ProductionApp from './pages/ProductionApp'
import SetupPage from './pages/SetupPage'
import AuditionFormPage from './pages/AuditionFormPage'
import AuditionEditPage from './pages/AuditionEditPage'
import ImportPage from './pages/ImportPage'
import CheckinPage from './pages/CheckinPage'
import CastPortalPage from './pages/CastPortalPage'
import CheckinRedirectPage from './pages/CheckinRedirectPage'
import PlatformPage from './pages/PlatformPage'
import HelpPage from './pages/HelpPage'

function RequireAuth({ children }) {
  const { session } = useSession()
  if (!session) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/production" element={<RequireAuth><ProductionApp /></RequireAuth>} />
        <Route path="/setup" element={<RequireAuth><SetupPage /></RequireAuth>} />
        {/* Public audition routes — no auth required */}
        <Route path="/audition/:productionCode" element={<AuditionFormPage />} />
        <Route path="/audition-edit/:token" element={<AuditionEditPage />} />
        <Route path="/import" element={<RequireAuth><ImportPage /></RequireAuth>} />
        <Route path="/checkin/:productionCode/:showDate" element={<CheckinPage />} />
        <Route path="/checkin/:productionCode" element={<CheckinRedirectPage />} />
        <Route path="/portal/:productionCode" element={<CastPortalPage />} />
		<Route path="/platform" element={<PlatformPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
		<Route path="/help" element={<HelpPage />} />
      </Routes>
    </SessionProvider>
  )
}
