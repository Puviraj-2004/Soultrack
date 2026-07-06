import { APP_CONFIG } from '../data/config'

export default function Chat() {
  return (
    <div className="min-h-screen px-6 pb-36 pt-12" style={{ backgroundColor: APP_CONFIG.theme.bg, color: APP_CONFIG.theme.text }}>
      <p className="text-xs font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>
        Soultrack Chat
      </p>
      <h1 className="mt-1 text-3xl font-extrabold" style={{ color: APP_CONFIG.theme.primary }}>
        Opening soon
      </h1>

      <div className="mt-10 rounded-3xl border bg-white p-6 text-center shadow-sm" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl" style={{ backgroundColor: APP_CONFIG.theme.accent }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={APP_CONFIG.theme.primary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold">Chat is taking a tiny nap.</h2>
        <p className="mt-2 text-sm font-medium leading-6" style={{ color: APP_CONFIG.theme.textMuted }}>
          This little space will open soon for messages, memories, and song thoughts.
        </p>
      </div>
    </div>
  )
}
