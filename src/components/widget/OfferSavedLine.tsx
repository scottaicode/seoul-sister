'use client'

import { useSavedOffer } from '@/lib/use-saved-offer'

/**
 * Tells someone who typed a creator code earlier in this browser that it is
 * still kept, when they come back to the landing page. (Until Nov 20 2026 a
 * code could arrive in an address; it is only ever typed now.)
 *
 * What it says, and to whom, is decided in useSavedOffer: the words come from
 * Stripe, and a signed-in member is told nothing. It never says how many uses
 * are left.
 */
export default function OfferSavedLine() {
  const { line } = useSavedOffer()
  if (!line) return null
  return (
    <p className="mt-3 text-center text-xs text-gold-light" role="status">
      {line}
    </p>
  )
}
