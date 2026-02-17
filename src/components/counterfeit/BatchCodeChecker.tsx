'use client'

import { useState, useCallback } from 'react'
import {
  Hash,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Calendar,
  HelpCircle,
} from 'lucide-react'

interface BatchVerification {
  brand: string
  batch_code: string
  manufacture_date: string | null
  expiry_date: string | null
  factory_location: string | null
  product_line: string | null
  is_expired: boolean
  age_months: number | null
  is_valid: boolean | null
  confidence: number
  notes: string
}

interface VerifyResponse {
  success: boolean
  verification: BatchVerification
}

const POPULAR_BRANDS = [
  'COSRX', 'Sulwhasoo', 'Laneige', 'Innisfree', 'Etude', 'Dr. Jart+',
  'Missha', 'Benton', 'Klairs', 'Beauty of Joseon', 'Torriden', 'Anua',
  'Isntree', 'Round Lab', 'Skin1004', 'Some By Mi',
]

export default function BatchCodeChecker() {
  const [brand, setBrand] = useState('')
  const [batchCode, setBatchCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCheck = useCallback(async () => {
    if (!brand.trim() || !batchCode.trim()) {
      setError('Please enter both brand and batch code.')
      return
    }
    setChecking(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/scan/batch-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: brand.trim(), batch_code: batchCode.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Batch code check failed')
      }
      setResult(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify batch code')
    } finally {
      setChecking(false)
    }
  }, [brand, batchCode])

  const reset = () => {
    setBrand('')
    setBatchCode('')
    setResult(null)
    setError(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {!result ? (
        <>
          {/* Brand input with suggestions */}
          <div className="glass-card p-4">
            <label className="text-xs font-medium text-seoul-charcoal block mb-1.5">
              Brand
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Enter brand name..."
              className="w-full px-3 py-2 rounded-lg bg-seoul-pearl text-sm text-seoul-charcoal placeholder-seoul-soft border border-transparent focus:border-rose-gold/30 focus:outline-none transition-colors"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {POPULAR_BRANDS.filter(b => !brand || b.toLowerCase().includes(brand.toLowerCase())).slice(0, 8).map(b => (
                <button
                  key={b}
                  onClick={() => setBrand(b)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                    brand === b
                      ? 'bg-rose-gold text-white'
                      : 'bg-seoul-pearl text-seoul-soft hover:bg-rose-gold/10 hover:text-rose-gold'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Batch code input */}
          <div className="glass-card p-4">
            <label className="text-xs font-medium text-seoul-charcoal block mb-1.5">
              Batch Code
            </label>
            <input
              type="text"
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              placeholder="e.g. K2411053, C240815..."
              className="w-full px-3 py-2.5 rounded-lg bg-seoul-pearl text-sm text-seoul-charcoal placeholder-seoul-soft border border-transparent focus:border-rose-gold/30 focus:outline-none font-mono tracking-wider"
            />
            <p className="text-[10px] text-seoul-soft mt-1.5">
              Usually printed or stamped on the bottom, back, or crimp of the product
            </p>
          </div>

          <button
            onClick={handleCheck}
            disabled={checking || !brand.trim() || !batchCode.trim()}
            className="glass-button-primary py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Decoding...
              </>
            ) : (
              <>
                <Hash className="w-4 h-4" />
                Verify Batch Code
              </>
            )}
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-3 animate-fade-in">
          {/* Header */}
          <div className="glass-card-strong p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-display font-bold text-base text-seoul-charcoal">{result.verification.brand}</p>
                <p className="text-sm text-seoul-soft font-mono">{result.verification.batch_code}</p>
              </div>
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                result.verification.is_valid === true ? 'bg-green-100 text-green-700' :
                result.verification.is_valid === false ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {result.verification.is_valid === true ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 result.verification.is_valid === false ? <XCircle className="w-3.5 h-3.5" /> :
                 <HelpCircle className="w-3.5 h-3.5" />}
                {result.verification.is_valid === true ? 'Valid Format' :
                 result.verification.is_valid === false ? 'Suspicious' :
                 'Unknown Format'}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-seoul-soft">
              Confidence: {result.verification.confidence}/10
              <div className="flex-1 h-1 bg-seoul-pearl rounded-full overflow-hidden ml-1">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    result.verification.confidence >= 7 ? 'bg-green-500' :
                    result.verification.confidence >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${(result.verification.confidence / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Decoded info */}
          <div className="glass-card p-4">
            <h3 className="font-display font-semibold text-sm text-seoul-charcoal mb-3">Decoded Information</h3>
            <div className="grid grid-cols-2 gap-3">
              {result.verification.manufacture_date && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-rose-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-seoul-soft">Manufactured</p>
                    <p className="text-xs font-medium text-seoul-charcoal">{result.verification.manufacture_date}</p>
                  </div>
                </div>
              )}
              {result.verification.expiry_date && (
                <div className="flex items-start gap-2">
                  <Clock className={`w-4 h-4 flex-shrink-0 mt-0.5 ${result.verification.is_expired ? 'text-red-500' : 'text-green-500'}`} />
                  <div>
                    <p className="text-[10px] text-seoul-soft">Expires</p>
                    <p className={`text-xs font-medium ${result.verification.is_expired ? 'text-red-600' : 'text-seoul-charcoal'}`}>
                      {result.verification.expiry_date}
                      {result.verification.is_expired && ' (EXPIRED)'}
                    </p>
                  </div>
                </div>
              )}
              {result.verification.factory_location && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-rose-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-seoul-soft">Factory</p>
                    <p className="text-xs font-medium text-seoul-charcoal">{result.verification.factory_location}</p>
                  </div>
                </div>
              )}
              {result.verification.age_months !== null && (
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-rose-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-seoul-soft">Product Age</p>
                    <p className="text-xs font-medium text-seoul-charcoal">{result.verification.age_months} months</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expiry warning */}
          {result.verification.is_expired && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              This product appears to be expired. Expired products may be less effective or cause skin reactions.
            </div>
          )}

          {/* Notes */}
          <div className="glass-card p-4">
            <h3 className="font-display font-semibold text-sm text-seoul-charcoal mb-1.5">Notes</h3>
            <p className="text-xs text-seoul-charcoal leading-relaxed">{result.verification.notes}</p>
          </div>

          <button onClick={reset} className="glass-button py-2.5 text-sm font-medium">
            Check Another Code
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
