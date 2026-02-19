'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  Camera,
  Upload,
  X,
  Loader2,
  AlertTriangle,
  Sparkles,
  History,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import ScoreRadarChart from '@/components/glass-skin/ScoreRadarChart'
import ProgressTimeline from '@/components/glass-skin/ProgressTimeline'
import ShareCard from '@/components/glass-skin/ShareCard'
import type { GlassSkinScore, GlassSkinDimension } from '@/types/database'

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

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Glass Skin Goals'
  if (score >= 80) return 'Almost Glass'
  if (score >= 70) return 'Glowing'
  if (score >= 60) return 'Getting There'
  if (score >= 50) return 'On the Journey'
  if (score >= 40) return 'Building Foundation'
  return 'Just Starting'
}

function getLowestDimension(score: GlassSkinScore): { key: GlassSkinDimension; value: number } {
  const dims: { key: GlassSkinDimension; value: number }[] = [
    { key: 'luminosity', value: score.luminosity_score },
    { key: 'smoothness', value: score.smoothness_score },
    { key: 'clarity', value: score.clarity_score },
    { key: 'hydration', value: score.hydration_score },
    { key: 'evenness', value: score.evenness_score },
  ]
  return dims.reduce((lowest, dim) => dim.value < lowest.value ? dim : lowest)
}

export default function GlassSkinPage() {
  const { user } = useAuth()
  const [image, setImage] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<GlassSkinScore | null>(null)
  const [previous, setPrevious] = useState<GlassSkinScore | null>(null)
  const [comparison, setComparison] = useState<{
    score_change: number
    improved_dimensions: GlassSkinDimension[]
    declined_dimensions: GlassSkinDimension[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<GlassSkinScore[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Load score history
  useEffect(() => {
    async function loadHistory() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch('/api/skin-score?limit=20', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setHistory(data.scores || [])
        }
      } catch {
        // Non-critical
      } finally {
        setHistoryLoading(false)
      }
    }
    loadHistory()
  }, [])

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
        setComparison(null)
        setPrevious(null)
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
        setError('Please sign in to use Glass Skin Score.')
        return
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)

      const res = await fetch('/api/skin-score', {
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

      const data = await res.json()
      setResult(data.score)
      setPrevious(data.previous || null)
      setComparison(data.comparison || null)

      // Update history
      if (data.saved && data.score) {
        setHistory(prev => [data.score, ...prev])
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Analysis timed out. Please try again with a clearer photo.')
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
    setComparison(null)
    setPrevious(null)
    setError(null)
  }

  const lowestDim = result ? getLowestDimension(result) : null

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      {/* Header */}
      <section>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gold" />
          <h1 className="font-display font-bold text-2xl text-white">
            Glass Skin Score
          </h1>
        </div>
        <p className="text-white/40 text-sm mt-1">
          Track your journey to 유리 피부 — luminous, poreless, translucent skin
        </p>
      </section>

      {/* Result display */}
      {result && (
        <section className="space-y-5">
          {/* Overall score hero */}
          <div className="glass-card-strong p-6 text-center">
            <div className="relative inline-flex items-center justify-center w-28 h-28 mb-3">
              {/* Score ring */}
              <svg className="absolute inset-0 w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                <circle
                  cx="56" cy="56" r="50"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="6"
                />
                <circle
                  cx="56" cy="56" r="50"
                  fill="none"
                  stroke="#D4A574"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(result.overall_score / 100) * 314} 314`}
                />
              </svg>
              <span className="text-4xl font-bold bg-gradient-to-r from-gold to-gold-light bg-clip-text text-transparent">
                {result.overall_score}
              </span>
            </div>

            <p className="font-display font-semibold text-base text-white">
              {getScoreLabel(result.overall_score)}
            </p>

            {comparison && comparison.score_change !== 0 && (
              <p className={`text-sm mt-1 font-medium ${
                comparison.score_change > 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {comparison.score_change > 0 ? '+' : ''}{comparison.score_change} from last check
              </p>
            )}
          </div>

          {/* Radar chart */}
          <div className="glass-card p-4">
            <ScoreRadarChart
              score={result}
              previous={previous}
            />
          </div>

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div className="glass-card p-4 space-y-3">
              <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gold" />
                Recommendations
              </h3>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                    <span className="text-gold mt-0.5 flex-shrink-0">
                      {i + 1}.
                    </span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>

              {lowestDim && (
                <Link
                  href={`/yuri?ask=Help me improve my ${lowestDim.key} score (currently ${lowestDim.value}/100). What K-beauty products and routine steps would you recommend?`}
                  className="flex items-center justify-center gap-2 mt-3 py-2 rounded-xl bg-gold/10 text-gold text-xs font-medium hover:bg-gold/20 transition-colors duration-200"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Ask Yuri to improve your {lowestDim.key}
                </Link>
              )}
            </div>
          )}

          {/* Analysis notes */}
          {result.analysis_notes && (
            <div className="glass-card p-4">
              <p className="text-xs text-white/50 leading-relaxed">
                {result.analysis_notes}
              </p>
            </div>
          )}

          {/* Share & actions */}
          <ShareCard score={result} />

          {/* Scan again */}
          <button
            onClick={resetAnalysis}
            className="w-full glass-card py-3 text-sm font-medium text-white/60 hover:text-white transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Take Another Photo
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
                    Take a Selfie
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    Clean face, natural light, no makeup for best results
                  </p>
                </div>
              </button>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
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
                  Tips for accurate results
                </h3>
                <ul className="space-y-1.5 text-xs text-white/40">
                  <li>Clean, bare face — no makeup or filters</li>
                  <li>Natural, even lighting — face a window</li>
                  <li>Front-facing close-up — chin to forehead visible</li>
                  <li>Consistent conditions for tracking over time</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Image preview */}
              <div className="relative glass-card overflow-hidden">
                <img
                  src={image}
                  alt="Skin photo for analysis"
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
                  <Sparkles className="w-5 h-5" />
                  Analyze My Skin
                </button>
              )}

              {/* Analyzing state */}
              {analyzing && (
                <div className="glass-card p-6 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-gold" />
                  <p className="font-display font-semibold text-sm text-white">
                    Analyzing your glass skin...
                  </p>
                  <p className="text-xs text-white/40">
                    Scoring luminosity, smoothness, clarity, hydration, evenness
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

      {/* Score History */}
      <section>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full mb-3"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gold" strokeWidth={1.75} />
            <h2 className="font-display font-semibold text-base text-white">
              Progress History
            </h2>
            {history.length > 0 && (
              <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">
                {history.length}
              </span>
            )}
          </div>
          {showHistory ? (
            <ChevronUp className="w-4 h-4 text-white/30" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/30" />
          )}
        </button>

        {showHistory && (
          historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gold/40" />
            </div>
          ) : history.length === 0 ? (
            <div className="glass-card p-4 text-center">
              <p className="text-sm text-white/40">
                No scores yet. Take your first Glass Skin photo to start tracking!
              </p>
            </div>
          ) : (
            <ProgressTimeline scores={history} />
          )
        )}
      </section>

      {/* Bottom spacer for mobile nav */}
      <div className="h-4" />
    </div>
  )
}
