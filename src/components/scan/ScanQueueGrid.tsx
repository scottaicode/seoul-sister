'use client'

import { useRef, type ChangeEvent } from 'react'
import { X, Plus, Loader2, Check, AlertTriangle } from 'lucide-react'
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
 */
export default function ScanQueueGrid({ items, scanning, onRemove, onAddMore }: ScanQueueGridProps) {
  const addMoreInputRef = useRef<HTMLInputElement>(null)

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

      {!scanning && (
        <button
          onClick={() => addMoreInputRef.current?.click()}
          className="aspect-square glass-card border-dashed border-2 border-gold/30 flex flex-col items-center justify-center gap-1 text-gold/70 hover:text-gold transition-colors duration-200"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px] font-medium">Add more</span>
        </button>
      )}

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
