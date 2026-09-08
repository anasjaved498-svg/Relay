import { NavLink, Navigate, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Users, Youtube, Network, ListOrdered, Timer, ShieldAlert, ScrollText, Settings as SettingsIcon, LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './ui'
import { ChatWidget } from './ChatWidget'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/accounts', label: 'Accounts', icon: Users },
  { to: '/channels', label: 'Channels', icon: Youtube },
  { to: '/proxies', label: 'Proxies', icon: Network },
  { to: '/queue', label: 'Queue', icon: ListOrdered },
  { to: '/pipeline-times', label: 'Pipeline Times', icon: Timer },
  { to: '/violations', label: 'Violations & Health', icon: ShieldAlert },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function ProtectedLayout() {
  const { session, loading, user, signOut } = useAuth()

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Spinner label="Checking session…" /></div>
  }
  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen">
      <aside
        className="flex w-60 flex-none flex-col border-r px-4 py-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <div
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg font-display text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--warn))', color: 'var(--accent-text)' }}
          >
            R
          </div>
          <div>
            <div className="font-display text-sm font-semibold leading-tight">Relay</div>
            <div className="text-[10px] leading-tight" style={{ color: 'var(--text-dim)' }}>From YouTube to TikTok, on autopilot</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? '' : ''}`
              }
              style={({ isActive }) => ({
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              })}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="mb-2 truncate px-2 text-xs" style={{ color: 'var(--text-dim)' }}>{user?.email}</div>
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 overflow-x-hidden">
        <Outlet />
      </div>

      {/* Only rendered inside the protected layout -> never on the login screen */}
      <ChatWidget />
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between border-b px-8 py-5 backdrop-blur"
      style={{ background: 'color-mix(in srgb, var(--bg) 85%, transparent)', borderColor: 'var(--border-soft)' }}
    >
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  )
}
