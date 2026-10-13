'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { productTopHref } from './product-ask-href'

/**
 * Free Yuri entry at the top of a product page (Oct 12 2026).
 *
 * ChatGPT sent ~65 of its 136 sessions (Sep 14 - Oct 11) to product pages, at
 * ~5s each, and none chatted: the only free offer sat below the description,
 * ingredients and stats, and the engagement-gated nudge never fires in 5
 * seconds. Same prefill and front door as AskYuriAboutProduct further down,
 * which stays. Its own source tag (product_top) so this placement is graded
 * on its own.
 *
 * The href swaps on auth like BlogYuriCta: useAuth starts null, so server HTML
 * and first client render are the anonymous shape (no hydration mismatch), and
 * a signed-in user goes to /yuri instead of spending the anonymous preview.
 */
export default function ProductTopAskYuri({
  productId,
  brand,
  name,
}: {
  productId: string
  brand: string | null
  name: string | null
}) {
  const { user } = useAuth()
  const href = productTopHref(productId, brand, name, !!user)

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-violet-300 hover:text-violet-200 transition-colors"
    >
      {user ? 'Ask Yuri about this product' : 'Is this right for your skin? Ask Yuri, free, no signup'}
      <span aria-hidden="true">&rarr;</span>
    </Link>
  )
}
