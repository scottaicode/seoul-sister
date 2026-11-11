'use client'

import { useSavedOffer } from '@/lib/use-saved-offer'

/**
 * Tells someone who arrived with a creator code (e.g. Bailey's link) that the
 * code was kept, as soon as they land (Nov 10 2026). Without it the first sign
 * of the code was the membership page, several steps later.
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
