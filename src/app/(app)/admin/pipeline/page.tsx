'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface DashboardData {
  database: {
    total_products: number
    total_brands: number
    total_ingredients: number
    total_ingredient_links: number
    total_price_records: number
    products_with_ingredients_raw: number
    products_with_ingredient_links: number | null
    ingredient_link_pct: number | null
  }
  staging: {
    pending: number
    processing: number
    processed: number
    failed: number
    duplicate: number
    total: number
  }
  recent_runs: PipelineRun[]
  latest_quality_report: PipelineRun | null
  category_distribution: Array<{ category: string; count: number }>
  price_coverage: Array<{ name: string; count: number }>
  fetched_at: string
}

interface PipelineRun {
  id: string
  source: string
  run_type: string
  status: string
  products_scraped: number
  products_processed: number
  products_failed: number
  products_duplicates: number
  estimated_cost_usd: number | null
  metadata: Record<string, unknown>
  started_at: string
  completed_at: string | null
}

interface ActionResult {
  success: boolean
  [key: string]: unknown
}

export default function AdminPipelinePage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<ActionResult | null>(null)

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return {}
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    }
  }, [])

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) {
        setAccessDenied(true)
        return
      }
      const res = await fetch('/api/admin/pipeline/dashboard', { headers })
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setAccessDenied(true)
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
      setAccessDenied(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    if (!authLoading && user) {
      fetchDashboard()
    } else if (!authLoading && !user) {
      setAccessDenied(true)
      setLoading(false)
    }
  }, [authLoading, user, fetchDashboard])

  const triggerAction = async (
    endpoint: string,
    method: string,
    body?: Record<string, unknown>,
    label?: string
  ) => {
    setActionLoading(label ?? endpoint)
    setActionResult(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(endpoint, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      const json = await res.json()
      setActionResult(json)
      await fetchDashboard()
    } catch (err) {
      setActionResult({
        success: false,
        error: err instanceof Error ? err.message : 'Action failed',
      })
    } finally {
      setActionLoading(null)
    }
  }

  // Loading state
  if (authLoading || (loading && !data && !accessDenied)) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  // Access denied
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center space-y-3 max-w-md p-6">
          <h1 className="text-2xl font-bold text-red-400">Access Denied</h1>
          <p className="text-sm text-gray-400">
            {!user
              ? 'You must be signed in to access the admin dashboard.'
              : 'Your account does not have admin privileges.'}
          </p>
          <p className="text-xs text-gray-600">
            {user?.email ?? 'Not signed in'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">Pipeline Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            Product intelligence pipeline monitoring and control
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            Signed in as {user?.email}
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700
                     rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-12 text-gray-400">Loading dashboard...</div>
      )}

      {data && (
        <>
          {/* Pipeline Health Alerts — prominently surfaces failures */}
          <PipelineAlerts data={data} />

          {/* Database Stats */}
          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-3">Database Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <StatCard label="Products" value={data.database.total_products.toLocaleString()} />
              <StatCard label="Brands" value={data.database.total_brands.toLocaleString()} />
              <StatCard label="Ingredients" value={data.database.total_ingredients.toLocaleString()} />
              <StatCard
                label="Ingredient Links"
                value={data.database.total_ingredient_links.toLocaleString()}
              />
              <StatCard label="Price Records" value={data.database.total_price_records.toLocaleString()} />
              <StatCard
                label="Linked %"
                value={
                  data.database.ingredient_link_pct !== null
                    ? `${data.database.ingredient_link_pct}%`
                    : 'N/A'
                }
                highlight={
                  data.database.ingredient_link_pct !== null && data.database.ingredient_link_pct >= 70
                }
              />
            </div>
          </section>

          {/* Staging Pipeline */}
          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-3">Staging Pipeline</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <StatCard label="Total Staged" value={data.staging.total.toLocaleString()} />
              <StatCard
                label="Pending"
                value={data.staging.pending.toLocaleString()}
                highlight={data.staging.pending > 0}
                highlightColor="amber"
              />
              <StatCard
                label="Processing"
                value={data.staging.processing.toLocaleString()}
                highlight={data.staging.processing > 0}
                highlightColor="blue"
              />
              <StatCard
                label="Processed"
                value={data.staging.processed.toLocaleString()}
                highlight
                highlightColor="green"
              />
              <StatCard
                label="Failed"
                value={data.staging.failed.toLocaleString()}
                highlight={data.staging.failed > 0}
                highlightColor="red"
              />
              <StatCard label="Duplicate" value={data.staging.duplicate.toLocaleString()} />
            </div>
          </section>

          {/* Actions */}
          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-3">Manual Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <ActionButton
                label="Incremental Scrape"
                description="Scrape new products from Olive Young (listings only)"
                loading={actionLoading === 'scrape'}
                onClick={() =>
                  triggerAction(
                    '/api/admin/pipeline/scrape',
                    'POST',
                    { source: 'olive_young', mode: 'incremental', skip_details: true },
                    'scrape'
                  )
                }
              />
              <ActionButton
                label="Process Batch (50)"
                description="Run Sonnet extraction on pending staged products"
                loading={actionLoading === 'process'}
                disabled={data.staging.pending === 0}
                onClick={() =>
                  triggerAction(
                    '/api/admin/pipeline/process',
                    'POST',
                    { batch_size: 50 },
                    'process'
                  )
                }
              />
              <ActionButton
                label="Link Ingredients (50)"
                description="Auto-link ingredients for unlinked products"
                loading={actionLoading === 'link'}
                onClick={() =>
                  triggerAction(
                    '/api/admin/pipeline/link-ingredients',
                    'POST',
                    { batch_size: 50 },
                    'link'
                  )
                }
              />
              <ActionButton
                label="Refresh Prices"
                description="Scrape prices from Soko Glam + YesStyle"
                loading={actionLoading === 'prices'}
                onClick={() =>
                  triggerAction(
                    '/api/admin/pipeline/prices',
                    'POST',
                    { retailer: 'all', batch_size: 25 },
                    'prices'
                  )
                }
              />
            </div>

            {/* Action Result */}
            {actionResult && (
              <div className="mt-3 p-4 bg-gray-900 border border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-sm font-medium ${
                      actionResult.success ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {actionResult.success ? 'Action completed' : 'Action failed'}
                  </span>
                  <button
                    onClick={() => setActionResult(null)}
                    className="text-gray-500 hover:text-gray-300 text-xs"
                  >
                    Dismiss
                  </button>
                </div>
                <pre className="text-xs text-gray-400 overflow-x-auto max-h-48">
                  {JSON.stringify(actionResult, null, 2)}
                </pre>
              </div>
            )}
          </section>

          {/* Category Distribution + Price Coverage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Distribution */}
            <section>
              <h2 className="text-lg font-semibold text-gray-300 mb-3">
                Category Distribution
              </h2>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
                {data.category_distribution.map((cat) => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 w-28 truncate">
                      {cat.category}
                    </span>
                    <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-amber-600/70 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(
                            2,
                            (cat.count / data.database.total_products) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-300 w-14 text-right">
                      {cat.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Price Coverage */}
            <section>
              <h2 className="text-lg font-semibold text-gray-300 mb-3">
                Price Coverage by Retailer
              </h2>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
                {data.price_coverage.length === 0 && (
                  <p className="text-sm text-gray-500">No price records yet</p>
                )}
                {data.price_coverage.map((ret) => (
                  <div key={ret.name} className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{ret.name}</span>
                    <span className="text-sm text-gray-300 font-medium">
                      {ret.count.toLocaleString()} prices
                    </span>
                  </div>
                ))}
              </div>

              {/* Quality Report */}
              {data.latest_quality_report && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">
                    Latest Quality Report
                  </h3>
                  <QualityReport run={data.latest_quality_report} />
                </div>
              )}
            </section>
          </div>

          {/* Pipeline Run History */}
          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-3">
              Pipeline Run History
            </h2>
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="text-left p-3">Source</th>
                      <th className="text-left p-3">Type</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-right p-3">Scraped</th>
                      <th className="text-right p-3">Processed</th>
                      <th className="text-right p-3">Failed</th>
                      <th className="text-right p-3">Dupes</th>
                      <th className="text-right p-3">Cost</th>
                      <th className="text-left p-3">Started</th>
                      <th className="text-left p-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_runs.map((run) => (
                      <RunRow key={run.id} run={run} />
                    ))}
                    {data.recent_runs.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-4 text-center text-gray-500">
                          No pipeline runs yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <p className="text-xs text-gray-600 text-right">
            Last fetched: {new Date(data.fetched_at).toLocaleString()}
          </p>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  highlight,
  highlightColor = 'amber',
}: {
  label: string
  value: string
  highlight?: boolean
  highlightColor?: 'amber' | 'green' | 'red' | 'blue'
}) {
  const colorMap = {
    amber: 'text-amber-400',
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p
        className={`text-xl font-bold mt-1 ${
          highlight ? colorMap[highlightColor] : 'text-gray-200'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function ActionButton({
  label,
  description,
  loading,
  disabled,
  onClick,
}: {
  label: string
  description: string
  loading: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="text-left p-4 bg-gray-900 border border-gray-800 rounded-lg
                 hover:border-amber-600/50 transition-colors
                 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <p className="font-medium text-gray-200">
        {loading ? 'Running...' : label}
      </p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </button>
  )
}

function QualityReport({ run }: { run: PipelineRun }) {
  const meta = run.metadata as {
    health_score?: number
    report?: {
      issues?: {
        missing_descriptions?: number
        unlinked_with_ingredients_raw?: number
        stale_prices?: number
        failed_staging?: number
        missing_korean_names?: number
      }
      coverage?: {
        description_pct?: number
        ingredient_link_pct?: number
        korean_name_pct?: number
      }
    }
  }

  const healthScore = meta.health_score ?? 0
  const issues = meta.report?.issues
  const coverage = meta.report?.coverage

  const scoreColor =
    healthScore >= 80 ? 'text-green-400' :
    healthScore >= 60 ? 'text-amber-400' :
    'text-red-400'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          {new Date(run.started_at).toLocaleDateString()}
        </span>
        <span className={`text-2xl font-bold ${scoreColor}`}>
          {healthScore}/100
        </span>
      </div>

      {coverage && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <p className="text-gray-500">Descriptions</p>
            <p className="text-gray-300 font-medium">{coverage.description_pct}%</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Ingredients</p>
            <p className="text-gray-300 font-medium">{coverage.ingredient_link_pct}%</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Korean Names</p>
            <p className="text-gray-300 font-medium">{coverage.korean_name_pct}%</p>
          </div>
        </div>
      )}

      {issues && (
        <div className="text-xs space-y-1">
          {(issues.failed_staging ?? 0) > 0 && (
            <p className="text-red-400">
              {issues.failed_staging} failed staging rows
            </p>
          )}
          {(issues.stale_prices ?? 0) > 0 && (
            <p className="text-amber-400">
              {issues.stale_prices} stale prices (&gt;7 days)
            </p>
          )}
          {(issues.unlinked_with_ingredients_raw ?? 0) > 0 && (
            <p className="text-amber-400">
              {issues.unlinked_with_ingredients_raw} unlinked products with ingredient data
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function RunRow({ run }: { run: PipelineRun }) {
  const [expanded, setExpanded] = useState(false)

  const statusColor = {
    running: 'text-blue-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
  }[run.status] ?? 'text-gray-400'

  const duration = run.completed_at
    ? formatDuration(new Date(run.completed_at).getTime() - new Date(run.started_at).getTime())
    : run.status === 'running' ? 'In progress' : '-'

  return (
    <>
      <tr
        className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="p-3 text-gray-300">{run.source}</td>
        <td className="p-3">
          <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400">
            {run.run_type}
          </span>
        </td>
        <td className={`p-3 font-medium ${statusColor}`}>{run.status}</td>
        <td className="p-3 text-right text-gray-300">
          {run.products_scraped.toLocaleString()}
        </td>
        <td className="p-3 text-right text-gray-300">
          {run.products_processed.toLocaleString()}
        </td>
        <td className="p-3 text-right text-gray-300">
          {run.products_failed > 0 ? (
            <span className="text-red-400">{run.products_failed}</span>
          ) : (
            '0'
          )}
        </td>
        <td className="p-3 text-right text-gray-300">
          {run.products_duplicates.toLocaleString()}
        </td>
        <td className="p-3 text-right text-gray-300">
          {run.estimated_cost_usd != null
            ? `$${Number(run.estimated_cost_usd).toFixed(2)}`
            : '-'}
        </td>
        <td className="p-3 text-gray-400 text-xs">
          {new Date(run.started_at).toLocaleString()}
        </td>
        <td className="p-3 text-gray-400 text-xs">{duration}</td>
      </tr>
      {expanded && run.metadata && Object.keys(run.metadata).length > 0 && (
        <tr className="border-b border-gray-800/50">
          <td colSpan={10} className="p-3 bg-gray-900/50">
            <pre className="text-xs text-gray-500 overflow-x-auto max-h-32">
              {JSON.stringify(run.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

function PipelineAlerts({ data }: { data: DashboardData }) {
  const alerts: Array<{ severity: 'critical' | 'warning'; message: string }> = []

  // Check for recent failed pipeline runs (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentFailures = data.recent_runs.filter(
    r => r.status === 'failed' && new Date(r.started_at) > oneDayAgo
  )
  for (const failure of recentFailures) {
    const errorDetail = (failure.metadata as Record<string, unknown>)?.fatal_error
    alerts.push({
      severity: 'critical',
      message: `Pipeline FAILED: ${failure.source} ${failure.run_type} at ${new Date(failure.started_at).toLocaleString()}${errorDetail ? ` — ${errorDetail}` : ''}`,
    })
  }

  // Check for runs stuck in 'running' state (started >15 min ago)
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)
  const stuckRuns = data.recent_runs.filter(
    r => r.status === 'running' && new Date(r.started_at) < fifteenMinAgo
  )
  for (const stuck of stuckRuns) {
    alerts.push({
      severity: 'critical',
      message: `Pipeline STUCK: ${stuck.source} ${stuck.run_type} has been running since ${new Date(stuck.started_at).toLocaleString()}`,
    })
  }

  // Check for failed staging rows
  if (data.staging.failed > 0) {
    alerts.push({
      severity: 'warning',
      message: `${data.staging.failed} products failed staging extraction — may need manual reprocessing`,
    })
  }

  // Check quality report health score
  if (data.latest_quality_report) {
    const meta = data.latest_quality_report.metadata as { health_score?: number }
    if (meta.health_score !== undefined && meta.health_score < 60) {
      alerts.push({
        severity: 'critical',
        message: `Data quality health score: ${meta.health_score}/100 — database integrity is degraded`,
      })
    } else if (meta.health_score !== undefined && meta.health_score < 80) {
      alerts.push({
        severity: 'warning',
        message: `Data quality health score: ${meta.health_score}/100 — some data gaps detected`,
      })
    }
  }

  // Check for stale quality report (no report in >8 days)
  if (data.latest_quality_report) {
    const reportAge = Date.now() - new Date(data.latest_quality_report.started_at).getTime()
    if (reportAge > 8 * 24 * 60 * 60 * 1000) {
      alerts.push({
        severity: 'warning',
        message: `Data quality report is ${Math.floor(reportAge / (24 * 60 * 60 * 1000))} days old — weekly cron may not be running`,
      })
    }
  } else {
    alerts.push({
      severity: 'warning',
      message: 'No data quality report found — data-quality cron has never run',
    })
  }

  // No recent pipeline runs at all (nothing in last 48 hours = crons may be broken)
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const anyCronRun = data.recent_runs.some(r => new Date(r.started_at) > twoDaysAgo)
  if (!anyCronRun && data.recent_runs.length > 0) {
    alerts.push({
      severity: 'critical',
      message: 'No pipeline activity in 48+ hours — cron jobs may not be executing',
    })
  }

  if (alerts.length === 0) return null

  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const warningAlerts = alerts.filter(a => a.severity === 'warning')

  return (
    <section className="space-y-2">
      {criticalAlerts.map((alert, i) => (
        <div
          key={`critical-${i}`}
          className="p-3 bg-red-950/50 border border-red-700 rounded-lg flex items-start gap-3"
        >
          <span className="text-red-400 text-lg mt-0.5">!</span>
          <div>
            <p className="text-sm font-medium text-red-300">CRITICAL</p>
            <p className="text-sm text-red-400/90">{alert.message}</p>
          </div>
        </div>
      ))}
      {warningAlerts.map((alert, i) => (
        <div
          key={`warning-${i}`}
          className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg flex items-start gap-3"
        >
          <span className="text-amber-400 text-lg mt-0.5">*</span>
          <div>
            <p className="text-sm font-medium text-amber-400">WARNING</p>
            <p className="text-sm text-amber-400/80">{alert.message}</p>
          </div>
        </div>
      ))}
    </section>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}
