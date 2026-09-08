import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Youtube, Network, ListOrdered, Timer, ShieldAlert, ScrollText, Settings as SettingsIcon, LogOut, Menu, X,
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

/** Shared logo mark, reused by both the desktop sidebar and the mobile top bar. */
function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex flex-none items-center justify-center rounded-lg font-display font-bold ${compact ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm'}`}
        style={{ background: 'linear-gradient(135deg, var(--accent), var(--warn))', color: 'var(--accent-text)' }}
      >
        R
      </div>
      {!compact && (
        <div>
          <div className="font-display text-sm font-semibold leading-tight">Relay</div>
          <div className="text-[10px] leading-tight" style={{ color: 'var(--text-dim)' }}>From YouTube to TikTok, on autopilot</div>
        </div>
      )}
      {compact && <div className="font-display text-sm font-semibold leading-tight">Relay</div>}
    </div>
  )
}

export function ProtectedLayout() {
  const { session, loading, user, signOut } = useAuth()
  const location = useLocation()
  // Sidebar is an off-canvas drawer on mobile/tablet (< md), static on desktop (>= md).
  const [navOpen, setNavOpen] = useState(false)

  // Close the mobile drawer automatically whenever the route changes.
  useEffect(() => { setNavOpen(false) }, [location.pathname])

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Spinner label="Checking session…" /></div>
  }
  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen md:flex">
      {/* Mobile-only top bar: brand + hamburger toggle. Hidden at md and up,
          where the sidebar is always visible instead. */}
      <div
        className="sticky top-0 z-30 flex h-14 flex-none items-center justify-between border-b px-4 md:hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <Brand compact />
        <button
          onClick={() => setNavOpen(o => !o)}
          aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={navOpen}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg"
          style={{ color: 'var(--text-muted)' }}
        >
          {navOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Backdrop behind the open mobile drawer. */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-none flex-col overflow-y-auto border-r px-4 py-5 transition-transform duration-200 ease-out md:sticky md:top-0 md:z-auto md:h-screen md:w-60 md:max-w-none md:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="mb-6 hidden px-2 md:flex">
          <Brand />
        </div>
        {/* On mobile the top bar already shows the brand, so give the drawer
            a close button of its own at the same spot instead of repeating it. */}
        <div className="mb-4 flex items-center justify-between px-2 md:hidden">
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Menu</span>
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition md:py-2"
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

      {/* min-w-0 lets wide tables scroll inside their own card instead of
          stretching this column (and the whole page) horizontally. */}
      <div className="min-w-0 flex-1 overflow-x-hidden">
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
      className="sticky top-14 z-10 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 backdrop-blur sm:px-8 sm:py-5 md:top-0"
      style={{ background: 'color-mix(in srgb, var(--bg) 85%, transparent)', borderColor: 'var(--border-soft)' }}
    >
      <div className="min-w-0">
        <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
