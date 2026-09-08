import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button, Field, Input } from '../components/ui'

export default function Login() {
  const { session, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!email || !password) { setErr('Enter your email and password.'); return }
    setBusy(true)
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) setErr(error)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[400px] rounded-2xl border p-8"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
      >
        <div className="mb-6 flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg font-display text-base font-bold"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--warn))', color: 'var(--accent-text)' }}
          >
            R
          </div>
          <div>
            <div className="font-display text-base font-semibold">Relay</div>
            <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>From YouTube to TikTok, on autopilot</div>
          </div>
        </div>

        <h1 className="mb-1 text-xl font-semibold font-display">Sign in</h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          Access is by invite — accounts are created in Supabase directly.
        </p>

        <Field label="Email">
          <Input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>

        {err && <div className="mb-4 text-sm" style={{ color: 'var(--bad)' }}>{err}</div>}

        <Button type="submit" loading={busy} disabled={busy}>
          <span className="w-full text-center">Sign in</span>
        </Button>
      </form>
    </div>
  )
}
