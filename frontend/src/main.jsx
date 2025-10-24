import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './shared/i18n.js'
import App from './App.jsx'
import { MetaProvider } from './shared/meta.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MetaProvider>
      <App />
    </MetaProvider>
  </StrictMode>,
)
