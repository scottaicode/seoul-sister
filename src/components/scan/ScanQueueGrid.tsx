'use client'

import { useRef, type ChangeEvent } from 'react'
import { X, Plus, Camera, Loader2, Check, AlertTriangle } from 'lucide-react'
import type { ScanQueueItem } from './scan-upload'

interface ScanQueueGridProps {
  items: ScanQueueItem[]
  scanning: boolean
  onRemove: (id: string) => void
  onAddMore: (files: File[]) => void
}

function StatusOverlay({ status }: { status: ScanQueueItem['status'] }) {
  if (status === 'scanning') {
    return (
      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gold" />
      </div>
    )
  }
  if (status === 'done') {
    return (
      <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
        <Check className="w-3 h-3 text-white" strokeWidth={3} />
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
        <AlertTriangle className="w-3 h-3 text-white" />
      </div>
    )
  }
  return null
}

/**
 * Thumbnail grid for the multi-photo scan queue. Before scanning, each
 * photo is individually removable and more can be added. During scanning,
 * per-item status badges replace the remove buttons.
 *
 * TWO add-more inputs, camera and gallery, deliberately (Aug 7 2026 — Bailey:
 * "if I upload from album it lets me do multiple but if I take with camera it
 * still only allows one").
 *
 * OBSERVED (Bailey's iPhone, iOS Safari): a `capture="environment"` input returns
 * exactly ONE photo and dismisses the camera, even though `multiple` is present
 * on the gallery input right beside it. The HTML spec does NOT actually promise
 * this — MDN documents `capture` as choosing WHICH camera and says nothing about
 * file count, and does not define the capture+multiple combination. So this is
 * real-world iOS behaviour confirmed by a user report, not a documented rule.
 *
 * Either way the remedy is the same and does not depend on knowing why: give the
 * user a way to shoot AGAIN and append. Without it the front+back merge was
 * reachable only by first saving both photos to the camera roll, which is what
 * made her conclude the scanner was one-photo-only.
 *
 * If a future iOS makes capture+multiple work, this control still does no harm —
 * it just becomes a convenience rather than the only path.
 */
export default function ScanQueueGrid({ items, scanning, onRemove, onAddMore }: ScanQueueGridProps) {
  const addMoreInputRef = useRef<HTMLInputElement>(null)
  const addMoreCameraRef = useRef<HTMLInputElement>(null)

  const handleAddMore = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onAddMore(files)
    e.target.value = ''
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item, i) => (
        <div key={item.id} className="relative aspect-square glass-card overflow-hidden">
          <img
            src={item.dataUrl}
            alt={`Label photo ${i + 1}`}
            className="w-full h-full object-cover bg-white/5"
          />
          {!scanning && item.status === 'ready' && (
            <button
              onClick={() => onRemove(item.id)}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors duration-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <StatusOverlay status={item.status} />
        </div>
      ))}

      {/* Camera first — photographing the other side of the bottle you are
          already holding is the common case, and it was the unreachable one. */}
      {!scanning && (
        <button
          onClick={() => addMoreCameraRef.current?.click()}
          className="aspect-square glass-card border-dashed border-2 border-gold/40 flex flex-col items-center justify-center gap-1 text-gold hover:text-gold-light transition-colors duration-200"
        >
          <Camera className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-tight text-center px-1">
            Take another
          </span>
        </button>
      )}

      {!scanning && (
        <button
          onClick={() => addMoreInputRef.current?.click()}
          className="aspect-square glass-card border-dashed border-2 border-white/15 flex flex-col items-center justify-center gap-1 text-white/50 hover:text-white/80 transition-colors duration-200"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px] font-medium">From photos</span>
        </button>
      )}

      {/* One shot per tap on iOS (observed, not spec-guaranteed — see the note
          above). `multiple` is omitted because it had no effect there anyway. */}
      <input
        ref={addMoreCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleAddMore}
      />

      <input
        ref={addMoreInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleAddMore}
      />
    </div>
  )
}
