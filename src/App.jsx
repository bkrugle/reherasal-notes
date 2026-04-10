import { Routes, Route, Navigate } from 'react-router-dom'
import { SessionProvider, useSession } from './lib/session'
import LandingPage from './pages/LandingPage'
import CreatePage from './pages/CreatePage'
import ProductionApp from './pages/ProductionApp'
import SetupPage from './pages/SetupPage'

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
        <Route path="/production" element={
          <RequireAuth><ProductionApp /></RequireAuth>
        } />
        <Route path="/setup" element={
          <RequireAuth><SetupPage /></RequireAuth>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  )
}
