import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function CheckinRedirectPage() {
  const { productionCode } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    navigate(`/checkin/${productionCode}/${today}`, { replace: true })
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text2)' }}>Loading…</p>
    </div>
  )
}
