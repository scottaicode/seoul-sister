'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Camera,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface ScannedIngredient {
  name_inci: string
  name_en: string
  name_ko: string | null
  function: string
  safety_rating: number
  comedogenic_rating: number
  concerns: string[]
}

interface ScanAnalysis {
  product_name_en: string
  product_name_ko: string | null
  brand: string
  category: string
  extracted_text: string
  ingredients: ScannedIngredient[]
  overall_safety_score: number
  key_highlights: string[]
  warnings: string[]
}

interface IngredientConflict {
  scanned_ingredient: string
  routine_ingredient: string
  severity: string
  description: string
  recommendation: string
}

interface ScanResult {
  success: boolean
  analysis: ScanAnalysis
  product_match: { id: string; name_en: string; brand_en: string } | null
  conflicts: IngredientConflict[]
}

function SafetyScoreRing({ score }: { score: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40" cy="40" r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          className="text-white/5"
        />
        <circle
          cx="40" cy="40" r={radius}
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold text-xl" style={{ color }}>{score}</span>
        <span className="text-[9px] text-white/40">Safety</span>
      </div>
    </div>
  )
}

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
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAllIngredients, setShowAllIngredients] = useState(false)
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
    setShowAllIngredients(false)
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

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Product identification */}
          <div className="glass-card-strong p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-display font-bold text-base text-white">
                {result.analysis.product_name_en}
              </p>
              {result.analysis.product_name_ko && (
                <p className="text-sm text-white/40">{result.analysis.product_name_ko}</p>
              )}
              <p className="text-sm text-white/40">{result.analysis.brand}</p>
              <span className="badge-blue text-[10px] mt-1 inline-block">{result.analysis.category}</span>
              {result.product_match && (
                <a
                  href={`/products/${result.product_match.id}`}
                  className="block mt-2 text-xs text-gold hover:text-gold font-medium"
                >
                  View in our database &rarr;
                </a>
              )}
            </div>
            <SafetyScoreRing score={result.analysis.overall_safety_score} />
          </div>

          {/* Key highlights */}
          {result.analysis.key_highlights.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="font-display font-semibold text-sm text-white mb-2">
                Key Highlights
              </h3>
              <ul className="flex flex-col gap-1.5">
                {result.analysis.key_highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {result.analysis.warnings.length > 0 && (
            <div className="glass-card p-4 border-amber-200 bg-amber-50/50">
              <h3 className="font-display font-semibold text-sm text-amber-800 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Warnings
              </h3>
              <ul className="flex flex-col gap-1.5">
                {result.analysis.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-700">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Routine Conflicts */}
          {result.conflicts?.length > 0 && (
            <div className="glass-card p-4 border-red-500/30 bg-red-500/5">
              <h3 className="font-display font-semibold text-sm text-red-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Routine Conflicts ({result.conflicts.length})
              </h3>
              <ul className="flex flex-col gap-3">
                {result.conflicts.map((c, i) => (
                  <li key={i} className="text-xs">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                        c.severity === 'high' ? 'bg-red-400' : c.severity === 'medium' ? 'bg-amber-400' : 'bg-yellow-400'
                      }`} />
                      <span className="font-medium text-white">
                        {c.scanned_ingredient} + {c.routine_ingredient}
                      </span>
                      <span className={`text-[10px] uppercase font-bold ${
                        c.severity === 'high' ? 'text-red-400' : c.severity === 'medium' ? 'text-amber-400' : 'text-yellow-400'
                      }`}>
                        {c.severity}
                      </span>
                    </div>
                    <p className="text-white/50 mb-1">{c.description}</p>
                    <p className="text-gold-light">{c.recommendation}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ingredients */}
          <div className="flex flex-col gap-2">
            <h3 className="font-display font-semibold text-sm text-white">
              Ingredients ({result.analysis.ingredients.length})
            </h3>
            {(showAllIngredients
              ? result.analysis.ingredients
              : result.analysis.ingredients.slice(0, 8)
            ).map((ing, idx) => (
              <div key={idx} className="glass-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-white/40 flex-shrink-0">
                        {idx + 1}
                      </span>
                      <p className="font-medium text-sm text-white truncate">
                        {ing.name_en}
                      </p>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5 ml-7">{ing.name_inci}</p>
                    <p className="text-[11px] text-white/40 ml-7">{ing.function}</p>
                  </div>
                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    ing.safety_rating >= 4 ? 'bg-green-100 text-green-700' :
                    ing.safety_rating >= 3 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    <Shield className="w-2.5 h-2.5" />
                    {ing.safety_rating}/5
                  </span>
                </div>
                {ing.concerns.length > 0 && (
                  <p className="text-[10px] text-amber-600 mt-1.5 ml-7">
                    {ing.concerns.join(', ')}
                  </p>
                )}
              </div>
            ))}

            {result.analysis.ingredients.length > 8 && (
              <button
                onClick={() => setShowAllIngredients(!showAllIngredients)}
                className="flex items-center justify-center gap-1 py-2 text-xs font-medium text-gold hover:text-gold transition-colors duration-200"
              >
                {showAllIngredients ? (
                  <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>Show all {result.analysis.ingredients.length} ingredients <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </button>
            )}
          </div>

          {/* Scan again */}
          <button
            onClick={resetScan}
            className="glass-button py-2.5 text-sm font-medium"
          >
            Scan Another Product
          </button>
        </div>
      )}
    </div>
  )
}
