// Apply saved dark mode before first render to avoid flash
const savedMode = localStorage.getItem('rn_darkmode')
if (savedMode === 'dark') document.documentElement.classList.add('dark')
else if (savedMode === 'light') document.documentElement.classList.add('light')

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
