'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  Lock,
  ArrowRight,
  Star,
  Package,
  Shield,
  FlaskConical,
  Sparkles,
} from 'lucide-react'
import ProductEnrichment from './ProductEnrichment'
import { PRICING } from '@/lib/pricing'

interface Props {
  productId: string
  productName: string | null
  productBrand: string | null
  ingredientCount: number
}

export default function ProductIntelligenceSection({ productId, productName, productBrand, ingredientCount }: Props) {
  // v10.8.11 (Bailey, "This isn't loading"): gate on the app-wide useAuth()
  // context instead of a one-shot supabase.auth.getSession() in this component.
  //
  // The bug: on the PUBLIC /products/[id] route (outside the authenticated
  // AppShell), the Supabase client often hasn't rehydrated the localStorage
  // session by the time a one-shot getSession() fires — so it returned null,
  // setIsSubscriber(false) ran, /api/me/subscription was NEVER called, and a
  // PAYING subscriber (Bailey, plan='pro_monthly') saw the anonymous
  // "Subscribe to unlock" GatedTeaser blur cards. Those blurred cards read as
  // skeleton placeholders stuck loading — hence "This isn't loading."
  //
  // This was the v10.7.0 Phase F bug only half-fixed: Phase F moved the
  // SUBSCRIPTION CHECK to a server endpoint (correct) but left the SESSION
  // DETECTION as a racy one-shot getSession(). useAuth() subscribes to
  // onAuthStateChange (via AuthContext), so it catches the session the moment
  // it hydrates — no race. We only decide subscriber state after auth.loading
  // settles; until then we render null (no flash), same as before.
  const { user, loading: authLoading } = useAuth()
  const [isSubscriber, setIsSubscriber] = useState<boolean | null>(null)

  useEffect(() => {
    // Wait for the auth context to finish hydrating before deciding anything.
    if (authLoading) return

    // No authenticated user — anonymous visitor, show gated teasers.
    if (!user) {
      setIsSubscriber(false)
      return
    }

    let cancelled = false

    async function checkSubscription() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          // user is set but session token unavailable — treat as non-subscriber
          if (!cancelled) setIsSubscriber(false)
          return
        }

        const res = await fetch('/api/me/subscription', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!cancelled) setIsSubscriber(false)
          return
        }
        const body = (await res.json()) as { active: boolean }
        if (!cancelled) setIsSubscriber(!!body.active)
      } catch {
        // Network failure — fail closed (treat as non-subscriber) rather than
        // accidentally flashing premium content to a non-subscriber.
        if (!cancelled) setIsSubscriber(false)
      }
    }

    checkSubscription()
    return () => {
      cancelled = true
    }
  }, [authLoading, user])

  // Still resolving auth or subscription — show nothing (avoids flash + the
  // "stuck loading" perception). The gated teasers only render once we KNOW
  // the visitor is not a subscriber.
  //
  // EXCEPT the free Yuri CTA, which is hoisted ABOVE this gate. Measured Aug 25
  // 2026: `/products/[id]` shipped ZERO `?ask=` links in its HTML on three
  // separate product ids. The anchor in `AskYuriAboutProduct` was always a
  // correct <Link> — it was simply unreachable, because `isSubscriber` starts
  // null and only resolves inside a useEffect, so this early return removed the
  // whole section from server-rendered markup. A correct link defeated by a
  // client-side auth gate.
  //
  // The CTA is safe to render before auth resolves because it is IDENTICAL for
  // every visitor: it points at the free landing widget and promises nothing
  // subscriber-only. Only the gated teasers below need to know who is asking.
  // (Consistent with `source='product'` measuring 3 visitors / 0 emails
  // lifetime — a CTA no crawler has ever seen.)
  if (authLoading || isSubscriber === null) {
    return (
      <div className="mb-8">
        <AskYuriAboutProduct productName={productName} productBrand={productBrand} />
      </div>
    )
  }

  // Subscriber — show full enrichment
  if (isSubscriber) {
    return (
      <div className="mb-8">
        <ProductEnrichment
          productId={productId}
          productName={productName ?? undefined}
          productBrand={productBrand ?? undefined}
        />
      </div>
    )
  }

  // Not a subscriber — show gated sections + subscribe CTA
  return (
    <>
      {/* FREE Yuri offer FIRST (Aug 18 2026). This COMPLETES d0f96f8 (Jul 27,
          "route AI-citation arrivals to free Yuri instead of a locked
          paywall"), which unlocked this card but left it FIFTH inside the
          gated container — so a stranger arriving from a citation about a
          specific product still met four "Subscribe to unlock" panels before
          the one thing that is free. Order is the whole fix: nothing new is
          promised, and the teasers plus the $-wall below are unchanged.

          NOT graded, and deliberately claims no conversion effect:
          source='product' is 3 visitors / 6 messages / 0 emails lifetime, and
          the one paying subscriber's visitor rows carry source=NULL — she
          arrived via the landing widget and converted off the recap email, so
          her path never touched this component. The justification is that
          showing locks before value is a rejection sequence, not a scarcity
          ladder — consistent with the v11.26.0 decision NOT to add a subscribe
          CTA at the widget close (selling orientation subtracts trust). */}
      <div className="mb-6">
        <AskYuriAboutProduct productName={productName} productBrand={productBrand} />
      </div>

      <div className="product-gated-content space-y-4 mb-8">
        <GatedTeaser
          icon={<Sparkles className="w-5 h-5 text-amber-400" />}
          title="Your Skin Match Score"
          description="See how this product matches your skin type, concerns, and allergies. Get personalized warnings and benefits."
        />
        <GatedTeaser
          icon={<FlaskConical className="w-5 h-5 text-emerald-400" />}
          title="Full Ingredient Analysis"
          description={`Complete breakdown of all ${ingredientCount || 'N/A'} ingredients with safety ratings, comedogenic scores, and interaction warnings.`}
        />
        <GatedTeaser
          icon={<Package className="w-5 h-5 text-sky-400" />}
          title="Price Comparison Across 6+ Retailers"
          description="Compare exact prices at Olive Young, Soko Glam, YesStyle, Amazon, and more. Find the best deal with savings calculations."
        />
        <GatedTeaser
          icon={<Star className="w-5 h-5 text-rose-400" />}
          title="Community Reviews by Skin Type"
          description="Read reviews filtered by your skin type, age, and concerns. See Holy Grail and Broke Me Out counts."
        />
      </div>

      <div className="bg-gradient-to-br from-amber-500/10 to-rose-500/10 rounded-2xl border border-amber-500/20 p-8 text-center mb-8">
        <h2 className="font-display font-bold text-xl text-white mb-2">
          Unlock Full Product Intelligence
        </h2>
        <p className="text-white/60 text-sm mb-6 max-w-lg mx-auto">
          Seoul Sister Pro gives you personalized skin matching, full ingredient analysis,
          multi-retailer price comparison, community reviews, AI-powered advice, and more
          for every product in our database.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Start Your K-Beauty Journey — {PRICING.monthly_display}
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-xs text-white/30 mt-3">
          Full access to Yuri AI advisor, unlimited scans, and all intelligence features
        </p>
      </div>
    </>
  )
}

