'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
  Bell,
  Clock,
  MessageCircle,
  ShoppingBag,
  Eye,
} from 'lucide-react'
import {
  SectionHeader,
  PersonalizedMatch,
  EnrichmentPriceComparison,
  CommunityIntelligence,
  AuthenticityCheck,
  TrendContext,
} from '@/components/shared/EnrichmentSections'
import type { ScanEnrichment } from '@/lib/scanning/enrich-scan'

// ─── Types ─────────────────────────────────────────────────────────────

export interface ScannedIngredient {
  name_inci: string
  name_en: string
  name_ko: string | null
  function: string
  safety_rating: number
  comedogenic_rating: number
  concerns: string[]
}

export interface ScanAnalysis {
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

export interface IngredientConflict {
  scanned_ingredient: string
  routine_ingredient: string
  severity: string
  description: string
  recommendation: string
}

export interface ScanResultData {
  success: boolean
  analysis: ScanAnalysis
  product_match: { id: string; name_en: string; brand_en: string } | null
  conflicts: IngredientConflict[]
  enrichment: ScanEnrichment | null
}

interface ScanResultsProps {
  result: ScanResultData
  onReset: () => void
}

// ─── Safety Score Ring ─────────────────────────────────────────────────

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
          stroke="currentColor" strokeWidth="6" fill="none"
          className="text-white/5"
        />
        <circle
          cx="40" cy="40" r={radius}
          stroke={color} strokeWidth="6" fill="none"
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

// ─── Action Buttons ────────────────────────────────────────────────────

function ActionButtons({ productMatch, hasPricing }: {
  productMatch: ScanResultData['product_match']
  hasPricing: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => {/* TODO: add to routine action */}}
        className="glass-card p-3 flex flex-col items-center gap-1.5 hover:bg-white/10 transition-colors duration-200 active:scale-[0.98]"
      >
        <ShoppingBag className="w-5 h-5 text-gold" />
        <span className="text-[10px] font-medium text-white/70">Add to Routine</span>
      </button>

      {hasPricing && (
        <button
          onClick={() => {/* TODO: set price alert */}}
          className="glass-card p-3 flex flex-col items-center gap-1.5 hover:bg-white/10 transition-colors duration-200 active:scale-[0.98]"
        >
          <Bell className="w-5 h-5 text-gold" />
          <span className="text-[10px] font-medium text-white/70">Price Alert</span>
        </button>
      )}

      <button
        onClick={() => {
          if (productMatch) {
            window.location.href = `/yuri?ask=Tell me about ${encodeURIComponent(productMatch.name_en)}`
          }
        }}
        className="glass-card p-3 flex flex-col items-center gap-1.5 hover:bg-white/10 transition-colors duration-200 active:scale-[0.98]"
      >
        <MessageCircle className="w-5 h-5 text-gold" />
        <span className="text-[10px] font-medium text-white/70">Ask Yuri</span>
      </button>

      {productMatch && (
        <button
          onClick={async () => {
            try {
              const { supabase } = await import('@/lib/supabase')
              const { data: { session } } = await supabase.auth.getSession()
              if (!session?.access_token) return
              await fetch('/api/tracking', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ product_id: productMatch.id }),
              })
              alert('Product tracking started!')
            } catch { /* ignore */ }
          }}
          className="glass-card p-3 flex flex-col items-center gap-1.5 hover:bg-white/10 transition-colors duration-200 active:scale-[0.98]"
        >
          <Clock className="w-5 h-5 text-gold" />
          <span className="text-[10px] font-medium text-white/70">Track Expiry</span>
        </button>
      )}

      {productMatch && (
        <a
          href={`/products/${productMatch.id}`}
          className="glass-card p-3 flex flex-col items-center gap-1.5 hover:bg-white/10 transition-colors duration-200 active:scale-[0.98]"
        >
          <Eye className="w-5 h-5 text-gold" />
          <span className="text-[10px] font-medium text-white/70">Full Details</span>
        </a>
      )}
    </div>
  )
}

// ─── Main ScanResults Component ────────────────────────────────────────

export default function ScanResults({ result, onReset }: ScanResultsProps) {
  const [showAllIngredients, setShowAllIngredients] = useState(false)
  const enrichment = result.enrichment

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* ── Product Identification ────────────────────────────────── */}
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
              className="block mt-2 text-xs text-gold hover:text-gold-light font-medium"
            >
              View in our database &rarr;
            </a>
          )}
        </div>
        <SafetyScoreRing score={result.analysis.overall_safety_score} />
      </div>

      {/* ── Personalized Match (Your Skin) ────────────────────────── */}
      {enrichment?.personalization && (
        <PersonalizedMatch data={enrichment.personalization} />
      )}

      {/* ── Trend Context ─────────────────────────────────────────── */}
      {enrichment?.trending && (
        <TrendContext data={enrichment.trending} />
      )}

      {/* ── Key Highlights ────────────────────────────────────────── */}
      {result.analysis.key_highlights.length > 0 && (
        <div className="glass-card p-4">
          <SectionHeader icon={CheckCircle2} title="Key Highlights" />
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

      {/* ── Warnings ──────────────────────────────────────────────── */}
      {result.analysis.warnings.length > 0 && (
        <div className="glass-card p-4 border-amber-200 bg-amber-50/50">
          <SectionHeader icon={AlertTriangle} title="Warnings" color="text-amber-800" />
          <ul className="flex flex-col gap-1.5">
            {result.analysis.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-700">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Routine Conflicts ─────────────────────────────────────── */}
      {result.conflicts?.length > 0 && (
        <div className="glass-card p-4 border-red-500/30 bg-red-500/5">
          <SectionHeader icon={AlertTriangle} title={`Routine Conflicts (${result.conflicts.length})`} color="text-red-400" />
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

      {/* ── Action Buttons ────────────────────────────────────────── */}
      <ActionButtons
        productMatch={result.product_match}
        hasPricing={!!enrichment?.pricing}
      />

      {/* ── Price Comparison ──────────────────────────────────────── */}
      {enrichment?.pricing && (
        <EnrichmentPriceComparison data={enrichment.pricing} />
      )}

      {/* ── Community Intelligence ────────────────────────────────── */}
      {enrichment?.community && (
        <CommunityIntelligence data={enrichment.community} />
      )}

      {/* ── Authenticity Check ────────────────────────────────────── */}
      {enrichment?.counterfeit && (
        <AuthenticityCheck data={enrichment.counterfeit} />
      )}

      {/* ── Ingredients ───────────────────────────────────────────── */}
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
            className="flex items-center justify-center gap-1 py-2 text-xs font-medium text-gold hover:text-gold-light transition-colors duration-200"
          >
            {showAllIngredients ? (
              <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
            ) : (
              <>Show all {result.analysis.ingredients.length} ingredients <ChevronDown className="w-3.5 h-3.5" /></>
            )}
          </button>
        )}
      </div>

      {/* ── Scan Another ──────────────────────────────────────────── */}
      <button
        onClick={onReset}
        className="glass-button py-2.5 text-sm font-medium"
      >
        Scan Another Product
      </button>
    </div>
  )
}
