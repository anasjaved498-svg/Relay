import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { friendlyError } from '../lib/errors'

const WRAP: React.CSSProperties = { overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }

export function ErrorMessage({ raw, tone = 'bad' }: { raw?: string | null; tone?: 'bad' | 'warn' | 'muted' }) {
  const [open, setOpen] = useState(false)
  const text = raw ? String(raw) : ''
  const label = friendlyError(text)
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--text)'
  const isLong = text.length > 120 || label !== text

  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold" style={{ ...WRAP, color }}>{label}</div>
      {isLong && text && (
        <>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium"
            style={{ color: 'var(--accent)' }}
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {open ? 'Show less' : 'Show more'}
          </button>
          {open && (
            <pre
              className="mt-1 max-h-64 overflow-y-auto rounded-md p-2 font-mono text-[11px]"
              style={{ ...WRAP, background: 'var(--surface-2)', color: 'var(--text-muted)' }}
            >{text}</pre>
          )}
        </>
      )}
    </div>
  )
}
