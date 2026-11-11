'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { captureOfferCode, getOfferCode, clearOfferCode, resolveSavedOffer, readMemberPlan, askOfferOnce, NO_SAVED_OFFER, type SavedOffer } from '@/lib/offers'

/**
 * The creator code this browser remembers, as it applies to the person looking
 * at the page (Nov 2026). One source for the "code saved" line, the price
 * lines under the free chat, and whether the chat tells Yuri about the code,
 * so the three cannot disagree. The rules are in resolveSavedOffer; how the
 * plan and the code are read is in readMemberPlan and askOfferOnce.
 *
 * The words and the percentage come from Stripe through /api/offer, never from
 * the URL.
 */
export function useSavedOffer(): SavedOffer {
  const { user, loading } = useAuth()
  const userId = user?.id ?? null
  const [offer, setOffer] = useState<SavedOffer>(NO_SAVED_OFFER)

  useEffect(() => {
    let live = true
    // Child effects run before AuthContext's, so read the URL here too.
    captureOfferCode()
    setOffer(NO_SAVED_OFFER)
    // Who is looking is not known until the session has been read.
    if (loading) return
    resolveSavedOffer({
      code: getOfferCode(),
      signedIn: userId !== null,
      readPlan: () => readMemberPlan(supabase, userId as string),
      askOffer: (code) => askOfferOnce(code, (url) => fetch(url)),
      forget: clearOfferCode,
      onUpdate: (o) => {
        if (live) setOffer(o)
      },
    }).catch((err) => console.error('[offer] could not check the saved code:', err))
    return () => {
      live = false
    }
    // Keyed on the user's id, not the user object: a token refresh hands back
    // a new object for the same person and must not ask everything again.
  }, [userId, loading])

  return offer
}
