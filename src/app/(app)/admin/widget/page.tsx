'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  MessageCircle, Users, BarChart3, ChevronLeft, ChevronRight,
  ArrowLeft, Eye, Signal, Clock, Bot, Sparkles,
} from 'lucide-react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Analytics {
  overview: {
    total_visitors: number
    total_sessions: number
    total_messages: number
    returning_visitors: number
    returning_pct: number
  }
  funnel: { visitors: number; sent_message: number; multi_message: number; high_engagement: number }
  top_signals: Array<{ signal_type: string; count: number }>
  top_specialists: Array<{ specialist: string; count: number }>
  recent_visitors: Array<{
    visitor_id: string
    total_messages: number
    total_sessions: number
    total_tool_calls: number
    first_seen_at: string
    last_seen_at: string
    ai_memory: Record<string, unknown> | null
  }>
}

interface SessionRow {
  id: string
  visitor_id: string
  session_number: number
  started_at: string
  last_message_at: string
  message_count: number
  tool_calls_count: number
  specialist_domains_detected: string[]
  intent_signals_detected: string[]
  visitor?: {
    total_messages: number
    total_sessions: number
    ai_memory: Record<string, unknown> | null
  } | null
}

interface MessageRow {
  id: string
  role: 'user' | 'assistant'
  content: string
  tool_calls: Array<{ name: string; input: Record<string, unknown>; result_summary: string }> | null
  specialist_detected: string | null
  intent_signals: string[]
  created_at: string
}

