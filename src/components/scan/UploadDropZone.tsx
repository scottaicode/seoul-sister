'use client'

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Camera, Upload } from 'lucide-react'

interface UploadDropZoneProps {
  onFiles: (files: File[]) => void
}

/**
 * Empty-state upload UI for the label scanner.
 * - Camera input stays single-shot (capture="environment" + multiple is
 *   meaningless on iOS)
 * - Gallery input accepts multiple photos
 * - The whole zone is a drag-and-drop target (image/* only)
 */
export default function UploadDropZone({ onFiles }: UploadDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onFiles(files)
    e.target.value = '' // allow re-selecting the same file
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    // Only clear when leaving the zone itself, not moving between children
    if (!e.currentTarget.contains(e.relatedTarget instanceof Node ? e.relatedTarget : null)) {
      setDragActive(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    const images = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (images.length > 0) onFiles(images)
  }

  return (
    <div
      className="flex flex-col gap-4"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Camera capture — single shot */}
      <button
        onClick={() => cameraInputRef.current?.click()}
        className="glass-card-strong p-8 flex flex-col items-center gap-4 transition-all duration-300 border-dashed border-2 border-gold/30 group"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold to-gold-light flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
          <Camera className="w-8 h-8 text-white" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p className="font-display font-semibold text-base text-white">
            Scan with Camera
          </p>
          {/*
            Say WHICH side, and say that a second shot is possible.
            A subscriber photographed the front of her moisturizer, so the scan
            stored ingredients_found = ["Not listed on visible label"] and the
            product stayed invisible to Yuri — the front of a bottle almost never
            carries an INCI list. (Korean or not is irrelevant; the scanner reads
            any label.)
            The second line was added Aug 7 2026: on iOS this capture input
            returns only ONE photo per tap, so a user who does not know she can
            shoot again reasonably concludes the scanner is one-photo-only, which
            is exactly what Bailey concluded.
          */}
          <p className="text-xs text-white/40 mt-1">
            Start with the ingredients list — the back of the bottle
          </p>
          <p className="text-[11px] text-gold/60 mt-1">
            You can add the front afterwards for the product name
          </p>
        </div>
      </button>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Upload from gallery — multiple + drag-and-drop */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className={`glass-card p-4 flex items-center gap-3 transition-all duration-300 ${
          dragActive ? 'border-2 border-gold bg-gold/10' : ''
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <Upload className="w-5 h-5 text-gold" strokeWidth={1.5} />
        </div>
        <div className="text-left">
          <p className="font-display font-semibold text-sm text-white">
            {dragActive ? 'Drop photos here' : 'Upload Photos'}
          </p>
          <p className="text-xs text-white/40">
            {dragActive
              ? 'Release to add them to your scan'
              : 'Choose one or more, or drag and drop'}
          </p>
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  )
}
