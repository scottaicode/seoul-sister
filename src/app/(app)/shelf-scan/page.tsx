'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Camera,
  Upload,
  X,
  Loader2,
  AlertTriangle,
  Layers,
  MessageCircle,
  Sparkles,
  Plus,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import CollectionGrid from '@/components/shelf-scan/CollectionGrid'
import RoutineGrade from '@/components/shelf-scan/RoutineGrade'
import CollectionStats from '@/components/shelf-scan/CollectionStats'
import type { ShelfScanProduct, ShelfScanCollectionAnalysis } from '@/types/database'

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

interface ShelfScanAPIResponse {
  success: boolean
  products_identified: ShelfScanProduct[]
  collection_analysis: ShelfScanCollectionAnalysis
  products_count: number
  matched_count: number
}

export default function ShelfScanPage() {
  const [image, setImage] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<ShelfScanAPIResponse | null>(null)
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

  const handleAnalyze = useCallback(async () => {
    if (!image) return
    setAnalyzing(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Please sign in to use Shelf Scan.')
        return
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)

      const res = await fetch('/api/shelf-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ image }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `Analysis failed (${res.status})`)
      }

      const data: ShelfScanAPIResponse = await res.json()
      setResult(data)
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Analysis timed out. Try again with a clearer photo or fewer products.')
        } else if (err.message === 'Load failed' || err.message === 'Failed to fetch') {
          setError('Connection lost. Please check your network and try again.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to analyze. Please try again.')
      }
    } finally {
      setAnalyzing(false)
    }
  }, [image])

  const resetAnalysis = () => {
    setImage(null)
    setResult(null)
    setError(null)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      {/* Header */}
      <section>
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-gold" />
          <h1 className="font-display font-bold text-2xl text-white">
            Shelf Scan
          </h1>
        </div>
        <p className="text-white/40 text-sm mt-1">
          Photo your skincare shelf for a full collection analysis
        </p>
      </section>

      {/* Results */}
      {result && (
        <section className="space-y-5">
          {/* Routine Grade */}
          <RoutineGrade
            grade={result.collection_analysis.overall_routine_grade}
            rationale={result.collection_analysis.grade_rationale}
          />

          {/* Collection stats */}
          <CollectionStats
            analysis={result.collection_analysis}
            products={result.products_identified}
            matchedCount={result.matched_count}
          />

          {/* Recommendations */}
          {result.collection_analysis.recommendations.length > 0 && (
            <div className="glass-card p-4 space-y-3">
              <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gold" />
                Recommendations
              </h3>
              <ul className="space-y-2">
                {result.collection_analysis.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                    <span className="text-gold mt-0.5 flex-shrink-0">
                      {i + 1}.
                    </span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/yuri?ask=I just scanned my skincare shelf and got a grade of ${result.collection_analysis.overall_routine_grade}. I have ${result.products_identified.length} products. Missing categories: ${result.collection_analysis.missing_categories.join(', ') || 'none'}. What should I add or change?`}
                className="flex items-center justify-center gap-2 mt-3 py-2 rounded-xl bg-gold/10 text-gold text-xs font-medium hover:bg-gold/20 transition-colors duration-200"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Ask Yuri to optimize your collection
              </Link>
            </div>
          )}

          {/* Products identified */}
          <div>
            <h3 className="font-display font-semibold text-sm text-white mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-gold" />
              Products Identified ({result.products_count})
            </h3>
            <CollectionGrid products={result.products_identified} />
          </div>

          {/* Add to routine CTA */}
          {result.matched_count > 0 && (
            <Link
              href="/routine"
              className="w-full glass-card py-3 text-sm font-medium text-gold hover:text-gold-light transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Build routine from these products
            </Link>
          )}

          {/* Scan again */}
          <button
            onClick={resetAnalysis}
            className="w-full glass-card py-3 text-sm font-medium text-white/60 hover:text-white transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Scan Another Shelf
          </button>
        </section>
      )}

      {/* Upload UI (no result yet) */}
      {!result && (
        <section className="space-y-4">
          {!image ? (
            <>
              {/* Camera capture */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full glass-card-strong p-8 flex flex-col items-center gap-4 transition-all duration-300 border-dashed border-2 border-gold/30 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold to-gold-light flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                  <Camera className="w-8 h-8 text-white" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <p className="font-display font-semibold text-base text-white">
                    Photo Your Shelf
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    Capture your entire skincare collection
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
                className="w-full glass-card p-4 flex items-center gap-3 transition-all duration-300"
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

              {/* Tips */}
              <div className="glass-card p-4 space-y-2">
                <h3 className="font-display font-semibold text-xs text-white/60">
                  Tips for best results
                </h3>
                <ul className="space-y-1.5 text-xs text-white/40">
                  <li>Arrange products with labels facing the camera</li>
                  <li>Good lighting helps identify brands and names</li>
                  <li>Include all your skincare products in one photo</li>
                  <li>Avoid blurry photos — hold the camera steady</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Image preview */}
              <div className="relative glass-card overflow-hidden">
                <img
                  src={image}
                  alt="Skincare shelf for analysis"
                  className="w-full max-h-72 object-contain bg-white/5"
                />
                <button
                  onClick={resetAnalysis}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Analyze button */}
              {!analyzing && (
                <button
                  onClick={handleAnalyze}
                  className="w-full glass-button-primary py-3 text-base font-semibold flex items-center justify-center gap-2"
                >
                  <Layers className="w-5 h-5" />
                  Analyze Collection
                </button>
              )}

              {/* Analyzing state */}
              {analyzing && (
                <div className="glass-card p-6 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-gold" />
                  <p className="font-display font-semibold text-sm text-white">
                    Analyzing your collection...
                  </p>
                  <p className="text-xs text-white/40">
                    Identifying products, checking for gaps and redundancies
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Bottom spacer for mobile nav */}
      <div className="h-4" />
    </div>
  )
}
