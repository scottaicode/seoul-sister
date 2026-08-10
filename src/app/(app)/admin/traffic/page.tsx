'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/**
 * /admin/traffic — the honest funnel, for Scott and Bailey.
 *
 * Answers one question: are the videos producing real conversations with Yuri?
 *
 * GA4 users/pageviews are deliberately NOT shown. That number is bot-inflated
 * (120 of 265 "active users" from Singapore datacenters on Aug 10 2026), and
 * showing it next to a small conversation count would tell Bailey the site is
 * failing to convert traffic that was never human. The GA4 panel here is
 * SESSIONS BY SOURCE only — a crawler doesn't append utm_source=tiktok.
 */

interface TrafficData {
  totals: {
    last7: { conversations: number; messages: number; emails: number; conversions: number }
    last30: { conversations: number; messages: number; emails: number; conversions: number }
  }
  daily: Array<{ day: string; conversations: number; messages: number }>
  bySource: Array<{ source: string; conversations: number; messages: number; avgMessages: number }>
  depth: { oneMessage: number; twoToThree: number; fourPlus: number }
  recent: Array<{
    visitor_id: string
    first_seen_at: string
    messages: number
    source: string
    email: boolean
    converted: boolean
  }>
  ga4: {
    status: 'ok' | 'not_configured' | 'error'
    sources?: Array<{ source: string; sessions: number }>
    message?: string
  }
}

const SOURCE_LABEL: Record<string, string> = {
  tiktok: 'TikTok (bio link)',
  landing: 'Direct / untagged',
  product: 'Product page',
  blog: 'Blog',
  ingredient_cta: 'Ingredient page',
  best_cta: 'Best-of page',
  products_cta: 'Products page',
  category: 'Category page',
  taaft: 'There’s An AI For That',
  taaft_feat: 'TAAFT (featured)',
  instagram: 'Instagram (bio link)',
  ai_assistant: 'AI assistant citation',
}

function labelSource(s: string): string {
  if (SOURCE_LABEL[s]) return SOURCE_LABEL[s]
  if (s.startsWith('ref_')) return `Referral: ${s.slice(4).replace(/_/g, '.')}`
  return s
}

