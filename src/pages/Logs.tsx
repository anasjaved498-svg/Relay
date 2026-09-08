import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { Card, Badge, Select, TableSkeleton, LoadError, EmptyState, PaginationBar, Button } from '../components/ui'
import { fmtDate, timeAgo } from '../lib/helpers'
import type { SystemLog } from '../lib/types'

const LEVELS = ['info', 'warn', 'error']
const CATEGORIES = ['monitor', 'download', 'upload', 'proxy', 'account']

export default function Logs() {
  const [rows, setRows] = useState<SystemLog[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [level, setLevel] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [page, pageSize, level, category])

  function changePageSize(n: number) {
    setPage(1)
    setPageSize(n)
  }

  async function load() {
    setLoading(true)
    const from = (page - 1) * pageSize
    let q = supabase.from('system_logs').select('*', { count: 'exact' }).order('log_ts', { ascending: false }).range(from, from + pageSize - 1)
    if (level) q = q.eq('level', level)
    if (category) q = q.eq('category', category)
    const { data, count, error } = await q
    if (error) { setError(error.message); setLoading(false); return }
    setError(null)
    setRows(data || [])
    setCount(count || 0)
    setLoading(false)
  }

  const filtersActive = !!(level || category)
  function clearFilters() { setPage(1); setLevel(''); setCategory('') }

  const pageCount = Math.max(1, Math.ceil(count / pageSize))

  return (
    <div>
      <PageHeader
        title="Logs"
        subtitle={`${count} entries`}
        actions={
          <div className="flex gap-2">
            <Select value={level} onChange={e => { setPage(1); setLevel(e.target.value) }} className="!w-32">
              <option value="">All levels</option>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </Select>
            <Select value={category} onChange={e => { setPage(1); setCategory(e.target.value) }} className="!w-36">
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        }
      />
      <main className="p-8 pb-24">
        <Card>
          {loading ? <TableSkeleton cols={5} /> : error ? <LoadError message={error} onRetry={load} /> : rows.length === 0 ? (
            <EmptyState
              icon={<FileText size={28} />}
              title={filtersActive ? 'No log entries match your filters' : 'No log entries'}
              hint={filtersActive ? 'Try a different level or category.' : 'Activity will show up here once the system starts logging.'}
              action={filtersActive ? <Button size="sm" variant="subtle" onClick={clearFilters}>Clear filters</Button> : undefined}
            />
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Level</th>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 pr-3">Account</th>
                    <th className="py-2 pr-3">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(l => (
                    <tr key={l.id} className="border-t" style={{ borderColor: 'var(--border-soft)' }}>
                      <td className="py-2 pr-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }} title={fmtDate(l.log_ts)}>{timeAgo(l.log_ts)}</td>
                      <td className="py-2 pr-3"><Badge value={l.level} /></td>
                      <td className="py-2 pr-3 font-mono text-xs">{l.category}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{l.account_id || '—'}</td>
                      <td className="py-2 pr-3 text-xs">{l.message || l.error_message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PaginationBar
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={changePageSize}
          />
        </Card>
      </main>
    </div>
  )
}
