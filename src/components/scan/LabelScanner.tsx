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

/**
 * One POST to /api/scan. Pass ONE image for a single label, or SEVERAL views of
 * the SAME product (front + back) to be merged into one analysis.
 *
 * Bailey, Aug 7 2026: the scanner needs both sides. The front carries the product
 * name and brand; the back carries the INCI list. Sending them as separate scans
 * produced two half-complete rows for one bottle — one that knew the name but no
 * ingredients, one that had ingredients but matched no product.
 */
async function scanImages(imgs: string[]): Promise<ScanResultData> {
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
      // Single image keeps the original `image` field so nothing else changes.
      body: JSON.stringify(imgs.length === 1 ? { image: imgs[0] } : { images: imgs }),
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
  /**
   * Are the queued photos multiple views of ONE product (front + back), or
   * several different products?
   *
   * Defaults to TRUE for exactly two photos, because that is overwhelmingly the
   * front-and-back case and it's the reason this exists. Three or more defaults
   * to separate products (a shelf of items), matching the old batch behaviour.
   * The user can flip it either way — we never silently merge a real batch.
   */
  const [sameProduct, setSameProduct] = useState(true)

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
  //
  // When `sameProduct` is on and there is more than one photo, all views go in a
  // SINGLE request instead and produce one merged result — front for identity,
  // back for INCI.
  const handleScan = useCallback(async () => {
    if (scanning) return
    const targets = queue.filter((item) => item.status === 'ready' || item.status === 'error')
    if (targets.length === 0) return

    setScanning(true)
    setError(null)

    const merge = sameProduct && targets.length > 1

    if (merge) {
      // One product, several views → one call, one result. The result lands on
      // the first item; the rest are marked done so the UI doesn't offer to
      // re-scan views that were already consumed.
      setProgress({ current: 1, total: 1 })
      setQueue((prev) =>
        prev.map((q) =>
          targets.some((t) => t.id === q.id) ? { ...q, status: 'scanning', error: null } : q
        )
      )
      try {
        const result = await scanImages(targets.map((t) => t.dataUrl))
        const [primary, ...rest] = targets
        setQueue((prev) =>
          prev.map((q) => {
            if (q.id === primary.id) return { ...q, status: 'done', result }
            if (rest.some((r) => r.id === q.id)) return { ...q, status: 'done', result: null }
            return q
          })
        )
      } catch (err) {
        const message = scanErrorMessage(err)
        // The whole merged scan failed, so every contributing view failed — mark
        // them all, or the user is left with photos that look fine but produced
        // nothing.
        setQueue((prev) =>
          prev.map((q) =>
            targets.some((t) => t.id === q.id) ? { ...q, status: 'error', error: message } : q
          )
        )
        setError(message)
      }
      setProgress(null)
      setScanning(false)
      return
    }

    let current = 0
    for (const target of targets) {
      current += 1
      setProgress({ current, total: targets.length })
      setQueue((prev) =>
        prev.map((q) => (q.id === target.id ? { ...q, status: 'scanning', error: null } : q))
      )
      try {
        const result = await scanImages([target.dataUrl])
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
  }, [queue, scanning, sameProduct])

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

  // Merged front+back scan that has completed — one product, so render the single
  // combined result rather than a per-photo batch list.
  const mergedResult = sameProduct ? queue.find((q) => q.result)?.result ?? null : null
  if (attempted && !scanning && sameProduct && mergedResult) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {queue.map((item) => (
            <img
              key={item.id}
              src={item.dataUrl}
              alt=""
              className="w-16 h-16 rounded-lg object-cover border border-white/10"
            />
          ))}
        </div>
        <p className="text-xs text-white/40">
          Combined from {queue.length} photos of the same product.
        </p>
        <ScanResults result={mergedResult} onReset={resetScan} />
        {errorBanner}
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

      {/* One product or several? This decides whether the photos are MERGED into
          a single analysis (front + back of one bottle) or scanned separately.
          Getting it wrong is cheap to undo — the choice is explicit, not inferred. */}
      {!scanning && (
        <div className="glass-card p-3 flex flex-col gap-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sameProduct}
              onChange={(e) => setSameProduct(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-gold shrink-0"
            />
            <span className="text-sm text-white/80">
              These are all the same product
              <span className="block text-xs text-white/40 mt-0.5">
                Front and back of one bottle — Yuri reads the name from the front and the
                ingredients from the back, then combines them into one analysis.
              </span>
            </span>
          </label>
        </div>
      )}

      {!scanning && (
        <button
          onClick={handleScan}
          className="glass-button-primary py-3 text-base font-semibold flex items-center justify-center gap-2"
        >
          <Camera className="w-5 h-5" />
          {sameProduct ? `Analyze Product (${queue.length} photos)` : `Analyze ${queue.length} Labels`}
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
