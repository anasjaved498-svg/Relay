import { type ReactNode, useState } from 'react'
import { Loader2, X, AlertTriangle, RotateCcw } from 'lucide-react'

/* ---------------- Button ---------------- */
export function Button({
  children, onClick, variant = 'primary', size = 'md', disabled, loading, type = 'button', title,
}: {
  children: ReactNode; onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
  size?: 'sm' | 'md'
  disabled?: boolean; loading?: boolean; type?: 'button' | 'submit'; title?: string
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
  const variants: Record<string, { background: string; color: string; border?: string }> = {
    primary: { background: 'var(--accent)', color: 'var(--accent-text)' },
    danger: { background: 'var(--bad)', color: '#fff' },
    ghost: { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' },
    subtle: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' },
  }
  const style = variants[variant]
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${sizes}`}
      style={{ background: style.background, color: style.color, border: style.border }}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

/* ---------------- Badge ---------------- */
const BADGE_MAP: Record<string, { bg: string; fg: string }> = {
  active: { bg: 'var(--good-soft)', fg: 'var(--good)' },
  healthy: { bg: 'var(--good-soft)', fg: 'var(--good)' },
  completed: { bg: 'var(--good-soft)', fg: 'var(--good)' },
  online: { bg: 'var(--good-soft)', fg: 'var(--good)' },
  warning: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
  queued: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
  retrying: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
  processing: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
  uploading: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
  restricted: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
  paused: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
  unknown: { bg: 'var(--surface-2)', fg: 'var(--text-muted)' },
  disabled: { bg: 'var(--bad-soft)', fg: 'var(--bad)' },
  inactive: { bg: 'var(--bad-soft)', fg: 'var(--bad)' },
  failed: { bg: 'var(--bad-soft)', fg: 'var(--bad)' },
  banned: { bg: 'var(--bad-soft)', fg: 'var(--bad)' },
  cancelled: { bg: 'var(--bad-soft)', fg: 'var(--bad)' },
  error: { bg: 'var(--bad-soft)', fg: 'var(--bad)' },
  info: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
  warn: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
  // TikTok login-flow statuses (Accounts page)
  needs_login: { bg: 'var(--surface-2)', fg: 'var(--text-muted)' },
  logging_in: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
  login_failed: { bg: 'var(--bad-soft)', fg: 'var(--bad)' },
}
export function Badge({ value, pulse }: { value: string | null | undefined; pulse?: boolean }) {
  const v = (value || 'unknown').toLowerCase()
  const c = BADGE_MAP[v] || { bg: 'var(--surface-2)', fg: 'var(--text-muted)' }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${pulse ? 'animate-pulse-slow' : ''}`}
      style={{ background: c.bg, color: c.fg }}
    >
      {value || 'unknown'}
    </span>
  )
}

/* ---------------- Card ---------------- */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {children}
    </div>
  )
}

/* ---------------- Spinner / loading state ---------------- */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
      <Loader2 size={16} className="animate-spin" /> {label || 'Loading…'}
    </div>
  )
}

/* ---------------- Empty state ---------------- */
export function EmptyState({
  title, hint, icon, action,
}: { title: string; hint?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-10 text-center">
      {icon && <div className="mb-1" style={{ color: 'var(--text-dim)' }}>{icon}</div>}
      <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</div>
      {hint && <div className="max-w-xs text-xs" style={{ color: 'var(--text-dim)' }}>{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/* ---------------- Load error state (with retry) ---------------- */
export function LoadError({ message, onRetry }: { message?: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <AlertTriangle size={22} style={{ color: 'var(--bad)' }} />
      <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Couldn't load this data.</div>
      {message && <div className="max-w-sm text-xs" style={{ color: 'var(--text-dim)' }}>{message}</div>}
      <Button size="sm" variant="subtle" onClick={onRetry}><RotateCcw size={13} /> Retry</Button>
    </div>
  )
}

/* ---------------- Table skeleton (loading placeholder) ---------------- */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-t py-3" style={{ borderColor: 'var(--border-soft)' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-3 flex-1 animate-pulse-slow rounded"
              style={{ background: 'var(--surface-2)', maxWidth: c === 0 ? '160px' : '110px' }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ---------------- Input / Select / Textarea ---------------- */
const fieldStyle = { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }

export function Field({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <label className="mb-3 block">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      {children}
      {error && <div className="mt-1 text-[11px]" style={{ color: 'var(--bad)' }}>{error}</div>}
    </label>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)] ${props.className || ''}`}
      style={fieldStyle}
    />
  )
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)] ${props.className || ''}`}
      style={fieldStyle}
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)] ${props.className || ''}`}
      style={fieldStyle}
    >
      {props.children}
    </select>
  )
}

/* ---------------- Modal ---------------- */
export function Modal({
  open, onClose, title, children, width = 480, zIndex = 50,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number; zIndex?: number }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.5)', zIndex }}>
      <div
        className="max-h-[88vh] w-full overflow-y-auto rounded-2xl border p-6 thin-scroll"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxWidth: width, boxShadow: 'var(--shadow)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold font-display">{title}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------------- Confirm dialog ---------------- */
export function ConfirmDialog({
  open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, danger = true,
}: {
  open: boolean; title: string; message: string; confirmLabel?: string
  onConfirm: () => void; onCancel: () => void; danger?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.5)' }}>
      <div className="w-full max-w-sm rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
        <h2 className="mb-2 text-base font-semibold">{title}</h2>
        <p className="mb-5 text-sm" style={{ color: 'var(--text-muted)' }}>{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

/** Hook-style helper for a single confirm dialog reused across a page. */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  function ask(title: string, message: string, onConfirm: () => void) {
    setState({ title, message, onConfirm })
  }
  const dialog = (
    <ConfirmDialog
      open={!!state}
      title={state?.title || ''}
      message={state?.message || ''}
      onConfirm={() => { state?.onConfirm(); setState(null) }}
      onCancel={() => setState(null)}
    />
  )
  return { ask, dialog }
}

/* ---------------- Pagination ---------------- */
export function Pagination({
  page, pageCount, onChange,
}: { page: number; pageCount: number; onChange: (p: number) => void }) {
  if (pageCount <= 1) return null
  return (
    // Left-aligned (never in the far bottom-right corner) so it never overlaps
    // the floating chat launcher icon — same convention as PaginationBar below.
    <div className="mt-3 flex items-center justify-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="disabled:opacity-40">Prev</button>
      <span>Page {page} of {pageCount}</span>
      <button disabled={page >= pageCount} onClick={() => onChange(page + 1)} className="disabled:opacity-40">Next</button>
    </div>
  )
}

/* ---------------- Pagination with rows-per-page selector ----------------
 * Left-aligned (never in the far bottom-right corner) so it never overlaps
 * the floating chat launcher icon. Unlike Pagination above, always renders
 * (even on a single page) so the rows-per-page control stays reachable. */
export function PaginationBar({
  page, pageCount, onPageChange, pageSize, onPageSizeChange, pageSizeOptions = [25, 50, 100],
}: {
  page: number; pageCount: number; onPageChange: (p: number) => void
  pageSize: number; onPageSizeChange: (n: number) => void
  pageSizeOptions?: number[]
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
      <label className="flex items-center gap-2">
        <span>Rows per page:</span>
        <Select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="!w-auto !py-1"
        >
          {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
        </Select>
      </label>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="disabled:opacity-40">Prev</button>
        <span>Page {page} of {pageCount}</span>
        <button disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="disabled:opacity-40">Next</button>
      </div>
    </div>
  )
}
