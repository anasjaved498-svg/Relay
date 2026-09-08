import { useEffect, useState } from 'react'
import '@n8n/chat/dist/chat.css'
import { createChat } from '@n8n/chat'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const WEBHOOK_URL =
  (import.meta.env.VITE_CHAT_WEBHOOK_URL as string) ||
  'http://localhost:5678/webhook/7b93d42a-fb46-4a3f-8df2-f8ea8458c4e1/chat'

/**
 * Floating n8n chat assistant. Only mounted for authenticated users
 * (mounted inside ProtectedLayout — never rendered on the login screen).
 *
 * NOTE: No Authorization/Basic-Auth header is sent with the widget — if the
 * webhook requires auth it will respond 401 and the input bar won't appear.
 */
export function ChatWidget() {
  const { session } = useAuth()
  const authed = !!session
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    if (!authed) return
    setConnectionError(null)
    setChatOpen(false)

    const headers: Record<string, string> = {}

    const target = document.createElement('div')
    target.id = 'n8n-chat-root'
    document.body.appendChild(target)

    // The widget itself doesn't surface webhook failures (it just fails to
    // render an input box). Probe the endpoint ourselves first so a broken
    // webhook shows a visible error instead of a silently-missing input.
    let cancelled = false
    fetch(WEBHOOK_URL, { method: 'OPTIONS', headers }).catch(() => fetch(WEBHOOK_URL, { method: 'GET', headers }).catch(() => null))
      .then(res => {
        if (cancelled) return
        if (res && !res.ok && res.status !== 404 && res.status !== 405) {
          setConnectionError(`Chat webhook responded with ${res.status}. Check VITE_CHAT_WEBHOOK_URL / auth.`)
        }
      })
      .catch(() => { if (!cancelled) setConnectionError('Could not reach the chat webhook. Is n8n running and VITE_CHAT_WEBHOOK_URL correct?') })

    // The round launcher button is rendered by @n8n/chat itself (not our
    // React tree), so we watch the DOM for it and wire a plain click
    // listener to know when the panel opens/closes — this drives the
    // greeting bubble (shown only while closed) below.
    let toggleBtn: HTMLElement | null = null
    let toggleCleanup: (() => void) | null = null
    const observer = new MutationObserver(() => {
      const btn = target.querySelector('.chat-window-toggle') as HTMLElement | null
      if (btn && btn !== toggleBtn) {
        toggleBtn = btn
        const onToggleClick = () => setChatOpen(o => !o)
        btn.addEventListener('click', onToggleClick)
        toggleCleanup = () => btn.removeEventListener('click', onToggleClick)
      }
    })
    observer.observe(target, { childList: true, subtree: true })

    createChat({
      webhookUrl: WEBHOOK_URL,
      target: '#n8n-chat-root',
      mode: 'window',
      showWelcomeScreen: false,
      webhookConfig: { method: 'POST', headers },
      initialMessages: ['How can I assist you today?'],
      i18n: {
        en: {
          title: 'TikTok Automation Assistant',
          subtitle: 'Ask about accounts, queue, uploads, proxies and health.',
          inputPlaceholder: 'e.g. How many videos uploaded today?',
          getStarted: 'New conversation',
          footer: '',
        } as never,
      },
    })

    return () => {
      cancelled = true
      observer.disconnect()
      toggleCleanup?.()
      target.remove()
    }
  }, [authed])

  if (!authed) return null

  const showBubble = !connectionError && !chatOpen

  return (
    <>
      {connectionError && (
        <div
          className="fixed bottom-5 right-5 z-[9999] flex max-w-xs items-start gap-2 rounded-lg border px-3.5 py-3 text-xs shadow-lg"
          style={{ background: 'var(--surface)', borderColor: 'var(--bad)', color: 'var(--text)' }}
        >
          <AlertTriangle size={15} className="mt-0.5 flex-none" style={{ color: 'var(--bad)' }} />
          <div>
            <div className="font-semibold" style={{ color: 'var(--bad)' }}>Chat assistant unavailable</div>
            <div className="mt-0.5" style={{ color: 'var(--text-muted)' }}>{connectionError}</div>
          </div>
        </div>
      )}
      {showBubble && (
        <div className="relay-chat-bubble-wrap">
          <button
            type="button"
            className="relay-chat-bubble relay-chat-bubble-in"
            onClick={() => document.querySelector<HTMLElement>('#n8n-chat-root .chat-window-toggle')?.click()}
          >
            How can I assist you today?
          </button>
        </div>
      )}
    </>
  )
}