export default function AdminTrafficPage() {
  const { user, loading: authLoading } = useAuth()
  const [accessDenied, setAccessDenied] = useState(false)
  const [data, setData] = useState<TrafficData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    async function check() {
      const { data: profile } = await supabase
        .from('ss_user_profiles')
        .select('is_admin')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (profile?.is_admin !== true) setAccessDenied(true)
    }
    check()
  }, [user, authLoading])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/traffic', {
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load traffic data')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && user && !accessDenied) fetchData()
  }, [authLoading, user, accessDenied, fetchData])

  if (authLoading) {
    return <div className="p-8 text-center text-gray-500">Loading…</div>
  }
  if (!user || accessDenied) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Not available</h1>
        <p className="mt-2 text-gray-600">This page is limited to Seoul Sister admins.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-rose-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    )
  }

  const maxDaily = Math.max(1, ...(data?.daily || []).map((d) => d.conversations))
  const tiktokSessions =
    data?.ga4.status === 'ok'
      ? data.ga4.sources?.find((s) => s.source.toLowerCase() === 'tiktok')?.sessions
      : undefined
  const tiktokConversations =
    data?.bySource.find((s) => s.source === 'tiktok')?.conversations ?? 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Traffic &amp; Yuri conversations</h1>
          <p className="mt-1 text-sm text-gray-600">
            Real humans who talked to Yuri. A row exists only when someone actually sends a
            message, so these numbers can&apos;t be inflated by bots.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {loading && <div className="py-12 text-center text-gray-500">Loading…</div>}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Conversations', v7: data.totals.last7.conversations, v30: data.totals.last30.conversations },
              { label: 'Messages', v7: data.totals.last7.messages, v30: data.totals.last30.messages },
              { label: 'Emails captured', v7: data.totals.last7.emails, v30: data.totals.last30.emails },
              { label: 'Subscribed', v7: data.totals.last7.conversions, v30: data.totals.last30.conversions },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">{s.label}</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">{s.v7}</div>
                <div className="text-xs text-gray-500">last 7 days · {s.v30} in 30</div>
              </div>
            ))}
          </div>

          {/* TikTok click-through, only when GA4 is wired up */}
          {tiktokSessions !== undefined && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">TikTok: clicks → conversations</h2>
              <p className="mt-2 text-sm text-gray-700">
                <span className="font-semibold">{tiktokSessions}</span> sessions arrived from the
                bio link in the last 7 days.{' '}
                <span className="font-semibold">{tiktokConversations}</span> of them talked to Yuri.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Approximate — GA4 counts sessions and we count conversations, and the two systems
                identify people differently. Use it for direction, not as a precise rate.
              </p>
            </div>
          )}

          {/* Conversations per day */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Conversations per day (30 days)</h2>
            {data.daily.length === 0 ? (
              <p className="text-sm text-gray-500">No conversations yet in this window.</p>
            ) : (
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {data.daily.map((d) => (
                  <div key={d.day} className="group relative flex-1" title={`${d.day}: ${d.conversations}`}>
                    <div
                      className="w-full rounded-t bg-rose-400 transition-colors group-hover:bg-rose-500"
                      style={{ height: `${(d.conversations / maxDaily) * 100}px`, minHeight: 2 }}
                    />
                  </div>
                ))}
              </div>
            )}
            {data.daily.length > 0 && (
              <div className="mt-1 flex justify-between text-xs text-gray-400">
                <span>{data.daily[0].day}</span>
                <span>{data.daily[data.daily.length - 1].day}</span>
              </div>
            )}
          </div>

          {/* Where they came from */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Where the conversations came from (30 days)
            </h2>
            {data.bySource.length === 0 ? (
              <p className="text-sm text-gray-500">No tagged conversations yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-2">Source</th>
                    <th className="pb-2 text-right">Conversations</th>
                    <th className="pb-2 text-right">Avg messages</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bySource.map((s) => (
                    <tr key={s.source} className="border-t border-gray-100">
                      <td className="py-2 text-gray-900">{labelSource(s.source)}</td>
                      <td className="py-2 text-right font-medium text-gray-900">{s.conversations}</td>
                      <td className="py-2 text-right text-gray-600">{s.avgMessages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Depth */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">How deep the conversations went</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-semibold text-gray-900">{data.depth.oneMessage}</div>
                <div className="text-xs text-gray-500">1 message (bounce)</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-gray-900">{data.depth.twoToThree}</div>
                <div className="text-xs text-gray-500">2–3 messages</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-gray-900">{data.depth.fourPlus}</div>
                <div className="text-xs text-gray-500">4+ (real conversation)</div>
              </div>
            </div>
          </div>

          {/* GA4 source panel */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-1 text-sm font-semibold text-gray-900">
              Landing sessions by source (GA4, 7 days)
            </h2>
            <p className="mb-3 text-xs text-gray-500">
              People who reached the site. Only tagged sources are shown — GA4 user and pageview
              totals are excluded on purpose because they include heavy bot traffic.
            </p>
            {data.ga4.status === 'not_configured' && (
              <p className="text-sm text-gray-500">
                Not connected yet. Needs the Google Analytics Data API enabled and{' '}
                <code className="rounded bg-gray-100 px-1">GA4_PROPERTY_ID</code> set.
              </p>
            )}
            {data.ga4.status === 'error' && (
              <p className="text-sm text-amber-700">GA4 request failed: {data.ga4.message}</p>
            )}
            {data.ga4.status === 'ok' && (
              <table className="w-full text-sm">
                <tbody>
                  {(data.ga4.sources || []).map((s) => (
                    <tr key={s.source} className="border-t border-gray-100">
                      <td className="py-2 text-gray-900">{s.source}</td>
                      <td className="py-2 text-right font-medium text-gray-900">{s.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent conversations */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Recent conversations</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-2">When</th>
                  <th className="pb-2">Source</th>
                  <th className="pb-2 text-right">Messages</th>
                  <th className="pb-2 text-right">Email</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.visitor_id} className="border-t border-gray-100">
                    <td className="py-2 text-gray-700">
                      {new Date(r.first_seen_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 text-gray-700">{labelSource(r.source)}</td>
                    <td className="py-2 text-right font-medium text-gray-900">{r.messages}</td>
                    <td className="py-2 text-right">
                      {r.converted ? '💳' : r.email ? '✉️' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="pb-4 text-xs text-gray-400">
            Conversation counts come from Seoul Sister&apos;s own database. TikTok view counts live
            in TikTok analytics — they aren&apos;t shown here.
          </p>
        </div>
      )}
    </div>
  )
}
