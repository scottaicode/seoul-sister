'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Flag,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Camera,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const PLATFORMS = [
  'Amazon',
  'eBay',
  'Wish',
  'Temu',
  'AliExpress',
  'Facebook Marketplace',
  'Instagram Shop',
  'TikTok Shop',
  'Other Online',
  'Physical Store',
]

export default function CounterfeitReportForm() {
  const { user } = useAuth()
  const [brand, setBrand] = useState('')
  const [description, setDescription] = useState('')
  const [sellerName, setSellerName] = useState('')
  const [platform, setPlatform] = useState('')
  const [purchaseUrl, setPurchaseUrl] = useState('')
  const [batchCode, setBatchCode] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageAdd = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Each image must be under 5MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      setImages(prev => [...prev, e.target?.result as string])
    }
    reader.readAsDataURL(file)
  }, [])

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = useCallback(async () => {
    if (!description.trim()) {
      setError('Please describe what makes you think this product is counterfeit.')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/counterfeit/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          image_urls: images,
          brand: brand.trim() || undefined,
          seller_name: sellerName.trim() || undefined,
          purchase_platform: platform || undefined,
          purchase_url: purchaseUrl.trim() || undefined,
          batch_code: batchCode.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit report')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }, [description, images, brand, sellerName, platform, purchaseUrl, batchCode])

  if (!user) {
    return (
      <div className="glass-card p-6 text-center">
        <Flag className="w-8 h-8 text-seoul-soft mx-auto mb-2" />
        <p className="text-sm text-seoul-charcoal font-medium">Sign in to report counterfeits</p>
        <p className="text-xs text-seoul-soft mt-1">Your reports help protect the K-beauty community.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="glass-card p-6 text-center animate-fade-in">
        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
        <p className="font-display font-semibold text-base text-seoul-charcoal">Report Submitted</p>
        <p className="text-xs text-seoul-soft mt-1 mb-4">
          Thank you for helping protect the K-beauty community. Our team will review your report.
        </p>
        <button
          onClick={() => {
            setSubmitted(false)
            setBrand('')
            setDescription('')
            setSellerName('')
            setPlatform('')
            setPurchaseUrl('')
            setBatchCode('')
            setImages([])
          }}
          className="glass-button py-2 text-xs font-medium"
        >
          Submit Another Report
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="glass-card p-3">
        <p className="text-xs text-seoul-soft leading-relaxed">
          <strong className="text-seoul-charcoal">Report a suspected counterfeit.</strong> Your reports are reviewed by our team and help protect other consumers. All reports are confidential.
        </p>
      </div>

      {/* Brand */}
      <div className="glass-card p-3">
        <label className="text-xs font-medium text-seoul-charcoal block mb-1">Brand</label>
        <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. COSRX, Laneige..." className="w-full px-3 py-2 rounded-lg bg-seoul-pearl text-sm text-seoul-charcoal placeholder-seoul-soft border border-transparent focus:border-rose-gold/30 focus:outline-none" />
      </div>

      {/* Description (required) */}
      <div className="glass-card p-3">
        <label className="text-xs font-medium text-seoul-charcoal block mb-1">
          What makes you think this is counterfeit? <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe packaging differences, texture, smell, or any red flags..."
          className="w-full px-3 py-2 rounded-lg bg-seoul-pearl text-sm text-seoul-charcoal placeholder-seoul-soft border border-transparent focus:border-rose-gold/30 focus:outline-none resize-none"
        />
      </div>

      {/* Where purchased */}
      <div className="glass-card p-3">
        <label className="text-xs font-medium text-seoul-charcoal block mb-1">Where did you buy it?</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PLATFORMS.map(p => (
            <button
              key={p}
              onClick={() => setPlatform(platform === p ? '' : p)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                platform === p ? 'bg-rose-gold text-white' : 'bg-seoul-pearl text-seoul-soft hover:bg-rose-gold/10'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input type="text" value={sellerName} onChange={(e) => setSellerName(e.target.value)} placeholder="Seller name (optional)" className="w-full px-3 py-2 rounded-lg bg-seoul-pearl text-sm text-seoul-charcoal placeholder-seoul-soft border border-transparent focus:border-rose-gold/30 focus:outline-none mb-2" />
        <input type="text" value={purchaseUrl} onChange={(e) => setPurchaseUrl(e.target.value)} placeholder="Product listing URL (optional)" className="w-full px-3 py-2 rounded-lg bg-seoul-pearl text-sm text-seoul-charcoal placeholder-seoul-soft border border-transparent focus:border-rose-gold/30 focus:outline-none" />
      </div>

      {/* Batch code */}
      <div className="glass-card p-3">
        <label className="text-xs font-medium text-seoul-charcoal block mb-1">Batch Code (if visible)</label>
        <input type="text" value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="e.g. K2411053" className="w-full px-3 py-2 rounded-lg bg-seoul-pearl text-sm text-seoul-charcoal placeholder-seoul-soft border border-transparent focus:border-rose-gold/30 focus:outline-none font-mono" />
      </div>

      {/* Images */}
      <div className="glass-card p-3">
        <label className="text-xs font-medium text-seoul-charcoal block mb-1.5">
          Photos (up to 4)
        </label>
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
              <img src={img} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
              <button onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {images.length < 4 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-seoul-pearl flex items-center justify-center hover:border-rose-gold/30 transition-colors"
            >
              <Camera className="w-5 h-5 text-seoul-soft" />
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageAdd(e.target.files[0])} />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !description.trim()}
        className="glass-button-primary py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Flag className="w-4 h-4" />
            Submit Report
          </>
        )}
      </button>
    </div>
  )
}