/**
 * Free-Yuri entry point on the public product page (July 27 2026).
 *
 * Routes to the landing hero widget with the question prefilled — the same
 * single-front-door pattern as the blog/best/ingredient feeders. The prefill
 * seeds the VISITOR'S opening question only; Yuri's answer is always her own.
 * This surface never advises (Yuri Sole Authority) — it describes what she can
 * do and hands off.
 */
function AskYuriAboutProduct({
  productName,
  productBrand,
}: {
  productName: string | null
  productBrand: string | null
}) {
  const label = [productBrand, productName].filter(Boolean).join(' ') || 'this product'
  const prefill = `Is ${label} right for my skin?`

  return (
    <Link
      href={`/?ask=${encodeURIComponent(prefill)}&from=product`}
      className="block bg-white/[0.03] rounded-xl border border-violet-500/30 p-5 hover:border-violet-500/50 hover:bg-white/[0.05] transition-colors"
    >
      <div className="flex items-start gap-3">
        <Shield className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-sm mb-1">
            Ask Yuri about {label}
          </h3>
          <p className="text-white/60 text-xs mb-2">
            Free, no signup. Yuri is Seoul Sister&apos;s AI K-beauty advisor — ask her whether
            this suits your skin type, what it conflicts with, or what a cheaper equivalent
            would be.
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs text-violet-300 font-medium">
            Ask about this product
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  )
}

function GatedTeaser({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="relative bg-white/[0.03] rounded-xl border border-white/10 p-5 overflow-hidden">
      <div className="absolute inset-0 backdrop-blur-[2px] bg-[#0a0a0a]/40 z-10 flex items-center justify-center">
        <Link
          href="/register"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-sm text-white hover:bg-white/15 transition-colors"
        >
          <Lock className="w-3.5 h-3.5" />
          Subscribe to unlock
        </Link>
      </div>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <h3 className="font-medium text-sm text-white mb-1">{title}</h3>
          <p className="text-xs text-white/50">{description}</p>
        </div>
      </div>
    </div>
  )
}
