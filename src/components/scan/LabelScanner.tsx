'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Camera, X, Loader2, AlertTriangle } from 'lucide-react'
import ScanResults from './ScanResults'
import type { ScanResultData } from './ScanResults'
import UploadDropZone from './UploadDropZone'
import ScanQueueGrid from './ScanQueueGrid'
import BatchScanResults from './BatchScanResults'
import {
  MAX_FILE_BYTES,
  compressImage,
  makeQueueId,
  readFileAsDataUrl,
  type ScanQueueItem,
} from './scan-upload'

/** One POST to /api/scan for a single image — the route is one-image-per-call. */
async function scanImage(image: string): Promise<ScanResultData> {
  const { data: { session } } = await supabase.auth.getSession()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000) // 60s client timeout

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
      },
      body: JSON.stringify({ image }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const data: { error?: string } | null = await res.json().catch(() => null)
      throw new Error(data?.error || `Scan failed (${res.status})`)
    }

    const data: ScanResultData = await res.json()
    return data
  } finally {
    clearTimeout(timeout)
  }
}

function scanErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return 'Scan timed out. Please try again with a clearer photo.'
    }
    if (err.message === 'Load failed' || err.message === 'Failed to fetch') {
      return 'Connection lost during scan. Please check your network and try again.'
    }
    return err.message
  }
  return 'Failed to scan label. Please try again.'
}

export default function LabelScanner() {
  const [queue, setQueue] = useState<ScanQueueItem[]>([])
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback(async (files: File[]) => {
    setError(null)
    const problems: string[] = []
    const newItems: ScanQueueItem[] = []
    const single = files.length === 1

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        problems.push(single ? 'Please select an image file.' : `${file.name}: not an image file.`)
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        problems.push(single ? 'Image must be under 10MB.' : `${file.name}: image must be under 10MB.`)
        continue
      }
      try {
        const rawDataUrl = await readFileAsDataUrl(file)
        // Compress to max 1500px, JPEG 80% — keeps detail for text reading
        // while staying well under Vercel's 4.5MB body limit
        const compressed = await compressImage(rawDataUrl, 1500, 0.8)
        newItems.push({
          id: makeQueueId(),
          dataUrl: compressed,
          fileName: file.name,
          status: 'ready',
          result: null,
          error: null,
        })
      } catch {
        problems.push(
          single
            ? 'Failed to process image. Please try another photo.'
            : `${file.name}: failed to process. Please try another photo.`
        )
      }
    }

    if (newItems.length > 0) setQueue((prev) => [...prev, ...newItems])
    if (problems.length > 0) setError(problems.join(' '))
  }, [])

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id))
  }, [])

  // Sequential scan of every item not yet successfully scanned. Per-item
  // failure isolation: one bad photo never kills the rest of the batch.
  const handleScan = useCallback(async () => {
    if (scanning) return
    const targets = queue.filter((item) => item.status === 'ready' || item.status === 'error')
    if (targets.length === 0) return

    setScanning(true)
    setError(null)

    let current = 0
    for (const target of targets) {
      current += 1
      setProgress({ current, total: targets.length })
      setQueue((prev) =>
        prev.map((q) => (q.id === target.id ? { ...q, status: 'scanning', error: null } : q))
      )
      try {
        const result = await scanImage(target.dataUrl)
        setQueue((prev) =>
          prev.map((q) => (q.id === target.id ? { ...q, status: 'done', result } : q))
        )
      } catch (err) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === target.id ? { ...q, status: 'error', error: scanErrorMessage(err) } : q
          )
        )
      }
    }

    setProgress(null)
    setScanning(false)
  }, [queue, scanning])

  const resetScan = () => {
    setQueue([])
    setProgress(null)
    setError(null)
  }

  const errorBanner = error && (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      {error}
    </div>
  )

  // No photos yet — show upload UI (camera, gallery, drag-and-drop)
  if (queue.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <UploadDropZone onFiles={handleFiles} />
        {errorBanner}
      </div>
    )
  }

  const attempted = queue.some((item) => item.status === 'done' || item.status === 'error')

  // Single photo — same simple flow as before: preview, analyze, one result
  if (queue.length === 1) {
    const item = queue[0]
    return (
      <div className="flex flex-col gap-4">
        {/* Image preview */}
        <div className="relative glass-card overflow-hidden">
          <img
            src={item.dataUrl}
            alt="Product label"
            className="w-full max-h-64 object-contain bg-white/5"
          />
          <button
            onClick={resetScan}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scan button (if no result yet, or retry after failure) */}
        {item.status !== 'done' && !scanning && (
          <button
            onClick={handleScan}
            className="glass-button-primary py-3 text-base font-semibold flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            Analyze Label
          </button>
        )}

        {/* Scanning state */}
        {scanning && (
          <div className="glass-card p-6 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
            <p className="font-display font-semibold text-sm text-white">
              Analyzing Korean label...
            </p>
            <p className="text-xs text-white/40">
              Reading text, identifying ingredients, checking safety
            </p>
          </div>
        )}

        {item.error && !scanning && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {item.error}
          </div>
        )}
        {errorBanner}

        {/* Results — delegated to ScanResults component */}
        {item.status === 'done' && item.result && (
          <ScanResults result={item.result} onReset={resetScan} />
        )}
      </div>
    )
  }

  // Multiple photos, results in (or partially in) — expandable list per photo
  if (attempted && !scanning) {
    return (
      <div className="flex flex-col gap-4">
        <BatchScanResults
          items={queue}
          scanning={scanning}
          onReset={resetScan}
          onRetryFailed={handleScan}
        />
        {errorBanner}
      </div>
    )
  }

  // Multiple photos queued — thumbnails with remove, analyze, progress
  return (
    <div className="flex flex-col gap-4">
      <ScanQueueGrid
        items={queue}
        scanning={scanning}
        onRemove={removeItem}
        onAddMore={handleFiles}
      />

      {!scanning && (
        <button
          onClick={handleScan}
          className="glass-button-primary py-3 text-base font-semibold flex items-center justify-center gap-2"
        >
          <Camera className="w-5 h-5" />
          Analyze {queue.length} Labels
        </button>
      )}

      {scanning && progress && (
        <div className="glass-card p-6 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
          <p className="font-display font-semibold text-sm text-white">
            Analyzing {progress.current} of {progress.total}...
          </p>
          <p className="text-xs text-white/40">
            Reading text, identifying ingredients, checking safety
          </p>
        </div>
      )}

      {errorBanner}
    </div>
  )
}
