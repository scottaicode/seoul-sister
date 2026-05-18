import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'

/**
 * GET /api/library
 *
 * Consolidating read for the subscriber-only /library page.
 * Five sections (data display only — no recommendations generated here):
 *   - owned: ss_user_products (inventory; may include null-product custom entries)
 *   - saved: ss_user_wishlists UNION ss_user_scans filtered to non-owned products
 *   - in_routine: ss_user_routines (active) + ss_routine_products, with ownership_gap flag
 *   - tagged: ss_user_product_reactions (holy_grail + broke_me_out, split client-side)
 *   - expiring: ss_user_product_tracking (active, with day_count + bucket fields)
 *
 * Each section is non-critical — if one query fails, the rest still ship. The
 * Yuri CTA at the top of the page is the ONLY recommendation surface; this
 * endpoint never synthesizes advice.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const db = getServiceClient()

    const [
      ownedRes,
      wishlistRes,
      scansRes,
      routinesRes,
      reactionsRes,
      trackingRes,
    ] = await Promise.all([
      db
        .from('ss_user_products')
        .select(
          'id, product_id, custom_name, custom_brand, category, notes, status, learned_from, created_at, ss_products(name_en, brand_en, image_url, category)'
        )
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      db
        .from('ss_user_wishlists')
        .select(
          'id, product_id, price_alert_threshold, created_at, ss_products(name_en, brand_en, image_url, category)'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      db
        .from('ss_user_scans')
        .select(
          'id, product_id, scan_type, created_at, ss_products(name_en, brand_en, image_url, category)'
        )
        .eq('user_id', user.id)
        .not('product_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(60),
      db
        .from('ss_user_routines')
        .select(
          'id, name, routine_type, is_active, ss_routine_products(id, step_order, product_id, notes, frequency, ss_products(name_en, brand_en, image_url, category))'
        )
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('routine_type', { ascending: true }),
      db
        .from('ss_user_product_reactions')
        .select(
          'id, product_id, reaction, notes, created_at, ss_products(name_en, brand_en, image_url, category)'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      db
        .from('ss_user_product_tracking')
        .select(
          'id, product_id, custom_product_name, opened_date, expiry_date, pao_months, notes, status, ss_products(name_en, brand_en, image_url, category)'
        )
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('expiry_date', { ascending: true, nullsFirst: false }),
    ])

    // Owned: all active rows, including null-product custom entries (devices, actions)
    const owned = (ownedRes.data || []).map((row) => {
      const linked = Array.isArray(row.ss_products) ? row.ss_products[0] : row.ss_products
      return {
        id: row.id,
        product_id: row.product_id,
        display_name: linked?.name_en || row.custom_name || 'Unnamed item',
        display_brand: linked?.brand_en || row.custom_brand || null,
        image_url: linked?.image_url || null,
        category: row.category || linked?.category || null,
        notes: row.notes || null,
        learned_from: row.learned_from || null,
        created_at: row.created_at,
      }
    })

    // Build owned-product-id set for cross-references
    const ownedProductIds = new Set(
      (ownedRes.data || [])
        .map((r) => r.product_id)
        .filter((id): id is string => id !== null)
    )

    // Saved: wishlist + scans (filter scans to non-owned, dedup by product_id)
    const wishlistRows = (wishlistRes.data || []).map((row) => {
      const linked = Array.isArray(row.ss_products) ? row.ss_products[0] : row.ss_products
      return {
        id: `wish-${row.id}`,
        source: 'wishlist' as const,
        product_id: row.product_id,
        display_name: linked?.name_en || 'Unnamed product',
        display_brand: linked?.brand_en || null,
        image_url: linked?.image_url || null,
        category: linked?.category || null,
        created_at: row.created_at,
      }
    })
    const seenSavedProductIds = new Set<string>(
      wishlistRows.map((r) => r.product_id).filter((id): id is string => Boolean(id))
    )
    const scanRows = (scansRes.data || [])
      .filter((row) => {
        if (!row.product_id) return false
        if (ownedProductIds.has(row.product_id)) return false
        if (seenSavedProductIds.has(row.product_id)) return false
        seenSavedProductIds.add(row.product_id)
        return true
      })
      .map((row) => {
        const linked = Array.isArray(row.ss_products) ? row.ss_products[0] : row.ss_products
        return {
          id: `scan-${row.id}`,
          source: 'scan' as const,
          product_id: row.product_id,
          display_name: linked?.name_en || 'Scanned product',
          display_brand: linked?.brand_en || null,
          image_url: linked?.image_url || null,
          category: linked?.category || null,
          created_at: row.created_at,
        }
      })
    const saved = [...wishlistRows, ...scanRows]

    // In Routine: split AM/PM, flag ownership gaps for product-linked steps only
    type RoutineStep = {
      id: string
      step_order: number
      product_id: string | null
      display_name: string
      display_brand: string | null
      image_url: string | null
      category: string | null
      notes: string | null
      frequency: string | null
      ownership_gap: boolean
    }
    const routinesRaw = routinesRes.data || []
    const buildSteps = (routineType: 'am' | 'pm'): RoutineStep[] => {
      const r = routinesRaw.find((x) => x.routine_type === routineType)
      if (!r) return []
      const steps = Array.isArray(r.ss_routine_products) ? r.ss_routine_products : []
      return [...steps]
        .sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
        .map((s) => {
          const linked = Array.isArray(s.ss_products) ? s.ss_products[0] : s.ss_products
          const productId = s.product_id ?? null
          const ownershipGap = Boolean(productId) && !ownedProductIds.has(productId as string)
          return {
            id: s.id,
            step_order: s.step_order ?? 0,
            product_id: productId,
            display_name: linked?.name_en || (s.notes ? s.notes.split('—')[0]?.trim() || 'Custom step' : 'Custom step'),
            display_brand: linked?.brand_en || null,
            image_url: linked?.image_url || null,
            category: linked?.category || null,
            notes: s.notes || null,
            frequency: s.frequency || null,
            ownership_gap: ownershipGap,
          }
        })
    }
    const inRoutine = {
      am: buildSteps('am'),
      pm: buildSteps('pm'),
    }

    // Tagged: split holy_grail vs broke_me_out, latest 40 of each
    type TagEntry = {
      id: string
      product_id: string | null
      display_name: string
      display_brand: string | null
      image_url: string | null
      category: string | null
      notes: string | null
      reaction_date: string
    }
    const taggedAll = (reactionsRes.data || []).map((row) => {
      const linked = Array.isArray(row.ss_products) ? row.ss_products[0] : row.ss_products
      return {
        id: row.id,
        product_id: row.product_id,
        reaction: row.reaction,
        display_name: linked?.name_en || 'Unnamed product',
        display_brand: linked?.brand_en || null,
        image_url: linked?.image_url || null,
        category: linked?.category || null,
        notes: row.notes || null,
        reaction_date: row.created_at,
      }
    })
    const tagged = {
      holy_grail: taggedAll
        .filter((r) => r.reaction === 'holy_grail')
        .map(({ reaction: _, ...rest }) => rest) as TagEntry[],
      broke_me_out: taggedAll
        .filter((r) => r.reaction === 'broke_me_out')
        .map(({ reaction: _, ...rest }) => rest) as TagEntry[],
    }

    // Expiring: top 5 by soonest expiry_date, day_count + bucket for color coding
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiringAll = (trackingRes.data || []).map((row) => {
      const linked = Array.isArray(row.ss_products) ? row.ss_products[0] : row.ss_products
      let daysUntilExpiry: number | null = null
      if (row.expiry_date) {
        const expiry = new Date(row.expiry_date)
        expiry.setHours(0, 0, 0, 0)
        daysUntilExpiry = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      }
      let bucket: 'urgent' | 'soon' | 'later' = 'later'
      if (daysUntilExpiry !== null) {
        if (daysUntilExpiry < 14) bucket = 'urgent'
        else if (daysUntilExpiry <= 30) bucket = 'soon'
      }
      return {
        id: row.id,
        product_id: row.product_id,
        display_name: linked?.name_en || row.custom_product_name || 'Tracked product',
        display_brand: linked?.brand_en || null,
        image_url: linked?.image_url || null,
        category: linked?.category || null,
        opened_date: row.opened_date,
        expiry_date: row.expiry_date,
        days_until_expiry: daysUntilExpiry,
        bucket,
      }
    })
    // Top 5 most-expiring-soon; sort puts null expiry dates last
    const expiring = [...expiringAll]
      .sort((a, b) => {
        if (a.days_until_expiry === null && b.days_until_expiry === null) return 0
        if (a.days_until_expiry === null) return 1
        if (b.days_until_expiry === null) return -1
        return a.days_until_expiry - b.days_until_expiry
      })
      .slice(0, 5)

    // Summary counts for the Yuri CTA prefill
    const summary = {
      owned_count: owned.length,
      saved_count: saved.length,
      routine_step_count: inRoutine.am.length + inRoutine.pm.length,
      ownership_gap_count:
        inRoutine.am.filter((s) => s.ownership_gap).length +
        inRoutine.pm.filter((s) => s.ownership_gap).length,
      holy_grail_count: tagged.holy_grail.length,
      broke_me_out_count: tagged.broke_me_out.length,
      tracking_count: expiringAll.length,
      expiring_soon_count: expiringAll.filter((e) => e.bucket === 'urgent' || e.bucket === 'soon').length,
    }

    return NextResponse.json({
      owned,
      saved,
      in_routine: inRoutine,
      tagged,
      expiring,
      expiring_total: expiringAll.length,
      summary,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
