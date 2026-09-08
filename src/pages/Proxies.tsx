import { useEffect, useState } from 'react'
import { Plus, Trash2, Power, Info, Globe } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { Card, Badge, Button, Spinner, TableSkeleton, LoadError, EmptyState, Modal, Field, Input, Select, useConfirm } from '../components/ui'
import { fmtDate, nextId } from '../lib/helpers'
import { useToast } from '../context/UiContext'
import type { Proxy, TikTokAccount, YouTubeChannel } from '../lib/types'

export default function Proxies() {
  const { push } = useToast()
  const { ask, dialog } = useConfirm()
  const [proxies, setProxies] = useState<Proxy[]>([])
  const [accountCounts, setAccountCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [drilldownId, setDrilldownId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error: pErr } = await supabase.from('proxies').select('*').order('proxy_id')
    if (pErr) { setError(pErr.message); setLoading(false); return }
    const { data: accounts, error: aErr } = await supabase.from('tiktok_accounts').select('proxy_id')
    if (aErr) { setError(aErr.message); setLoading(false); return }
    setError(null)
    setProxies(data || [])
    const counts: Record<string, number> = {}
    ;(accounts || []).forEach(a => { if (a.proxy_id) counts[a.proxy_id] = (counts[a.proxy_id] || 0) + 1 })
    setAccountCounts(counts)
    setLoading(false)
  }

  async function toggleStatus(p: Proxy) {
    const next = p.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('proxies').update({ status: next }).eq('proxy_id', p.proxy_id)
    if (error) { push(error.message, 'bad'); return }
    push(next === 'active' ? 'Proxy activated.' : 'Proxy deactivated.', 'ok')
    load()
  }

  function remove(p: Proxy) {
    ask('Delete proxy?', `${p.proxy_id} is used by ${accountCounts[p.proxy_id] || 0} account(s). Reassign them first, or they'll be left without a proxy.`, async () => {
      const { error } = await supabase.from('proxies').delete().eq('proxy_id', p.proxy_id)
      if (error) { push(error.message, 'bad'); return }
      push('Proxy deleted.', 'ok')
      load()
    })
  }

  return (
    <div>
      <PageHeader
        title="Proxies"
        subtitle={`${proxies.length} prox${proxies.length !== 1 ? 'ies' : 'y'}`}
        actions={<Button onClick={() => setAddOpen(true)}><Plus size={15} /> Add proxy</Button>}
      />
      <main className="p-8">
        <Card>
          {loading ? <TableSkeleton cols={7} /> : error ? <LoadError message={error} onRetry={load} /> : proxies.length === 0 ? (
            <EmptyState
              icon={<Globe size={28} />}
              title="No proxies"
              hint="Add a proxy before connecting accounts."
              action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Add proxy</Button>}
            />
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
                    <th className="py-2 pr-3">Proxy</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Health</th>
                    <th className="py-2 pr-3">Accounts</th>
                    <th className="py-2 pr-3">Last connected</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {proxies.map(p => {
                    const n = accountCounts[p.proxy_id] || 0
                    return (
                      <tr key={p.proxy_id} className="cursor-pointer border-t" style={{ borderColor: 'var(--border-soft)' }} onClick={() => setDrilldownId(p.proxy_id)}>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium font-mono text-xs">{p.proxy_id}</div>
                          <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{p.host}:{p.port}</div>
                        </td>
                        <td className="py-2.5 pr-3">{p.proxy_type}</td>
                        <td className="py-2.5 pr-3"><Badge value={p.status} /></td>
                        <td className="py-2.5 pr-3"><Badge value={p.health_status} /></td>
                        <td className="py-2.5 pr-3">
                          <span style={{ color: n >= 8 ? 'var(--bad)' : 'var(--text)' }} className="font-mono">{n}</span>
                          {n >= 8 && <span title="8+ accounts on one proxy raises IP-linking risk" style={{ color: 'var(--bad)' }} className="ml-1 inline-block align-middle"><Info size={12} /></span>}
                        </td>
                        <td className="py-2.5 pr-3 text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(p.last_connection_time)}</td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button title="Toggle active" onClick={() => toggleStatus(p)} style={{ color: 'var(--text-muted)' }}><Power size={15} /></button>
                            <button title="Delete" onClick={() => remove(p)} style={{ color: 'var(--bad)' }}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>

      {addOpen && <AddProxyModal existingIds={proxies.map(p => p.proxy_id)} onClose={() => setAddOpen(false)} onDone={load} />}
      {drilldownId && <ProxyDrilldown proxyId={drilldownId} onClose={() => setDrilldownId(null)} />}
      {dialog}
    </div>
  )
}

function AddProxyModal({ existingIds, onClose, onDone }: { existingIds: string[]; onClose: () => void; onDone: () => void }) {
  const { push } = useToast()
  const [form, setForm] = useState({ host: '', port: '', username: '', password: '', proxy_type: 'HTTP', country: '' })
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!form.host.trim() || !form.port.trim()) { push('Host and port are required.', 'bad'); return }
    setBusy(true)
    const proxyId = nextId('proxy', existingIds)
    const { error } = await supabase.from('proxies').insert({
      proxy_id: proxyId, host: form.host.trim(), port: Number(form.port),
      username: form.username || null, password: form.password || null,
      proxy_type: form.proxy_type, country: form.country || null, status: 'active',
    })
    setBusy(false)
    if (error) { push(error.message, 'bad'); return }
    push(`${proxyId} added.`, 'ok')
    onDone()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Add proxy">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Host"><Input value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} /></Field>
        <Field label="Port"><Input type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} /></Field>
        <Field label="Username"><Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></Field>
        <Field label="Password"><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></Field>
        <Field label="Type">
          <Select value={form.proxy_type} onChange={e => setForm(f => ({ ...f, proxy_type: e.target.value }))}>
            <option>HTTP</option><option>SOCKS5</option>
          </Select>
        </Field>
        <Field label="Country"><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></Field>
      </div>
      <Button onClick={submit} loading={busy} disabled={busy}>Add proxy</Button>
    </Modal>
  )
}

function ProxyDrilldown({ proxyId, onClose }: { proxyId: string; onClose: () => void }) {
  const [proxy, setProxy] = useState<Proxy | null>(null)
  const [accounts, setAccounts] = useState<TikTokAccount[]>([])
  const [channels, setChannels] = useState<YouTubeChannel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: p } = await supabase.from('proxies').select('*').eq('proxy_id', proxyId).single()
      const { data: acc } = await supabase.from('tiktok_accounts').select('*').eq('proxy_id', proxyId)
      const accountIds = (acc || []).map(a => a.account_id)
      const { data: ch } = accountIds.length
        ? await supabase.from('youtube_channels').select('*').in('account_id', accountIds)
        : { data: [] as YouTubeChannel[] }
      setProxy(p); setAccounts(acc || []); setChannels(ch || [])
      setLoading(false)
    })()
  }, [proxyId])

  return (
    <Modal open onClose={onClose} title={proxyId} width={620}>
      {loading ? <Spinner /> : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
            <div><div className="text-[10.5px] uppercase" style={{ color: 'var(--text-dim)' }}>Endpoint</div><div className="font-mono text-xs">{proxy?.host}:{proxy?.port}</div></div>
            <div><div className="text-[10.5px] uppercase" style={{ color: 'var(--text-dim)' }}>Health</div><Badge value={proxy?.health_status} /></div>
            <div><div className="text-[10.5px] uppercase" style={{ color: 'var(--text-dim)' }}>Last connected</div><div className="text-xs">{fmtDate(proxy?.last_connection_time)}</div></div>
          </div>

          {accounts.length >= 8 && (
            <div className="mb-4 rounded-lg border px-3 py-2 text-xs" style={{ background: 'var(--bad-soft)', borderColor: 'var(--bad)', color: 'var(--bad)' }}>
              {accounts.length} accounts share this proxy — 8+ raises IP-linking / ban-cascade risk.
            </div>
          )}

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Accounts ({accounts.length})</h3>
          <ul className="mb-4 flex flex-col gap-1.5">
            {accounts.length === 0 && <li className="text-xs" style={{ color: 'var(--text-dim)' }}>None assigned.</li>}
            {accounts.map(a => (
              <li key={a.account_id} className="flex items-center justify-between text-sm">
                <span>{a.username} <span className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>({a.account_id})</span></span>
                <Badge value={a.health_status} />
              </li>
            ))}
          </ul>

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Channels behind this proxy ({channels.length})</h3>
          <ul className="flex flex-col gap-1.5">
            {channels.length === 0 && <li className="text-xs" style={{ color: 'var(--text-dim)' }}>None.</li>}
            {channels.map(c => <li key={c.channel_id} className="text-sm">{c.channel_name || c.channel_id}</li>)}
          </ul>
        </>
      )}
    </Modal>
  )
}
