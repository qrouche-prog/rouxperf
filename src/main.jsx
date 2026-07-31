import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './rouxperf-theme.css'
import './rouxperf-forge-bridge.css'
import App from './App.jsx'
import { ThemeProvider } from './components/theme.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
