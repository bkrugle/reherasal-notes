import { createContext, useContext, useState, useEffect } from 'react'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const s = sessionStorage.getItem('rn_session')
      return s ? JSON.parse(s) : null
    } catch { return null }
  })

  function login(data) {
    sessionStorage.setItem('rn_session', JSON.stringify(data))
    // Clear greeting flag so modal shows on every fresh login
    const greetingKey = 'rn_greeted_' + (data?.sheetId || 'default')
    sessionStorage.removeItem(greetingKey)
    setSession(data)
  }

  function logout() {
    // Clear greeting flag before removing session
    const greetingKey = 'rn_greeted_' + (session?.sheetId || 'default')
    sessionStorage.removeItem(greetingKey)
    sessionStorage.removeItem('rn_session')
    setSession(null)
  }

  return (
    <SessionContext.Provider value={{ session, login, logout }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
