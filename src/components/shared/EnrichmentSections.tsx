'use client'

import {
  CheckCircle2,
  AlertTriangle,
  Star,
  DollarSign,
  Users,
  ShieldCheck,
  TrendingUp,
  ExternalLink,
  Heart,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Flame,
  Eye,
} from 'lucide-react'
import type {
  PersonalizationData,
  PricingData,
  CommunityData,
  CounterfeitData,
  TrendingData,
} from '@/lib/scanning/enrich-scan'

// ─── Section Header ────────────────────────────────────────────────────

export function SectionHeader({ icon: Icon, title, color = 'text-white' }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  color?: string
}) {
  return (
    <h3 className={`font-display font-semibold text-sm ${color} mb-2.5 flex items-center gap-1.5`}>
      <Icon className="w-4 h-4" />
      {title}
    </h3>
  )
}

// ─── Personalized Match Section ────────────────────────────────────────

export function PersonalizedMatch({ data }: { data: PersonalizationData }) {
  const hasWarnings = data.personalized_warnings.length > 0
  const hasNotes = data.skin_match_notes.length > 0

  if (!hasWarnings && !hasNotes) return null

  return (
    <div className="glass-card p-4">
      <SectionHeader icon={Sparkles} title={`Your Skin Match (${data.skin_type})`} color="text-gold-light" />

      {data.allergies.length > 0 && data.personalized_warnings.some(w => w.includes('allergy')) && (
        <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[11px] font-semibold text-red-400 flex items-center gap-1 mb-1">
            <AlertTriangle className="w-3 h-3" />
            Allergy Alert
          </p>
          {data.personalized_warnings
            .filter(w => w.includes('allergy'))
            .map((w, i) => (
              <p key={i} className="text-[11px] text-red-300/80">{w}</p>
            ))}
        </div>
      )}

      {hasWarnings && (
        <div className="mb-2.5">
          {data.personalized_warnings
            .filter(w => !w.includes('allergy'))
            .map((w, i) => (
              <div key={i} className="flex items-start gap-2 mb-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/80">{w}</p>
              </div>
            ))}
        </div>
      )}

      {hasNotes && (
        <div className="space-y-1.5">
          {data.skin_match_notes.map((note, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-green-300/80">{note}</p>
            </div>
          ))}
        </div>
      )}

      {data.concerns.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.concerns.map((concern, i) => (
            <span key={i} className="badge-gold text-[10px]">{concern}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Price Comparison Section ──────────────────────────────────────────

export function EnrichmentPriceComparison({ data }: { data: PricingData }) {
  if (!data.prices.length) return null

  return (
    <div className="glass-card p-4">
      <SectionHeader icon={DollarSign} title="Price Comparison" />

      {data.best_deal && data.best_deal.savings_vs_max > 0 && (
        <div className="mb-3 p-2.5 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-400" />
          <div>
            <p className="text-[11px] font-semibold text-green-400">
              Best deal: ${data.best_deal.price_usd.toFixed(2)} at {data.best_deal.retailer}
            </p>
            <p className="text-[10px] text-green-400/60">
              Save {data.best_deal.savings_vs_max}% vs highest price
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data.prices.slice(0, 5).map((price, i) => (
          <div
            key={i}
            className={`flex items-center justify-between p-2 rounded-lg ${
              i === 0 ? 'bg-white/5' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white font-medium">{price.retailer}</span>
              {price.is_authorized && (
                <ShieldCheck className="w-3 h-3 text-green-400" />
              )}
              {price.trust_score !== null && price.trust_score >= 90 && (
                <span className="text-[9px] text-green-400/60">Trusted</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[12px] font-semibold ${
                price.in_stock ? 'text-white' : 'text-white/30 line-through'
              }`}>
                ${price.price_usd.toFixed(2)}
              </span>
              {!price.in_stock && (
                <span className="text-[9px] text-red-400">Out of stock</span>
              )}
              {price.url && price.in_stock && (
                <a
                  href={price.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold hover:text-gold-light"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Community Intelligence Section ────────────────────────────────────

export function CommunityIntelligence({ data }: { data: CommunityData }) {
  return (
    <div className="glass-card p-4">
      <SectionHeader icon={Users} title="Community Intelligence" />

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        {/* Overall rating */}
        <div className="p-2.5 rounded-xl bg-white/5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Star className="w-3.5 h-3.5 text-gold fill-gold" />
            <span className="text-lg font-bold text-white">{data.avg_rating}</span>
          </div>
          <p className="text-[10px] text-white/40">{data.total_reviews} reviews</p>
        </div>

        {/* Skin type match */}
        {data.skin_type_avg_rating !== null ? (
          <div className="p-2.5 rounded-xl bg-gold/10 border border-gold/20 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Star className="w-3.5 h-3.5 text-gold fill-gold" />
              <span className="text-lg font-bold text-gold-light">{data.skin_type_avg_rating}</span>
            </div>
            <p className="text-[10px] text-gold/60">Your skin type ({data.skin_type_reviews})</p>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-white/5 text-center">
            <p className="text-[11px] text-white/40 mt-2">No reviews from your skin type yet</p>
          </div>
        )}
      </div>

      {/* Reaction stats */}
      <div className="flex items-center gap-3 mb-2">
        {data.holy_grail_count > 0 && (
          <div className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-pink-400 fill-pink-400" />
            <span className="text-[11px] text-white/70">{data.holy_grail_count} Holy Grail</span>
          </div>
        )}
        {data.broke_me_out_count > 0 && (
          <div className="flex items-center gap-1">
            <ThumbsDown className="w-3 h-3 text-red-400" />
            <span className="text-[11px] text-white/70">{data.broke_me_out_count} Broke Out</span>
          </div>
        )}
      </div>

      {/* Repurchase + effectiveness */}
      <div className="space-y-1.5">
        {data.would_repurchase_pct !== null && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/50">Would repurchase</span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-400 transition-all duration-500"
                  style={{ width: `${data.would_repurchase_pct}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-green-400">{data.would_repurchase_pct}%</span>
            </div>
          </div>
        )}
        {data.effectiveness_score !== null && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/50">
              Effectiveness
              {data.effectiveness_sample_size > 0 && (
                <span className="text-white/30"> (n={data.effectiveness_sample_size})</span>
              )}
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gold transition-all duration-500"
                  style={{ width: `${data.effectiveness_score}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-gold">{data.effectiveness_score}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Authenticity Check Section ────────────────────────────────────────

export function AuthenticityCheck({ data }: { data: CounterfeitData }) {
  const hasMarkers = data.markers.length > 0
  const hasRetailers = data.verified_retailers.length > 0

  if (!hasMarkers && !hasRetailers) return null

  return (
    <div className="glass-card p-4">
      <SectionHeader icon={ShieldCheck} title="Authenticity Check" color="text-green-400" />

      {data.counterfeit_report_count > 0 && (
        <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-[11px] text-amber-400 flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {data.counterfeit_report_count} counterfeit report{data.counterfeit_report_count > 1 ? 's' : ''} filed for this brand
          </p>
        </div>
      )}

      {hasMarkers && (
        <div className="mb-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Things to check</p>
          <div className="space-y-2">
            {data.markers.map((marker, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                  marker.severity === 'high' ? 'bg-red-400' :
                  marker.severity === 'medium' ? 'bg-amber-400' : 'bg-yellow-400'
                }`} />
                <div>
                  <p className="text-[11px] text-white/70 font-medium">{marker.marker_type}</p>
                  <p className="text-[10px] text-white/40">{marker.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasRetailers && (
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Verified retailers</p>
          <div className="flex flex-wrap gap-1.5">
            {data.verified_retailers.map((r, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${
                  r.is_authorized
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-white/5 text-white/50 border border-white/10'
                }`}
              >
                {r.is_authorized && <ShieldCheck className="w-2.5 h-2.5" />}
                {r.name}
                {r.trust_score >= 90 && <span className="text-green-400/60">{r.trust_score}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Trend Context Section ─────────────────────────────────────────────

export function TrendContext({ data }: { data: TrendingData }) {
  if (!data.is_trending) return null

  return (
    <div className="glass-card p-4 border-gold/20">
      <SectionHeader icon={TrendingUp} title="Trending Now" color="text-gold-light" />

      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[12px] font-semibold text-white">Trend Score: {data.trend_score}</span>
        </div>
        {data.source && (
          <span className="badge-gold text-[10px]">{data.source}</span>
        )}
        {data.sentiment_score !== null && (
          <div className="flex items-center gap-1">
            <ThumbsUp className="w-3 h-3 text-green-400" />
            <span className="text-[10px] text-white/50">
              {Math.round(data.sentiment_score * 100)}% positive
            </span>
          </div>
        )}
      </div>

      {data.trend_signals.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {data.trend_signals.map((signal, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                signal.status === 'peak' ? 'bg-orange-500/20 text-orange-400' :
                signal.status === 'growing' ? 'bg-green-500/20 text-green-400' :
                'bg-gold/20 text-gold'
              }`}>
                {signal.status}
              </span>
              <span className="text-[11px] text-white/70">{signal.trend_name}</span>
              <span className="text-[9px] text-white/30">{signal.source}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
