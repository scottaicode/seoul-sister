'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/ui/EmptyState'
import ScanHistoryDetail, { type StoredScan } from '@/components/scan/ScanHistoryDetail'

export default function ScanDetailPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : ''

  const [scan, setScan] = useState<StoredScan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!id) {
        if (!cancelled) {
          setError('No scan specified.')
          setLoading(false)
        }
        return
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          if (!cancelled) {
            setError('Please sign in to view this scan.')
            setLoading(false)
          }
          return
        }

        const res = await fetch(`/api/scans/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (!cancelled) {
          if (res.ok) {
            const json = await res.json()
            setScan(json.scan ?? null)
          } else if (res.status === 404) {
            setError('notfound')
          } else {
            // A failed load must look like a failure, never like an empty scan.
            setError('We could not load this scan. Please try again.')
          }
        }
      } catch {
        if (!cancelled) setError('We could not load this scan. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors duration-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </Link>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold/40" />
        </div>
      ) : error === 'notfound' ? (
        <EmptyState
          icon={Camera}
          title="Scan not found"
          description="This scan doesn't exist, or it isn't one of yours."
          actionLabel="Scan a product"
          actionHref="/scan"
        />
      ) : error ? (
        <EmptyState
          icon={Camera}
          title="Couldn't load this scan"
          description={error}
          actionLabel="Back to dashboard"
          actionHref="/dashboard"
        />
      ) : scan ? (
        <ScanHistoryDetail scan={scan} />
      ) : null}
    </div>
  )
}