interface SessionDetail {
  session: SessionRow
  messages: MessageRow[]
  visitor: Record<string, unknown> | null
  signals: Array<{ signal_type: string; signal_data: Record<string, unknown>; created_at: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

const SIGNAL_LABELS: Record<string, string> = {
  described_skin_type: 'Skin Type',
  described_skin_concern: 'Skin Concern',
  mentioned_current_routine: 'Current Routine',
  mentioned_skin_reaction: 'Skin Reaction',
  asked_about_specific_product: 'Product Interest',
  asked_product_comparison: 'Comparison',
  asked_product_price: 'Price Check',
  asked_for_recommendation: 'Wants Rec',
  asked_about_authenticity: 'Authenticity',
  asked_where_to_buy: 'Where to Buy',
  asked_about_subscription: 'Subscription',
  deep_routine_question: 'Deep Routine',
  multiple_product_questions: 'Multi-Product',
  returned_visitor: 'Returning',
  long_conversation: 'Long Convo',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminWidgetPage() {
  const { user, loading: authLoading } = useAuth()
  const [accessDenied, setAccessDenied] = useState(false)
  const [tab, setTab] = useState<'analytics' | 'conversations'>('analytics')

  // Analytics
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  // Conversations list
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Conversation detail
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Check admin
  useEffect(() => {
    if (authLoading || !user) return
    async function check() {
      const { data } = await supabase
        .from('ss_user_profiles')
        .select('is_admin')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (data?.is_admin !== true) setAccessDenied(true)
    }
    check()
  }, [user, authLoading])

  // Fetch helpers
  const getAuthHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${data.session?.access_token}` }
  }, [])

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/admin/widget/analytics', { headers })
      if (!res.ok) throw new Error('Failed')
      setAnalytics(await res.json())
    } catch { /* ignore */ }
    setAnalyticsLoading(false)
  }, [getAuthHeaders])

  const fetchSessions = useCallback(async (p: number) => {
    setSessionsLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/admin/widget/conversations?page=${p}&limit=15`, { headers })
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setSessions(json.sessions)
      setTotalPages(json.pagination.totalPages)
    } catch { /* ignore */ }
    setSessionsLoading(false)
  }, [getAuthHeaders])

  const fetchDetail = useCallback(async (sessionId: string) => {
    setDetailLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/admin/widget/conversations/${sessionId}`, { headers })
      if (!res.ok) throw new Error('Failed')
      setDetail(await res.json())
    } catch { /* ignore */ }
    setDetailLoading(false)
  }, [getAuthHeaders])

  // Initial load
  useEffect(() => {
    if (authLoading || accessDenied) return
    if (tab === 'analytics') fetchAnalytics()
    if (tab === 'conversations') fetchSessions(page)
  }, [tab, page, authLoading, accessDenied, fetchAnalytics, fetchSessions])

  if (authLoading) return <div className="p-8 text-white/50">Loading...</div>
  if (accessDenied) return <div className="p-8 text-rose-400">Admin access required.</div>

  // ---------------------------------------------------------------------------
  // Detail View
  // ---------------------------------------------------------------------------
  if (detail) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => setDetail(null)}
          className="flex items-center gap-1 text-sm text-white/50 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to conversations
        </button>

        <div className="dark-card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">
              Session {shortId(detail.session.id)}
            </h2>
            <span className="text-xs text-white/40">
              {new Date(detail.session.started_at).toLocaleString()}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-white/50">
            <span>Visitor: {shortId(detail.session.visitor_id)}</span>
            <span>{detail.messages.length} messages</span>
            <span>{detail.session.tool_calls_count} tool calls</span>
            {detail.session.specialist_domains_detected.length > 0 && (
              <span>Specialists: {detail.session.specialist_domains_detected.join(', ')}</span>
            )}
          </div>
          {detail.session.intent_signals_detected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {detail.session.intent_signals_detected.map((s) => (
                <span key={s} className="px-2 py-0.5 rounded-full bg-gold/10 text-gold text-[10px]">
                  {SIGNAL_LABELS[s] || s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* AI Memory */}
        {detail.visitor && !!(detail.visitor as Record<string, unknown>).ai_memory && (
          <div className="dark-card p-4 mb-4">
            <h3 className="text-sm font-semibold text-gold mb-2 flex items-center gap-1.5">
              <Bot className="w-4 h-4" /> AI Memory
            </h3>
            <pre className="text-xs text-white/60 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify((detail.visitor as Record<string, unknown>).ai_memory, null, 2)}
            </pre>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-3">
          {detailLoading && <p className="text-white/40 text-sm">Loading...</p>}
          {detail.messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl p-4 ${
                msg.role === 'user'
                  ? 'bg-gold/10 border border-gold/20 ml-8'
                  : 'bg-white/5 border border-white/10 mr-8'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold ${msg.role === 'user' ? 'text-gold' : 'text-white/70'}`}>
                  {msg.role === 'user' ? 'Visitor' : 'Yuri'}
                </span>
                <span className="text-[10px] text-white/30">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </span>
                {msg.specialist_detected && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px]">
                    {msg.specialist_detected}
                  </span>
                )}
              </div>
              <p className="text-sm text-white/80 whitespace-pre-wrap">{msg.content}</p>
              {msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.tool_calls.map((tc, i) => (
                    <div key={i} className="text-[11px] bg-black/20 rounded p-2">
                      <span className="text-sky-400 font-mono">{tc.name}</span>
                      <span className="text-white/30 ml-2">
                        {JSON.stringify(tc.input).slice(0, 80)}
                      </span>
                      <p className="text-white/40 mt-0.5 truncate">{tc.result_summary}</p>
                    </div>
                  ))}
                </div>
              )}
              {msg.intent_signals && msg.intent_signals.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {msg.intent_signals.map((s) => (
                    <span key={s} className="px-1.5 py-0.5 rounded-full bg-gold/10 text-gold text-[10px]">
                      {SIGNAL_LABELS[s] || s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main View (Tabs)
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Widget Intelligence</h1>
          <p className="text-sm text-white/40">Anonymous Yuri conversations, signals, and visitor insights</p>
        </div>
        <Link
          href="/admin/pipeline"
          className="text-xs text-white/40 hover:text-white/60"
        >
          Pipeline Dashboard →
        </Link>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 w-fit">
        {(['analytics', 'conversations'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); if (t === 'conversations') fetchSessions(1) }}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === t ? 'bg-gold/20 text-gold font-medium' : 'text-white/50 hover:text-white/70'
            }`}
          >
            {t === 'analytics' ? (
              <span className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> Analytics</span>
            ) : (
              <span className="flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> Conversations</span>
            )}
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Analytics Tab */}
      {/* ----------------------------------------------------------------- */}
      {tab === 'analytics' && (
        <>
          {analyticsLoading ? (
            <p className="text-white/40">Loading analytics...</p>
          ) : analytics ? (
            <div className="space-y-6">
              {/* Overview cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Visitors', value: analytics.overview.total_visitors, icon: Users },
                  { label: 'Sessions', value: analytics.overview.total_sessions, icon: MessageCircle },
                  { label: 'Messages', value: analytics.overview.total_messages, icon: Sparkles },
                  { label: 'Returning', value: `${analytics.overview.returning_pct}%`, icon: Clock },
                  { label: 'Returning #', value: analytics.overview.returning_visitors, icon: Users },
                ].map((card) => (
                  <div key={card.label} className="dark-card p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <card.icon className="w-4 h-4 text-gold/60" />
                      <span className="text-xs text-white/40">{card.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Top Signals + Specialists */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="dark-card p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
                    <Signal className="w-4 h-4 text-gold" /> Top Intent Signals
                  </h3>
                  {analytics.top_signals.length === 0 ? (
                    <p className="text-xs text-white/30">No signals yet</p>
                  ) : (
                    <div className="space-y-2">
                      {analytics.top_signals.slice(0, 10).map((s) => (
                        <div key={s.signal_type} className="flex items-center justify-between">
                          <span className="text-xs text-white/60">
                            {SIGNAL_LABELS[s.signal_type] || s.signal_type}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 rounded bg-white/5 overflow-hidden">
                              <div
                                className="h-full bg-gold/60 rounded"
                                style={{
                                  width: `${Math.min(100, (s.count / Math.max(1, analytics.top_signals[0]?.count)) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-white/40 w-8 text-right">{s.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="dark-card p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-gold" /> Specialist Domains Triggered
                  </h3>
                  {analytics.top_specialists.length === 0 ? (
                    <p className="text-xs text-white/30">No specialist triggers yet</p>
                  ) : (
                    <div className="space-y-2">
                      {analytics.top_specialists.map((s) => (
                        <div key={s.specialist} className="flex items-center justify-between">
                          <span className="text-xs text-white/60 capitalize">{s.specialist.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-white/40">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Visitors */}
              <div className="dark-card p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Recent Visitors (7d)</h3>
                {analytics.recent_visitors.length === 0 ? (
                  <p className="text-xs text-white/30">No visitors in the last 7 days</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-white/30 border-b border-white/5">
                          <th className="text-left py-2 pr-3">Visitor</th>
                          <th className="text-right py-2 px-2">Msgs</th>
                          <th className="text-right py-2 px-2">Sessions</th>
                          <th className="text-right py-2 px-2">Tools</th>
                          <th className="text-right py-2 px-2">First Seen</th>
                          <th className="text-right py-2 pl-2">Last Seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.recent_visitors.map((v) => (
                          <tr key={v.visitor_id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-2 pr-3 text-white/60 font-mono">{shortId(v.visitor_id)}</td>
                            <td className="text-right py-2 px-2 text-white/50">{v.total_messages}</td>
                            <td className="text-right py-2 px-2 text-white/50">{v.total_sessions}</td>
                            <td className="text-right py-2 px-2 text-white/50">{v.total_tool_calls}</td>
                            <td className="text-right py-2 px-2 text-white/30">{timeAgo(v.first_seen_at)}</td>
                            <td className="text-right py-2 pl-2 text-white/30">{timeAgo(v.last_seen_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-white/40">Failed to load analytics.</p>
          )}
        </>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Conversations Tab */}
      {/* ----------------------------------------------------------------- */}
      {tab === 'conversations' && (
        <>
          {sessionsLoading ? (
            <p className="text-white/40">Loading conversations...</p>
          ) : sessions.length === 0 ? (
            <p className="text-white/40">No widget conversations yet.</p>
          ) : (
            <>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => fetchDetail(s.id)}
                    className="w-full dark-card p-4 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          Session #{s.session_number}
                        </span>
                        <span className="text-xs text-white/30 font-mono">
                          {shortId(s.visitor_id)}
                        </span>
                        {s.visitor && s.visitor.total_sessions > 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px]">
                            Returning
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/30">{timeAgo(s.started_at)}</span>
                        <Eye className="w-3.5 h-3.5 text-white/20" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      <span>{s.message_count} msgs</span>
                      {s.tool_calls_count > 0 && <span>{s.tool_calls_count} tools</span>}
                      {s.specialist_domains_detected.length > 0 && (
                        <span className="text-purple-300/60">
                          {s.specialist_domains_detected.join(', ')}
                        </span>
                      )}
                    </div>
                    {s.intent_signals_detected.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.intent_signals_detected.slice(0, 5).map((sig) => (
                          <span key={sig} className="px-1.5 py-0.5 rounded-full bg-gold/10 text-gold text-[10px]">
                            {SIGNAL_LABELS[sig] || sig}
                          </span>
                        ))}
                        {s.intent_signals_detected.length > 5 && (
                          <span className="text-[10px] text-white/30">
                            +{s.intent_signals_detected.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => { setPage(p => Math.max(1, p - 1)) }}
                    disabled={page <= 1}
                    className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-white/40">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => { setPage(p => Math.min(totalPages, p + 1)) }}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
