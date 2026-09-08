import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { Card, TableSkeleton, LoadError, EmptyState, Pagination } from '../components/ui'
import { fmtDuration } from '../lib/helpers'

const PAGE_SIZE = 15

interface PipelineVideoRow {
  youtubeVideoId: string
  youtubeUrl: string | null
  detectToQueueMin: number | null
  queueToUploadMin: number | null
  totalMin: number | null
}

export default function PipelineTimes() {
  const [rows, setRows] = useState<PipelineVideoRow[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [page])

  async function load() {
    setLoading(true)
    const from = (page - 1) * PAGE_SIZE

    // upload_queue and processed_videos aren't PostgREST-embeddable (no FK relationship
    // configured between them), so — same as elsewhere in this app (see Proxies.tsx) —
    // we fetch the queue page first, then fetch only the processed_videos rows it
    // references, and join client-side.
    const { data: jobs, count: jobCount, error: qErr } = await supabase
      .from('upload_queue')
      .select('youtube_video_id, youtube_url, created_at, completed_at', { count: 'exact' })
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (qErr) {
      setError(qErr.message || 'Could not load pipeline times.')
      setLoading(false)
      return
    }
    setError(null)
    setCount(jobCount || 0)

    const videoIds = Array.from(new Set((jobs || []).map(j => j.youtube_video_id).filter(Boolean)))
    let processedAtByVideo = new Map<string, string>()
    if (videoIds.length > 0) {
      const { data: videos } = await supabase
        .from('processed_videos')
        .select('youtube_video_id, processed_at')
        .in('youtube_video_id', videoIds)
      processedAtByVideo = new Map((videos || []).map(v => [v.youtube_video_id, v.processed_at]))
    }

    setRows((jobs || []).map(j => {
      const processedAt = processedAtByVideo.get(j.youtube_video_id)
      const p = processedAt ? new Date(processedAt).getTime() : NaN
      const c = j.created_at ? new Date(j.created_at).getTime() : NaN
      const d = j.completed_at ? new Date(j.completed_at).getTime() : NaN
      return {
        youtubeVideoId: j.youtube_video_id,
        youtubeUrl: j.youtube_url,
        detectToQueueMin: !Number.isNaN(p) && !Number.isNaN(c) ? (c - p) / 60000 : null,
        queueToUploadMin: !Number.isNaN(c) && !Number.isNaN(d) ? (d - c) / 60000 : null,
        totalMin: !Number.isNaN(p) && !Number.isNaN(d) ? (d - p) / 60000 : null,
      }
    }))

    setLoading(false)
  }

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const pageTotals = rows.map(r => r.totalMin).filter((n): n is number => n != null)
  const pageAvgTotal = pageTotals.length ? pageTotals.reduce((a, b) => a + b, 0) / pageTotals.length : null

  return (
    <div>
      <PageHeader
        title="Pipeline Time per Video"
        subtitle={`${count} completed upload${count !== 1 ? 's' : ''}`}
      />
      {/* pb-24 clears the floating chat launcher so bottom pagination stays reachable */}
      <main className="p-4 pb-24 sm:p-8">
        <Card>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Detect → Queue → Upload, per video</h3>
            {pageAvgTotal != null && (
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Avg total (this page):{' '}
                <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>
                  {fmtDuration(pageAvgTotal)}
                </span>
              </span>
            )}
          </div>

          {loading && rows.length === 0 ? <TableSkeleton cols={4} /> : error ? <LoadError message={error} onRetry={load} /> : rows.length === 0 ? (
            <EmptyState
              icon={<Timer size={28} />}
              title="No completed uploads yet"
              hint="Per-video pipeline times will appear here once uploads complete."
            />
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
                    <th className="py-2 pr-3">Video</th>
                    <th className="py-2 pr-3">Detect → Queue</th>
                    <th className="py-2 pr-3">Queue → Upload</th>
                    <th className="py-2 pr-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.youtubeVideoId} className="border-t" style={{ borderColor: 'var(--border-soft)' }}>
                      <td className="py-2.5 pr-3">
                        {r.youtubeUrl ? (
                          <a
                            href={r.youtubeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs"
                            style={{ color: 'var(--accent)' }}
                          >
                            {r.youtubeVideoId}
                          </a>
                        ) : (
                          <span className="font-mono text-xs">{r.youtubeVideoId}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs">{fmtDuration(r.detectToQueueMin)}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs">{fmtDuration(r.queueToUploadMin)}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs font-semibold">{fmtDuration(r.totalMin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </Card>
      </main>
    </div>
  )
}
