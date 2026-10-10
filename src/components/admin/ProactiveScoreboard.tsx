'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Tally {
  judged: number
  silent: number
  failed: number
  blocked: number
  spoke: number
  sent: number
  graded: number
  engaged: number
  converted: number
  unsubscribed: number
  no_response: number
  undelivered: number
  engaged_or_converted_pct: number | null
  unsubscribe_pct: number | null
  retained_30d?: number
  retention_checked?: number
}

interface FunnelRow {
  source: string
  content: string | null
  landed: number
  chatted: number
  emailed: number
  paid: number
  pastDay10: number
  survivedDay10: number
}

interface Scoreboard {
  lastRun: { status: string; at: string; mode: string | null } | null
  leads: Tally & { kill_line_pct: number; window_days: number }
  subscribers: Tally & { window_days: number }
  paidSurvival: { cohort_past_day10: number; still_active: number }
  campaigns: FunnelRow[]
  errors: string[]
}

const pct = (v: number | null) => (v === null ? 'n/a' : `${v}%`)

/**
 * "Yuri reaches out first" kill-test scoreboard (/api/admin/proactive).
 * Data display only: no recommendations, no Yuri-authored copy.
 */
export function ProactiveScoreboard() {
  const [data, setData] = useState<Scoreboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: s } = await supabase.auth.getSession()
        const res = await fetch('/api/admin/proactive', {
          headers: { Authorization: `Bearer ${s.session?.access_token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setData(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'failed to load')
      }
    }
    load()
  }, [])

  if (error) return <div className="dark-card p-5 text-sm text-red-400">Proactive scoreboard failed to load: {error}</div>
  if (!data) return null

  const { leads, subscribers } = data
  const leadBelowKill = leads.engaged_or_converted_pct !== null && leads.engaged_or_converted_pct < leads.kill_line_pct

  return (
    <div className="dark-card p-5 border border-gold/20">
      <h3 className="text-sm font-semibold text-gold mb-1">Yuri reaches out first: 30-day kill test</h3>
      <p className="text-xs text-white/50 mb-4">
        Last run:{' '}
        {data.lastRun
          ? `${new Date(data.lastRun.at).toLocaleString()} (${data.lastRun.status}, mode ${data.lastRun.mode ?? 'unknown'})`
          : 'never (the cron has not produced a run row)'}
      </p>
      {data.errors.length > 0 && (
        <p className="text-xs text-red-400 mb-3">Query errors, numbers below are incomplete: {data.errors.join('; ')}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60 mb-2">Leads (one email each, ever)</p>
          <ul className="text-sm space-y-1 text-white/80">
            <li>Judged {leads.judged} · silent {leads.silent} · emailed {leads.sent} · blocked by guard {leads.blocked} · failed {leads.failed}</li>
            <li>Graded {leads.graded}: restarted chat {leads.engaged} · paid {leads.converted} · unsubscribed {leads.unsubscribed} · undelivered {leads.undelivered}</li>
            <li className={leadBelowKill ? 'text-red-400' : ''}>
              Restart rate {pct(leads.engaged_or_converted_pct)} (kill line {leads.kill_line_pct}% at {leads.window_days} days)
            </li>
            <li>Unsubscribe rate {pct(leads.unsubscribe_pct)}</li>
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60 mb-2">Subscriber check-ins</p>
          <ul className="text-sm space-y-1 text-white/80">
            <li>Judged {subscribers.judged} · silent {subscribers.silent} · sent {subscribers.sent} · blocked by guard {subscribers.blocked} · failed {subscribers.failed}</li>
            <li>Reply rate ({subscribers.window_days}d) {pct(subscribers.engaged_or_converted_pct)} · unsubscribe {pct(subscribers.unsubscribe_pct)}</li>
            <li>Still subscribed 30d after a check-in: {subscribers.retained_30d ?? 0} of {subscribers.retention_checked ?? 0} checked</li>
            <li>
              Paid subscriptions past day 10: {data.paidSurvival.still_active} of {data.paidSurvival.cohort_past_day10} still active
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-wide text-white/60 mb-2">By source and video (first touch, outcome not views)</p>
        {data.campaigns.length === 0 ? (
          <p className="text-sm text-white/50">No attributed landings recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white/80">
              <thead>
                <tr className="text-left text-xs text-white/50">
                  <th className="py-1 pr-3">Source</th>
                  <th className="py-1 pr-3">Video / content</th>
                  <th className="py-1 pr-3">Landed</th>
                  <th className="py-1 pr-3">Chatted</th>
                  <th className="py-1 pr-3">Email</th>
                  <th className="py-1 pr-3">Paid</th>
                  <th className="py-1">Past day 10</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c) => (
                  <tr key={`${c.source}|${c.content ?? ''}`} className="border-t border-white/5">
                    <td className="py-1 pr-3">{c.source}</td>
                    <td className="py-1 pr-3">{c.content ?? '-'}</td>
                    <td className="py-1 pr-3">{c.landed}</td>
                    <td className="py-1 pr-3">{c.chatted}</td>
                    <td className="py-1 pr-3">{c.emailed}</td>
                    <td className="py-1 pr-3">{c.paid}</td>
                    <td className="py-1">{c.pastDay10 ? `${c.survivedDay10} of ${c.pastDay10}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
