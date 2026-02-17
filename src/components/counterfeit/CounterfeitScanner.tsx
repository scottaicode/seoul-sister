'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Camera,
  Upload,
  X,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type { CounterfeitFlag, CounterfeitRecommendation } from '@/types/database'

interface AnalysisResult {
  brand_detected: string | null
  product_detected: string | null
  authenticity_score: number
  red_flags: CounterfeitFlag[]
  green_flags: CounterfeitFlag[]
  analysis_summary: string
  recommendation: CounterfeitRecommendation
}

interface ScanResponse {
  success: boolean
  analysis: AnalysisResult
  product_match: { id: string; name_en: string; brand_en: string; image_url: string | null } | null
}

function AuthenticityScoreRing({ score }: { score: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 10) * circumference

  const color = score >= 8 ? '#22c55e' : score >= 6 ? '#eab308' : score >= 4 ? '#f97316' : '#ef4444'
  const label = score >= 8 ? 'Authentic' : score >= 6 ? 'Likely OK' : score >= 4 ? 'Caution' : 'Suspicious'

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="6" fill="none" className="text-seoul-pearl" />
        <circle cx="40" cy="40" r={radius} stroke={color} strokeWidth="6" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold text-xl" style={{ color }}>{score}/10</span>
        <span className="text-[9px] text-seoul-soft">{label}</span>
      </div>
    </div>
  )
}

function RecommendationBadge({ rec }: { rec: CounterfeitRecommendation }) {
  const config = {
    likely_authentic: { icon: ShieldCheck, label: 'Likely Authentic', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    suspicious: { icon: ShieldAlert, label: 'Suspicious', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    likely_counterfeit: { icon: XCircle, label: 'Likely Counterfeit', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    inconclusive: { icon: ShieldQuestion, label: 'Inconclusive', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  }

  const c = config[rec]
  const Icon = c.icon

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${c.bg} ${c.text} border ${c.border}`}>
      <Icon className="w-3.5 h-3.5" />
      {c.label}
    </div>
  )
}

export default function CounterfeitScanner() {
  const [image, setImage] = useState<string | null>(null)
  const [brand, setBrand] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResponse | null>(null)
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
    reader.onload = (e) => {
      setImage(e.target?.result as string)
      setResult(null)
      setError(null)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleScan = useCallback(async () => {
    if (!image) return
    setScanning(true)
    setError(null)

    try {
      const res = await fetch('/api/scan/counterfeit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, brand: brand || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Counterfeit scan failed')
      }
      setResult(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze product')
    } finally {
      setScanning(false)
    }
  }, [image, brand])

  const resetScan = () => {
    setImage(null)
    setResult(null)
    setError(null)
    setBrand('')
  }

  if (!image) {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="glass-card-strong p-6 flex flex-col items-center gap-3 hover:shadow-glass-lg transition-all duration-300 border-dashed border-2 border-rose-gold/30 group"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-gold to-rose-light flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <Shield className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="font-display font-semibold text-sm text-seoul-charcoal">
              Photograph Product
            </p>
            <p className="text-xs text-seoul-soft mt-0.5">
              Take a clear photo of packaging, label, or batch code
            </p>
          </div>
        </button>

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="glass-card p-3 flex items-center gap-3 hover:shadow-glass-lg transition-all duration-300"
        >
          <div className="w-9 h-9 rounded-xl bg-seoul-pearl flex items-center justify-center">
            <Upload className="w-4.5 h-4.5 text-rose-gold" strokeWidth={1.5} />
          </div>
          <div className="text-left">
            <p className="font-display font-semibold text-xs text-seoul-charcoal">Upload Photo</p>
            <p className="text-[11px] text-seoul-soft">From gallery or screenshots</p>
          </div>
        </button>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Image preview */}
      <div className="relative glass-card overflow-hidden">
        <img src={image} alt="Product for verification" className="w-full max-h-56 object-contain bg-seoul-pearl" />
        <button onClick={resetScan} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors duration-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Brand hint (optional) */}
      {!result && !scanning && (
        <>
          <div className="glass-card p-3">
            <label className="text-xs font-medium text-seoul-charcoal block mb-1.5">
              Brand name (optional, improves accuracy)
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. COSRX, Sulwhasoo, Laneige..."
              className="w-full px-3 py-2 rounded-lg bg-seoul-pearl text-sm text-seoul-charcoal placeholder-seoul-soft border border-transparent focus:border-rose-gold/30 focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={handleScan}
            className="glass-button-primary py-3 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Shield className="w-4.5 h-4.5" />
            Verify Authenticity
          </button>
        </>
      )}

      {/* Scanning state */}
      {scanning && (
        <div className="glass-card p-6 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-rose-gold" />
          <p className="font-display font-semibold text-sm text-seoul-charcoal">Analyzing packaging...</p>
          <p className="text-xs text-seoul-soft text-center">Checking fonts, labels, batch codes, regulatory markings</p>
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
        <div className="flex flex-col gap-3 animate-fade-in">
          {/* Score + recommendation */}
          <div className="glass-card-strong p-4 flex items-start gap-3">
            <AuthenticityScoreRing score={result.analysis.authenticity_score} />
            <div className="flex-1 min-w-0">
              {result.analysis.brand_detected && (
                <p className="font-display font-bold text-base text-seoul-charcoal">{result.analysis.brand_detected}</p>
              )}
              {result.analysis.product_detected && (
                <p className="text-sm text-seoul-soft">{result.analysis.product_detected}</p>
              )}
              <div className="mt-2">
                <RecommendationBadge rec={result.analysis.recommendation} />
              </div>
              {result.product_match && (
                <a href={`/products/${result.product_match.id}`} className="block mt-2 text-xs text-rose-gold hover:text-rose-dark font-medium">
                  View in our database &rarr;
                </a>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="glass-card p-4">
            <h3 className="font-display font-semibold text-sm text-seoul-charcoal mb-1.5">Analysis Summary</h3>
            <p className="text-xs text-seoul-charcoal leading-relaxed">{result.analysis.analysis_summary}</p>
          </div>

          {/* Red flags */}
          {result.analysis.red_flags.length > 0 && (
            <div className="glass-card p-4 border-red-200 bg-red-50/50">
              <h3 className="font-display font-semibold text-sm text-red-800 mb-2 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                Red Flags ({result.analysis.red_flags.length})
              </h3>
              <ul className="flex flex-col gap-2">
                {result.analysis.red_flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      flag.severity === 'critical' ? 'bg-red-200 text-red-800' :
                      flag.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                      flag.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-gray-200 text-gray-700'
                    }`}>
                      {flag.severity?.toUpperCase() || 'FLAG'}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-red-800">{flag.flag}</p>
                      <p className="text-[11px] text-red-700">{flag.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Green flags */}
          {result.analysis.green_flags.length > 0 && (
            <div className="glass-card p-4 border-green-200 bg-green-50/50">
              <h3 className="font-display font-semibold text-sm text-green-800 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Authenticity Indicators ({result.analysis.green_flags.length})
              </h3>
              <ul className="flex flex-col gap-1.5">
                {result.analysis.green_flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-green-500" />
                    <div>
                      <span className="font-medium">{flag.flag}:</span> {flag.description}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={resetScan} className="glass-button py-2.5 text-sm font-medium">
            Check Another Product
          </button>
        </div>
      )}
    </div>
  )
}
