import { NavLink } from 'react-router-dom'
import { APP_CONFIG } from '../data/config'

const tabs = [
  { to: '/', label: 'Home', icon: 'M3 12h18M5 12l7-7 7 7M6 10v9h12v-9' },
  { to: '/playlists', label: 'Playlists', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { to: '/chat', label: 'Chat', icon: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white px-4 pb-safe pt-2"
      style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
    >
      <div className="mx-auto flex max-w-md items-center justify-between">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className="flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold"
            style={({ isActive }) => ({
              color: isActive ? APP_CONFIG.theme.primary : APP_CONFIG.theme.textMuted,
              backgroundColor: isActive ? APP_CONFIG.theme.accent : 'transparent',
            })}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
