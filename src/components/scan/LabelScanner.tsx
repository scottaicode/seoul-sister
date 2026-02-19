'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Camera,
  Upload,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import ScanResults from './ScanResults'
import type { ScanResultData } from './ScanResults'

/**
 * Compress an image data URL to JPEG at a target max dimension and quality.
 * Returns a compressed base64 data URL suitable for API upload.
 */
function compressImage(dataUrl: string, maxDimension = 1500, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image for compression'))
    img.src = dataUrl
  })
}

export default function LabelScanner() {
  const [image, setImage] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResultData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      const rawDataUrl = e.target?.result as string
      try {
        // Compress to max 1500px, JPEG 80% — keeps detail for text reading
        // while staying well under Vercel's 4.5MB body limit
        const compressed = await compressImage(rawDataUrl, 1500, 0.8)
        setImage(compressed)
        setResult(null)
        setError(null)
      } catch {
        setError('Failed to process image. Please try another photo.')
      }
    }
    reader.readAsDataURL(file)
  }, [])

  const handleScan = useCallback(async () => {
    if (!image) return

    setScanning(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000) // 60s client timeout

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({ image }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `Scan failed (${res.status})`)
      }

      const data = await res.json()
      setResult(data)
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Scan timed out. Please try again with a clearer photo.')
        } else if (err.message === 'Load failed' || err.message === 'Failed to fetch') {
          setError('Connection lost during scan. Please check your network and try again.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to scan label. Please try again.')
      }
    } finally {
      setScanning(false)
    }
  }, [image])

  const resetScan = () => {
    setImage(null)
    setResult(null)
    setError(null)
  }

  // No image yet — show upload UI
  if (!image) {
    return (
      <div className="flex flex-col gap-4">
        {/* Camera capture */}
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
            <p className="text-xs text-white/40 mt-1">
              Point at any Korean beauty product label
            </p>
          </div>
        </button>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {/* Upload from gallery */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="glass-card p-4 flex items-center gap-3 transition-all duration-300"
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Upload className="w-5 h-5 text-gold" strokeWidth={1.5} />
          </div>
          <div className="text-left">
            <p className="font-display font-semibold text-sm text-white">
              Upload Photo
            </p>
            <p className="text-xs text-white/40">Choose from your gallery</p>
          </div>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    )
  }

  // Image selected — show preview and scan button or results
  return (
    <div className="flex flex-col gap-4">
      {/* Image preview */}
      <div className="relative glass-card overflow-hidden">
        <img
          src={image}
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

      {/* Scan button (if no result yet) */}
      {!result && !scanning && (
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

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results — delegated to ScanResults component */}
      {result && <ScanResults result={result} onReset={resetScan} />}
    </div>
  )
}
