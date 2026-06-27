import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LibraryProvider } from './context/LibraryContext'
import { PlayerProvider } from './context/PlayerContext'
import { registerSW } from 'virtual:pwa-register' // Added SW dynamic registration
import './index.css'
import App from './App.jsx'

// Register Service Worker for dynamic PWA installation and caching support
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LibraryProvider>
        <PlayerProvider>
          <App />
        </PlayerProvider>
      </LibraryProvider>
    </BrowserRouter>
  </StrictMode>
)