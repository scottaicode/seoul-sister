'use client'

import { useState, useEffect } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ExternalLink,
  Globe,
  Loader2,
  Star,
  AlertTriangle,
} from 'lucide-react'

interface RetailerData {
  id: string
  name: string
  website: string
  country: string
  trust_score: number
  ships_international: boolean
  is_authorized: boolean
  authorized_brands: string[] | null
  risk_level: 'low' | 'medium' | 'high' | 'very_high' | null
  verification_notes: string | null
  counterfeit_report_count: number
}

function TrustScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-seoul-pearl rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold ${score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : score >= 40 ? 'text-orange-600' : 'text-red-600'}`}>
        {score}
      </span>
    </div>
  )
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return null
  const config: Record<string, { icon: typeof ShieldCheck; label: string; className: string }> = {
    low: { icon: ShieldCheck, label: 'Low Risk', className: 'bg-green-100 text-green-700' },
    medium: { icon: ShieldAlert, label: 'Medium Risk', className: 'bg-yellow-100 text-yellow-700' },
    high: { icon: ShieldX, label: 'High Risk', className: 'bg-orange-100 text-orange-700' },
    very_high: { icon: ShieldX, label: 'Very High Risk', className: 'bg-red-100 text-red-700' },
  }
  const c = config[level] || config.medium
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.className}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  )
}

export default function RetailerDirectory() {
  const [retailers, setRetailers] = useState<RetailerData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/retailers?sort=trust_score')
        if (!res.ok) throw new Error('Failed to load retailers')
        const data = await res.json()
        setRetailers(data.retailers || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-rose-gold" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    )
  }

  if (retailers.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <Globe className="w-8 h-8 text-seoul-soft mx-auto mb-2" />
        <p className="text-sm text-seoul-soft">No retailers in directory yet.</p>
        <p className="text-xs text-seoul-soft mt-1">Retailer data will be populated as the database grows.</p>
      </div>
    )
  }

  const authorized = retailers.filter(r => r.is_authorized)
  const others = retailers.filter(r => !r.is_authorized)

  return (
    <div className="flex flex-col gap-4">
      {/* Info card */}
      <div className="glass-card p-3">
        <p className="text-xs text-seoul-soft leading-relaxed">
          <strong className="text-seoul-charcoal">Trust scores</strong> are based on authorization status, counterfeit report history, and community feedback. Higher scores indicate safer purchasing.
        </p>
      </div>

      {/* Authorized retailers */}
      {authorized.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-sm text-seoul-charcoal mb-2 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            Authorized Retailers
          </h3>
          <div className="flex flex-col gap-2">
            {authorized.map(r => (
              <RetailerCard key={r.id} retailer={r} />
            ))}
          </div>
        </div>
      )}

      {/* Other retailers */}
      {others.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-sm text-seoul-charcoal mb-2 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-seoul-soft" />
            Other Retailers
          </h3>
          <div className="flex flex-col gap-2">
            {others.map(r => (
              <RetailerCard key={r.id} retailer={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RetailerCard({ retailer }: { retailer: RetailerData }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="glass-card p-3 hover:shadow-glass transition-shadow duration-200">
      <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-display font-semibold text-sm text-seoul-charcoal">{retailer.name}</p>
            {retailer.is_authorized && (
              <ShieldCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-seoul-soft">{retailer.country}</span>
            {retailer.ships_international && (
              <span className="text-[10px] text-blue-600 font-medium">Ships Intl</span>
            )}
            <RiskBadge level={retailer.risk_level} />
          </div>
          <div className="mt-1.5 w-32">
            <TrustScoreBar score={retailer.trust_score} />
          </div>
        </div>
        {retailer.website && (
          <a
            href={retailer.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-seoul-pearl flex items-center justify-center hover:bg-rose-gold/10 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5 text-seoul-soft" />
          </a>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-seoul-pearl animate-fade-in">
          {retailer.authorized_brands && retailer.authorized_brands.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] text-seoul-soft mb-1">Authorized for:</p>
              <div className="flex flex-wrap gap-1">
                {retailer.authorized_brands.map(b => (
                  <span key={b} className="px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-700 font-medium">{b}</span>
                ))}
              </div>
            </div>
          )}
          {retailer.verification_notes && (
            <p className="text-[11px] text-seoul-soft leading-relaxed">{retailer.verification_notes}</p>
          )}
          {retailer.counterfeit_report_count > 0 && (
            <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {retailer.counterfeit_report_count} counterfeit report{retailer.counterfeit_report_count !== 1 ? 's' : ''} filed
            </p>
          )}
        </div>
      )}
    </div>
  )
}
