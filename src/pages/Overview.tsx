import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { Card, Spinner, LoadError } from '../components/ui'
import { startOfTodayISO } from '../lib/helpers'

interface Stats {
  accountsTotal: number; accountsActive: number
  channelsTotal: number
  proxiesTotal: number; proxiesActive: number; proxiesUnhealthy: number
  uploadedToday: number
  queueByStatus: Record<string, number>
  healthByStatus: Record<string, number>
}

type Tone = 'good' | 'warn' | 'bad' | 'neutral'
const TONE_COLOR: Record<Tone, string> = {
  good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', neutral: 'var(--text)',
}
function thresholdTone(n: number, warnAt: number, badAt: number): Tone {
  if (n >= badAt) return 'bad'
  if (n >= warnAt) return 'warn'
  return 'good'
}
function ratioTone(active: number, total: number): Tone {
  if (total === 0) return 'neutral'
  const ratio = active / total
  if (ratio >= 0.9) return 'good'
  if (ratio >= 0.6) return 'warn'
  return 'bad'
}

const QUEUE_STATUSES = ['queued', 'processing', 'uploading', 'retrying', 'completed', 'failed', 'cancelled']
const HEALTH_STATUSES = ['healthy', 'warning', 'restricted', 'banned']

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [chartData, setChartData] = useState<{ day: string; uploads: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [accountsTotal, accountsActive, channelsTotal, proxiesTotal, proxiesActive, proxiesUnhealthy, uploadedToday] = await Promise.all([
      supabase.from('tiktok_accounts').select('id', { count: 'exact', head: true }),
      supabase.from('tiktok_accounts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('youtube_channels').select('id', { count: 'exact', head: true }),
      supabase.from('proxies').select('id', { count: 'exact', head: true }),
      supabase.from('proxies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('proxies').select('id', { count: 'exact', head: true }).neq('health_status', 'healthy'),
      supabase.from('upload_queue').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', startOfTodayISO()),
    ])

    const firstError = [accountsTotal, accountsActive, channelsTotal, proxiesTotal, proxiesActive, proxiesUnhealthy, uploadedToday]
      .find(r => r.error)?.error
    if (firstError) {
      setError(firstError.message || 'Could not load overview stats.')
      setLoading(false)
      return
    }
    setError(null)

    const queueByStatus: Record<string, number> = {}
    await Promise.all(QUEUE_STATUSES.map(async s => {
      const { count } = await supabase.from('upload_queue').select('id', { count: 'exact', head: true }).eq('status', s)
      queueByStatus[s] = count || 0
    }))

    const healthByStatus: Record<string, number> = {}
    await Promise.all(HEALTH_STATUSES.map(async s => {
      const { count } = await supabase.from('tiktok_accounts').select('id', { count: 'exact', head: true }).eq('health_status', s)
      healthByStatus[s] = count || 0
    }))

    setStats({
      accountsTotal: accountsTotal.count || 0,
      accountsActive: accountsActive.count || 0,
      channelsTotal: channelsTotal.count || 0,
      proxiesTotal: proxiesTotal.count || 0,
      proxiesActive: proxiesActive.count || 0,
      proxiesUnhealthy: proxiesUnhealthy.count || 0,
      uploadedToday: uploadedToday.count || 0,
      queueByStatus,
      healthByStatus,
    })

    // Uploads over time (last 14 days) from upload_history
    const since = new Date()
    since.setDate(since.getDate() - 13)
    since.setHours(0, 0, 0, 0)
    const { data: hist } = await supabase
      .from('upload_history')
      .select('recorded_at')
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: true })

    const buckets: Record<string, number> = {}
    for (let i = 0; i < 14; i++) {
      const d = new Date(since); d.setDate(d.getDate() + i)
      buckets[d.toISOString().slice(0, 10)] = 0
    }
    ;(hist || []).forEach(row => {
      const key = row.recorded_at.slice(0, 10)
      if (key in buckets) buckets[key] += 1
    })
    setChartData(Object.entries(buckets).map(([day, uploads]) => ({
      day: day.slice(5), uploads,
    })))

    setLoading(false)
  }

  if (error) return (
    <div>
      <PageHeader title="Overview" subtitle="Fleet health and pipeline throughput at a glance." />
      <main className="p-8"><Card><LoadError message={error} onRetry={load} /></Card></main>
    </div>
  )
  if (loading || !stats) return <div><PageHeader title="Overview" /><Spinner /></div>

  const cards: { n: number | string; l: string; tone: Tone }[] = [
    { n: stats.uploadedToday, l: 'Uploads today', tone: stats.uploadedToday > 0 ? 'good' : 'neutral' },
    { n: `${stats.accountsActive}/${stats.accountsTotal}`, l: 'Active accounts', tone: ratioTone(stats.accountsActive, stats.accountsTotal) },
    { n: stats.queueByStatus.failed, l: 'Failed jobs', tone: thresholdTone(stats.queueByStatus.failed, 1, 3) },
    { n: stats.proxiesUnhealthy, l: 'Unhealthy proxies', tone: thresholdTone(stats.proxiesUnhealthy, 1, 3) },
    { n: `${stats.proxiesActive}/${stats.proxiesTotal}`, l: 'Proxies active', tone: ratioTone(stats.proxiesActive, stats.proxiesTotal) },
    { n: stats.channelsTotal, l: 'Channels watched', tone: 'neutral' },
    { n: stats.queueByStatus.queued + stats.queueByStatus.processing + stats.queueByStatus.uploading + stats.queueByStatus.retrying, l: 'Pending in queue', tone: 'neutral' },
  ]

  return (
    <div>
      <PageHeader title="Overview" subtitle="Fleet health and pipeline throughput at a glance." />
      <main className="p-8">
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {cards.map((c, i) => (
            <Card key={i}>
              <div className="font-display text-2xl font-bold" style={{ color: TONE_COLOR[c.tone] }}>
                {c.n}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{c.l}</div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold">Uploads — last 14 days</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
                <XAxis dataKey="day" stroke="var(--text-dim)" fontSize={11} />
                <YAxis stroke="var(--text-dim)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="uploads" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-semibold">Account health</h3>
            <div className="flex flex-col gap-3">
              {HEALTH_STATUSES.map(h => (
                <div key={h} className="flex items-center justify-between text-sm">
                  <span className="capitalize" style={{ color: 'var(--text-muted)' }}>{h}</span>
                  <span className="font-mono font-semibold">{stats.healthByStatus[h] || 0}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
