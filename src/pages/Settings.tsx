import { useEffect, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { Card, Button, Input, Spinner, EmptyState, useConfirm } from '../components/ui'
import { useTheme, THEMES } from '../context/UiContext'
import { useToast } from '../context/UiContext'
import type { SystemSetting } from '../lib/types'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { push } = useToast()
  const { ask, dialog } = useConfirm()
  const [rows, setRows] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('system_settings').select('*').order('key')
    setRows(data || [])
    const initial: Record<string, string> = {}
    ;(data || []).forEach(r => { initial[r.key] = r.value || '' })
    setEdits(initial)
    setLoading(false)
  }

  async function save(key: string) {
    const { error } = await supabase.from('system_settings').update({ value: edits[key], updated_at: new Date().toISOString() }).eq('key', key)
    if (error) { push(error.message, 'bad'); return }
    push('Saved.', 'ok')
    load()
  }

  async function addSetting() {
    if (!newKey.trim()) { push('Enter a key.', 'bad'); return }
    const { error } = await supabase.from('system_settings').insert({ key: newKey.trim(), value: newValue })
    if (error) { push(error.message, 'bad'); return }
    setNewKey(''); setNewValue('')
    push('Setting added.', 'ok')
    load()
  }

  function remove(key: string) {
    ask('Delete setting?', `Remove "${key}" from system_settings?`, async () => {
      const { error } = await supabase.from('system_settings').delete().eq('key', key)
      if (error) { push(error.message, 'bad'); return }
      push('Deleted.', 'ok')
      load()
    })
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Appearance and system configuration." />
      <main className="flex flex-col gap-6 p-4 sm:p-8">
        <Card>
          <h3 className="mb-1 text-sm font-semibold">Theme</h3>
          <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>Applies instantly, saved to this browser.</p>
          <div className="flex flex-wrap gap-3">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium"
                style={{ borderColor: theme === t.id ? 'var(--accent)' : 'var(--border)', background: theme === t.id ? 'var(--accent-soft)' : 'var(--surface-2)' }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.swatch }} />
                {t.label}
                {theme === t.id && <Check size={13} style={{ color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-1 text-sm font-semibold">System settings</h3>
          <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            Key/value config read by your n8n workflows (max retries, monitoring interval, upload delay, timeouts, storage paths, log retention, etc).
          </p>
          {loading ? <Spinner /> : (
            <>
              {rows.length === 0 ? <EmptyState title="No settings yet" /> : (
                <div className="mb-4 flex flex-col gap-2">
                  {rows.map(r => (
                    <div key={r.key} className="flex flex-col gap-2 rounded-lg border p-2.5 sm:grid sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center" style={{ borderColor: 'var(--border)' }}>
                      <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{r.key}</div>
                      <Input value={edits[r.key] ?? ''} onChange={e => setEdits(s => ({ ...s, [r.key]: e.target.value }))} className="!py-1.5 !text-xs" />
                      <Button size="sm" variant="subtle" onClick={() => save(r.key)}>Save</Button>
                      <button title="Delete" onClick={() => remove(r.key)} style={{ color: 'var(--bad)' }}><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2 border-t pt-4 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:items-center" style={{ borderColor: 'var(--border-soft)' }}>
                <Input placeholder="new_setting_key" value={newKey} onChange={e => setNewKey(e.target.value)} />
                <Input placeholder="value" value={newValue} onChange={e => setNewValue(e.target.value)} />
                <Button size="sm" onClick={addSetting}><Plus size={14} /> Add</Button>
              </div>
            </>
          )}
        </Card>

        <Card>
          <h3 className="mb-1 text-sm font-semibold">Proxy connection testing</h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            This dashboard shows each proxy's last known <code>health_status</code> and <code>last_connection_time</code> from the
            database — a browser can't open a connection through an arbitrary proxy the way your worker does, so a "live test"
            button here would be fake. To get real health checks: have your n8n workflow (or a small script on the worker
            machine) periodically attempt a connection through each proxy and write the result back to <code>proxies.health_status</code>
            / <code>last_connection_time</code> — this page will reflect it automatically.
          </p>
        </Card>
      </main>
      {dialog}
    </div>
  )
}
