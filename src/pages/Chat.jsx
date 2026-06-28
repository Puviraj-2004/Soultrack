import { useEffect, useMemo, useRef, useState } from 'react'
import { getChatMessages, sendChatMessage, subscribeToChatMessages } from '../lib/chat'
import { APP_CONFIG } from '../data/config'

const SENDER_STORAGE_KEY = 'soultrack.chat.sender'

function formatMessageTime(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function getSenderOptions() {
  return [
    { id: 'person1', name: APP_CONFIG.couple.person1 },
    { id: 'person2', name: APP_CONFIG.couple.person2 },
  ]
}

function loadSavedSender() {
  try {
    const raw = localStorage.getItem(SENDER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function Chat() {
  const [sender, setSender] = useState(() => loadSavedSender())
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)

  const senderOptions = useMemo(() => getSenderOptions(), [])

  useEffect(() => {
    let isMounted = true

    getChatMessages()
      .then(data => {
        if (isMounted) setMessages(data)
      })
      .catch(err => {
        console.error(err)
        if (isMounted) setError(err.message || 'Could not load chat.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    const unsubscribe = subscribeToChatMessages(message => {
      setMessages(current => {
        if (current.some(item => item.id === message.id)) return current
        return [...current, message]
      })
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  function chooseSender(nextSender) {
    setSender(nextSender)
    localStorage.setItem(SENDER_STORAGE_KEY, JSON.stringify(nextSender))
  }

  function switchSender() {
    const nextSender = senderOptions.find(option => option.id !== sender?.id)
    if (nextSender) chooseSender(nextSender)
  }

  async function handleSend(e) {
    e?.preventDefault()
    const message = draft.trim()
    if (!message || !sender) return

    setSending(true)
    setError('')
    try {
      const saved = await sendChatMessage({
        sender_id: sender.id,
        sender_name: sender.name,
        message,
      })

      setMessages(current => {
        if (current.some(item => item.id === saved.id)) return current
        return [...current, saved]
      })
      setDraft('')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Message could not be sent.')
    } finally {
      setSending(false)
    }
  }

  if (!sender) {
    return (
      <div className="min-h-screen px-6 pb-36 pt-12" style={{ backgroundColor: APP_CONFIG.theme.bg, color: APP_CONFIG.theme.text }}>
        <p className="text-xs font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>Soultrack Chat</p>
        <h1 className="mt-1 text-3xl font-extrabold" style={{ color: APP_CONFIG.theme.primary }}>
          Who are you?
        </h1>

        <div className="mt-8 space-y-3">
          {senderOptions.map(option => (
            <button
              key={option.id}
              onClick={() => chooseSender(option)}
              className="flex w-full items-center gap-4 rounded-3xl border bg-white p-4 text-left shadow-sm active:scale-[0.99]"
              style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-extrabold" style={{ backgroundColor: APP_CONFIG.theme.accent, color: APP_CONFIG.theme.primary }}>
                {option.name.slice(0, 1)}
              </span>
              <span>
                <span className="block text-base font-bold">{option.name}</span>
                <span className="mt-1 block text-xs font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>
                  Use this name for messages
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: APP_CONFIG.theme.bg, color: APP_CONFIG.theme.text }}>
      <div className="border-b bg-white px-6 pb-4 pt-10" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>
              {APP_CONFIG.couple.person1} & {APP_CONFIG.couple.person2}
            </p>
            <h1 className="mt-1 truncate text-2xl font-extrabold" style={{ color: APP_CONFIG.theme.primary }}>
              Chat
            </h1>
          </div>
          <button
            onClick={switchSender}
            className="rounded-2xl border px-3 py-2 text-xs font-bold"
            style={{ color: APP_CONFIG.theme.textMuted, borderColor: APP_CONFIG.theme.surfaceHover }}
          >
            {sender.name}
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 pb-40 pt-5"
      >
        {loading ? (
          <div className="py-20 text-center text-sm font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>
            Loading chat...
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-2 mt-16 rounded-3xl border border-dashed bg-gray-50 p-6 text-center" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <p className="text-3xl">♡</p>
            <p className="mt-3 text-sm font-bold" style={{ color: APP_CONFIG.theme.textMuted }}>
              Start with a tiny hello.
            </p>
          </div>
        ) : (
          messages.map(message => {
            const mine = message.sender_id === sender.id

            return (
              <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-3xl px-4 py-2.5 shadow-sm ${mine ? 'rounded-br-lg' : 'rounded-bl-lg border bg-white'}`}
                  style={{
                    backgroundColor: mine ? APP_CONFIG.theme.primary : '#ffffff',
                    borderColor: APP_CONFIG.theme.surfaceHover,
                    color: mine ? '#ffffff' : APP_CONFIG.theme.text,
                  }}
                >
                  {!mine && (
                    <p className="mb-1 text-[11px] font-bold" style={{ color: APP_CONFIG.theme.primary }}>
                      {message.sender_name}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.message}</p>
                  <p className={`mt-1 text-right text-[10px] font-semibold ${mine ? 'text-white/75' : ''}`} style={{ color: mine ? undefined : APP_CONFIG.theme.textMuted }}>
                    {formatMessageTime(message.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="fixed bottom-20 left-0 right-0 z-40 border-t bg-white px-4 py-3"
        style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
      >
        {error && (
          <p className="mb-2 text-xs font-semibold" style={{ color: '#FF006E' }}>{error}</p>
        )}
        <div className="mx-auto flex max-w-md items-end gap-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
            rows={1}
            placeholder="Message"
            className="max-h-28 min-h-12 flex-1 resize-none rounded-2xl border bg-white px-4 py-3 text-sm font-medium outline-none"
            style={{ color: APP_CONFIG.theme.text, borderColor: APP_CONFIG.theme.surfaceHover }}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow disabled:opacity-50"
            style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#fff' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}
