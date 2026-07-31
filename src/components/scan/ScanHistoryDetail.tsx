'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  MessageCircle,
  Package,
  ShoppingBag,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────

export interface ScannedIngredient {
  name_inci: string
  name_en: string | null
  name_ko: string | null
  function: string | null
  safety_rating: number | null
  comedogenic_rating: number | null
  concerns: string[] | null
}

export interface StoredScan {
  id: string
  scanned_at: string
  product_id: string | null
  product: { id: string; name_en: string | null; brand_en: string | null } | null
  analysis: {
    product_name_en?: string
    brand?: string
    category?: string
    ingredients?: ScannedIngredient[]
    overall_safety_score?: number
    key_highlights?: string[]
    warnings?: string[]
  }
  conflicts: Array<{
    scanned_ingredient: string
    routine_ingredient: string
    severity: string
    description: string
    recommendation: string
  }>
}

// ─── Safety score ring ─────────────────────────────────────────────────

function SafetyScoreRing({ score }: { score: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'

  return (
    <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="6" fill="none" className="text-white/5" />
        <circle
          cx="40" cy="40" r={radius}
          stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold text-xl" style={{ color }}>{score}</span>
        <span className="text-[9px] text-white/40">Safety</span>
      </div>
    </div>
  )
}

// ─── Ingredient row ────────────────────────────────────────────────────

function IngredientRow({ ing }: { ing: ScannedIngredient }) {
  const safety = ing.safety_rating
  const safetyColor =
    typeof safety !== 'number' ? 'text-white/30'
      : safety >= 8 ? 'text-emerald-400'
      : safety >= 5 ? 'text-yellow-400'
      : 'text-red-400'

  return (
    <div className="py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white font-medium">{ing.name_inci}</p>
          {ing.name_en && ing.name_en !== ing.name_inci && (
            <p className="text-[11px] text-white/40 mt-0.5">{ing.name_en}</p>
          )}
          {ing.function && (
            <p className="text-[11px] text-white/50 mt-1">{ing.function}</p>
          )}
          {ing.concerns && ing.concerns.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {ing.concerns.map((c, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300/80">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {typeof safety === 'number' && (
            <p className={`text-sm font-semibold ${safetyColor}`}>{safety}<span className="text-white/20 text-[10px]">/10</span></p>
          )}
          {typeof ing.comedogenic_rating === 'number' && (
            <p className="text-[9px] text-white/30 mt-0.5">Comedo {ing.comedogenic_rating}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────

export default function ScanHistoryDetail({ scan }: { scan: StoredScan }) {
  const a = scan.analysis
  const productName = a.product_name_en || scan.product?.name_en || 'Unknown Product'
  const brand = a.brand || scan.product?.brand_en || ''
  const ingredients = a.ingredients ?? []
  const warnings = a.warnings ?? []
  const highlights = a.key_highlights ?? []
  const score = a.overall_safety_score

  const scannedOn = new Date(scan.scanned_at).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const askYuri = `/yuri?ask=${encodeURIComponent(
    `I scanned ${brand ? `${brand} ` : ''}${productName} on ${scannedOn}. Can you walk me through what it means for my skin?`
  )}`

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="glass-card p-4">
        <div className="flex items-start gap-4">
          {typeof score === 'number' && <SafetyScoreRing score={score} />}
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-lg text-white leading-tight">{productName}</h1>
            {brand && <p className="text-sm text-white/50 mt-0.5">{brand}</p>}
            {a.category && (
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50">
                {a.category}
              </span>
            )}
            <p className="flex items-center gap-1.5 text-[11px] text-white/40 mt-2">
              <Clock className="w-3 h-3" />
              Scanned {scannedOn}
            </p>
          </div>
        </div>
      </div>

      {/* Snapshot notice — this page is a record, not a live re-analysis. */}
      <div className="glass-card p-3 flex items-start gap-2.5">
        <Camera className="w-4 h-4 text-gold/60 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-white/50 leading-relaxed">
          This is the analysis as it was recorded on {scannedOn}. Prices, stock and
          community data change over time, so they aren&apos;t shown here — check the
          product page for current pricing, or ask Yuri how this fits your routine today.
        </p>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="font-display font-semibold text-sm text-white">Warnings</h2>
          </div>
          <ul className="flex flex-col gap-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-white/70 leading-relaxed">• {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h2 className="font-display font-semibold text-sm text-white">Key Highlights</h2>
          </div>
          <ul className="flex flex-col gap-1.5">
            {highlights.map((h, i) => (
              <li key={i} className="text-xs text-white/70 leading-relaxed">• {h}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Conflicts recorded at scan time */}
      {scan.conflicts.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="font-display font-semibold text-sm text-white">
              Routine Conflicts ({scan.conflicts.length})
            </h2>
          </div>
          <p className="text-[10px] text-white/35 mb-2.5">
            Checked against your routine on {scannedOn}. Your routine may have changed since.
          </p>
          <div className="flex flex-col gap-2.5">
            {scan.conflicts.map((c, i) => (
              <div key={i} className="rounded-lg bg-red-500/5 border border-red-500/15 p-2.5">
                <p className="text-xs text-white font-medium">
                  {c.scanned_ingredient} + {c.routine_ingredient}
                </p>
                <p className="text-[11px] text-white/60 mt-1 leading-relaxed">{c.description}</p>
                {c.recommendation && (
                  <p className="text-[11px] text-gold-light/80 mt-1 leading-relaxed">{c.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ingredients */}
      <div className="glass-card p-4">
        <h2 className="font-display font-semibold text-sm text-white mb-1">
          Ingredients ({ingredients.length})
        </h2>
        {ingredients.length === 0 ? (
          <p className="text-xs text-white/40 mt-2">
            No ingredients were extracted from this scan.
          </p>
        ) : (
          <div className="mt-1">
            {ingredients.map((ing, i) => (
              <IngredientRow key={`${ing.name_inci}-${i}`} ing={ing} />
            ))}
          </div>
        )}
      </div>

      {/* Actions — live surfaces, not stored snapshots */}
      <div className="flex flex-col gap-2">
        <Link
          href={askYuri}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold hover:shadow-glow-gold transition-all duration-200"
        >
          <MessageCircle className="w-4 h-4" />
          Ask Yuri about this
        </Link>

        {scan.product_id && (
          <Link
            href={`/products/${scan.product_id}`}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors duration-200"
          >
            <ShoppingBag className="w-4 h-4" />
            View product page &amp; current prices
          </Link>
        )}

        <Link
          href="/scan"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors duration-200"
        >
          <Package className="w-4 h-4" />
          Scan another product
        </Link>
      </div>
    </div>
  )
}
