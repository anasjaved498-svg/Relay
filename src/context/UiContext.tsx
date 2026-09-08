import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/* ---------------- Theme ---------------- */
export type ThemeName = 'light' | 'dark' | 'ocean' | 'sunset'
export const THEMES: { id: ThemeName; label: string; swatch: string }[] = [
  { id: 'dark', label: 'Dark', swatch: '#4f8cff' },
  { id: 'light', label: 'Light', swatch: '#2f6fed' },
  { id: 'ocean', label: 'Ocean', swatch: '#22d3ee' },
  { id: 'sunset', label: 'Sunset', swatch: '#fb7a3c' },
]

interface ThemeState {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
}
const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('relay-theme') as ThemeName | null
    return saved && THEMES.some(t => t.id === saved) ? saved : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('relay-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/* ---------------- Toasts ---------------- */
export type ToastKind = 'ok' | 'bad' | 'info'
export interface Toast { id: number; text: string; kind: ToastKind }

interface ToastState {
  toasts: Toast[]
  push: (text: string, kind?: ToastKind) => void
}
const ToastContext = createContext<ToastState | null>(null)
let toastCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  function push(text: string, kind: ToastKind = 'info') {
    const id = ++toastCounter
    setToasts(t => [...t, { id, text, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3600)
  }

  return (
    <ToastContext.Provider value={{ toasts, push }}>
      {children}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className="animate-toast-in min-w-[220px] rounded-lg border px-4 py-3 text-sm shadow-lg"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
              borderLeft: `3px solid ${t.kind === 'bad' ? 'var(--bad)' : t.kind === 'ok' ? 'var(--good)' : 'var(--accent)'}`,
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
