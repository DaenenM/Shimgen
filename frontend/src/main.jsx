import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  // StrictMode double-invokes effects in development to surface missing
  // cleanups. It is a no-op in the production build.
  <StrictMode>
    <App />
  </StrictMode>,
)
