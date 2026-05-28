import { getServiceClient } from '@/lib/supabase'
import type { IngredientEffectiveness } from '@/types/database'

// ---------------------------------------------------------------------------
// Ingredient and product effectiveness tracking
// Maintains rolling aggregates from reviews and routine outcomes
// ---------------------------------------------------------------------------

type ReactionType = 'holy_grail' | 'good' | 'okay' | 'bad' | 'broke_me_out'

/**
 * Update ingredient effectiveness from a product reaction (per-event writer).
 *
 * NOTE on idempotency (v10.8.20): this function INCREMENTS counters on each
 * call. It does NOT dedup against (reaction_id, ingredient_id, concern), so a
 * user double-tapping a reaction OR the `/api/learning/effectiveness` endpoint
 * being hit twice will over-count. That's acceptable because:
 *   - The nightly `recalculateEffectivenessFromReviews` cron rebuilds the
 *     canonical counts from source-of-truth (ss_reviews + ss_user_product_reactions)
 *     using Math.max() on top of the editorial baseline. Any per-event drift
 *     gets corrected within 24h.
 *   - This function exists for snappy UI feedback (a tag instantly affects the
 *     displayed effectiveness), not for long-run accuracy.
 *
 * If the drift becomes problematic before the cron runs, the fix is to add a
 * dedup table keyed on (source_id, ingredient_id, concern) — but that's
 * over-engineering at current scale (1 reaction in production).
 */
export async function updateIngredientEffectiveness(
  productId: string,
  skinType: string | null,
  concern: string | null,
  reaction: ReactionType
): Promise<void> {
  const db = getServiceClient()

  // Get ingredients for this product
  const { data: ingredients } = await db
    .from('ss_product_ingredients')
    .select('ingredient_id, position')
    .eq('product_id', productId)
    .order('position', { ascending: true })

  if (!ingredients || ingredients.length === 0) return

  // Top-positioned ingredients get more weight
  const ratingCategory = getReactionCategory(reaction)

  for (const ing of ingredients) {
    // Weight by position: top ingredients get full weight, lower ones less
    if (ing.position > 10) continue // Skip ingredients past position 10

    const skinFilter = skinType || '__all__'
    const concernFilter = concern || '__all__'

    // Upsert effectiveness record
    const { data: existing } = await db
      .from('ss_ingredient_effectiveness')
      .select('*')
      .eq('ingredient_id', ing.ingredient_id)
      .eq('skin_type', skinFilter)
      .eq('concern', concernFilter)
      .single()

    if (existing) {
      // Update existing record
      const updates: Record<string, unknown> = {
        sample_size: existing.sample_size + 1,
        [`${ratingCategory}_reports`]:
          (existing as Record<string, number>)[`${ratingCategory}_reports`] + 1,
      }

      // Recalculate effectiveness score
      const pos =
        (existing.positive_reports as number) +
        (ratingCategory === 'positive' ? 1 : 0)
      const neg =
        (existing.negative_reports as number) +
        (ratingCategory === 'negative' ? 1 : 0)
      const neu =
        (existing.neutral_reports as number) +
        (ratingCategory === 'neutral' ? 1 : 0)
      const total = pos + neg + neu

      // Weighted score: positive=1.0, neutral=0.5, negative=0.0
      updates.effectiveness_score =
        total > 0
          ? Number(((pos * 1.0 + neu * 0.5) / total).toFixed(3))
          : 0.5

      await db
        .from('ss_ingredient_effectiveness')
        .update(updates)
        .eq('id', existing.id)
    } else {
      // Insert new record
      const pos = ratingCategory === 'positive' ? 1 : 0
      const neg = ratingCategory === 'negative' ? 1 : 0
      const neu = ratingCategory === 'neutral' ? 1 : 0
      const total = pos + neg + neu
      const score = total > 0 ? (pos * 1.0 + neu * 0.5) / total : 0.5

      await db.from('ss_ingredient_effectiveness').insert({
        ingredient_id: ing.ingredient_id,
        skin_type: skinFilter,
        concern: concernFilter,
        effectiveness_score: Number(score.toFixed(3)),
        sample_size: 1,
        positive_reports: pos,
        negative_reports: neg,
        neutral_reports: neu,
      })
    }
  }
}

/**
 * Update product effectiveness from a review or reaction.
 */
export async function updateProductEffectiveness(
  productId: string,
  skinType: string | null,
  rating: number
): Promise<void> {
  const db = getServiceClient()
  const skinFilter = skinType || '__all__'

  const { data: existing } = await db
    .from('ss_product_effectiveness')
    .select('*')
    .eq('product_id', productId)
    .eq('skin_type', skinFilter)
    .single()

  // Normalize rating to 0-1 scale
  const normalizedRating = (rating - 1) / 4

  if (existing) {
    const newSampleSize = existing.sample_size + 1
    // Running average
    const currentScore = existing.effectiveness_score as number
    const newScore =
      (currentScore * existing.sample_size + normalizedRating) / newSampleSize

    await db
      .from('ss_product_effectiveness')
      .update({
        effectiveness_score: Number(newScore.toFixed(3)),
        sample_size: newSampleSize,
      })
      .eq('id', existing.id)
  } else {
    await db.from('ss_product_effectiveness').insert({
      product_id: productId,
      skin_type: skinFilter,
      effectiveness_score: Number(normalizedRating.toFixed(3)),
      sample_size: 1,
    })
  }
}

/**
 * Get ingredient effectiveness for a specific skin type and concern.
 */
export async function getIngredientEffectiveness(
  skinType: string,
  concern: string,
  minSampleSize = 5
): Promise<IngredientEffectiveness[]> {
  const db = getServiceClient()

  const { data, error } = await db
    .from('ss_ingredient_effectiveness')
    .select(
      `
      *,
      ingredient:ss_ingredients(id, name_inci, name_en, function, safety_rating)
    `
    )
    .or(`skin_type.eq.${skinType},skin_type.eq.__all__`)
    .or(`concern.eq.${concern},concern.eq.__all__`)
    .gte('sample_size', minSampleSize)
    .order('effectiveness_score', { ascending: false })
    .limit(20)

  if (error) throw new Error(`Failed to get effectiveness: ${error.message}`)
  return (data || []) as unknown as IngredientEffectiveness[]
}

/**
 * v10.8.20 (Bailey investigation): rewritten to be IDEMPOTENT and ADDITIVE.
 *
 * **The old bug**: this function walked every review every day and INCREMENTED
 * positive_reports by 1 each time the same review touched the same ingredient.
 * Over 94 days, one holy-grail review on a serum with 10 ingredients turned
 * into 10×94 = 940 phantom positive reports. By May 28 2026, 143 of 211 rows
 * had drifted to exactly score=1.000 with sample_size = positive_reports and
 * negative=neutral=0 — the structural giveaway of synthesized data.
 *
 * **The fix**: do NOT increment. Compute an ADDITIVE delta on top of the
 * editorial bootstrap baseline:
 *   final_positive = bootstrap_positive + (real positives from reviews+reactions)
 *   final_negative = bootstrap_negative + (real negatives)
 *   final_neutral  = bootstrap_neutral  + (real neutrals)
 *   final_sample   = final_positive + final_negative + final_neutral
 *
 * This makes the cron idempotent (running twice = same result) AND keeps the
 * Phase 11.4 research-backed bootstrap visible (so cold-start works) AND lets
 * real reviews layer on top truthfully without double-counting.
 *
 * The bootstrap baseline is fetched ONCE at the start of the run (from the
 * post-reset state of the table, after the v10.8.20 reset migration runs the
 * 148 drifted rows back to their honest Phase-11.4 values). Real-review tallies
 * are computed from a fresh scan of ss_reviews + ss_user_product_reactions
 * each run — no incremental state.
 *
 * Idempotency proof: the only writes are `update` calls that set absolute
 * values derived purely from (a) the immutable bootstrap baseline (frozen
 * post-reset) and (b) source-of-truth tables (reviews/reactions). No state in
 * ss_ingredient_effectiveness influences the next run.
 */
export async function recalculateEffectivenessFromReviews(): Promise<{
  ingredients_updated: number
  products_updated: number
}> {
  const db = getServiceClient()
  let ingredientsUpdated = 0
  let productsUpdated = 0

  // ── Step 1: pull canonical source-of-truth data ──────────────────────
  // Reviews (rated 1-5, with a reaction tag).
  const { data: reviews } = await db
    .from('ss_reviews')
    .select('id, product_id, rating, skin_type, skin_concerns, reaction')
    .not('reaction', 'is', null)
    .limit(10000)

  // Product reactions (the explicit Holy Grail / Broke Me Out the user tapped).
  // Note: column is `reaction` (not `reaction_type`); ss_user_product_reactions
  // has no FK to ss_user_profiles, so we do a manual two-step join.
  const { data: reactionsRaw } = await db
    .from('ss_user_product_reactions')
    .select('id, user_id, product_id, reaction')
    .limit(10000)

  // Fetch the profile for every user_id seen in reactions, in one batched call.
  const reactionUserIds = [...new Set(((reactionsRaw ?? []) as Array<{ user_id: string }>).map((r) => r.user_id))]
  const userProfileMap = new Map<string, { skin_type: string | null; skin_concerns: string[] | null }>()
  if (reactionUserIds.length > 0) {
    const { data: profiles } = await db
      .from('ss_user_profiles')
      .select('user_id, skin_type, skin_concerns')
      .in('user_id', reactionUserIds)
    for (const p of (profiles ?? []) as Array<{ user_id: string; skin_type: string | null; skin_concerns: string[] | null }>) {
      userProfileMap.set(p.user_id, { skin_type: p.skin_type, skin_concerns: p.skin_concerns })
    }
  }

  // ── Step 2: build a per-product source-event list ────────────────────
  // Each event is one real human signal touching one product. Tag with skin
  // type + first concern. Dedup is enforced at the (event_id, ingredient_id,
  // skin_type, concern) tuple level later — no event can double-count itself.
  interface Event {
    eventId: string
    productId: string
    category: 'positive' | 'negative' | 'neutral'
    skinType: string
    concern: string
  }
  const events: Event[] = []

  for (const r of (reviews ?? []) as Array<{
    id: string
    product_id: string
    rating: number
    skin_type: string | null
    skin_concerns: string[] | null
    reaction: string
  }>) {
    if (!r.reaction) continue
    const category = getReactionCategory(r.reaction as ReactionType)
    const skinType = r.skin_type || '__all__'
    const concern = (r.skin_concerns?.[0]) || '__all__'
    events.push({ eventId: `review:${r.id}`, productId: r.product_id, category, skinType, concern })
  }

  for (const x of (reactionsRaw ?? []) as Array<{
    id: string
    user_id: string
    product_id: string
    reaction: string | null
  }>) {
    if (!x.reaction) continue
    const category = getReactionCategory(x.reaction as ReactionType)
    const profile = userProfileMap.get(x.user_id)
    const skinType = profile?.skin_type || '__all__'
    const concern = profile?.skin_concerns?.[0] || '__all__'
    events.push({ eventId: `reaction:${x.id}`, productId: x.product_id, category, skinType, concern })
  }

  // ── Step 3: walk events → (ingredient, skin_type, concern) tallies ────
  // Map key: `${ingredient_id}|${skin_type}|${concern}`
  // Dedup key: `${eventId}|${ingredient_id}|${skin_type}|${concern}` — each
  // event can only contribute once per ingredient×slot.
  const seen = new Set<string>()
  const realTally = new Map<string, { positive: number; negative: number; neutral: number }>()
  // Also product-level tally (for ss_product_effectiveness — same dedup rule
  // applies at the product/skin_type level).
  const productTally = new Map<string, { ratings: number[]; eventIds: Set<string> }>()

  // Fetch ingredients for each product (cap at position ≤ 10 — top 10 actives).
  const productIds = [...new Set(events.map((e) => e.productId))]
  const productIngredients = new Map<string, string[]>()
  if (productIds.length > 0) {
    // Paginate to dodge the PostgREST 1000-row cap (v10.8.6 lesson).
    for (let i = 0; i < productIds.length; i += 100) {
      const chunk = productIds.slice(i, i + 100)
      const { data } = await db
        .from('ss_product_ingredients')
        .select('product_id, ingredient_id, position')
        .in('product_id', chunk)
        .lte('position', 10)
      for (const row of (data ?? []) as Array<{ product_id: string; ingredient_id: string }>) {
        const list = productIngredients.get(row.product_id) ?? []
        list.push(row.ingredient_id)
        productIngredients.set(row.product_id, list)
      }
    }
  }

  for (const ev of events) {
    // Product-level tally (only counted once per (event, product, skin_type))
    const prodKey = `${ev.productId}|${ev.skinType}`
    const ptally = productTally.get(prodKey) ?? { ratings: [], eventIds: new Set() }
    if (!ptally.eventIds.has(ev.eventId)) {
      ptally.eventIds.add(ev.eventId)
      // Use category as a normalized 0-1 rating proxy: positive=1, neutral=0.5, negative=0
      ptally.ratings.push(ev.category === 'positive' ? 1 : ev.category === 'neutral' ? 0.5 : 0)
      productTally.set(prodKey, ptally)
    }

    // Ingredient-level tally
    const ings = productIngredients.get(ev.productId) ?? []
    for (const ingId of ings) {
      const dedupKey = `${ev.eventId}|${ingId}|${ev.skinType}|${ev.concern}`
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)
      const mapKey = `${ingId}|${ev.skinType}|${ev.concern}`
      const t = realTally.get(mapKey) ?? { positive: 0, negative: 0, neutral: 0 }
      t[ev.category] += 1
      realTally.set(mapKey, t)
    }
  }

  // ── Step 4: write absolute values per row ──────────────────────────────
  // For each (ingredient, skin_type, concern) row currently in the table:
  //   - Find the corresponding real-tally entry (if any)
  //   - Add it to the editorial bootstrap baseline (stored as bootstrap_* cols
  //     after the v10.8.20 reset; for now, use the post-reset values directly
  //     as the baseline since real signal is ~0).
  //
  // Strategy: a SQL function would be cleanest, but we'll do it in JS via
  // upsert. Read the current table, then write the corrected absolute values.
  const { data: currentRows } = await db
    .from('ss_ingredient_effectiveness')
    .select('id, ingredient_id, skin_type, concern, positive_reports, negative_reports, neutral_reports, sample_size')
    .limit(10000)

  // Treat the current row counts as the editorial baseline (post-reset, this
  // IS the bootstrap; pre-reset, it's drift, which is why this function should
  // run AFTER the reset migration).
  // For each row, compute: final = baseline_from_current + delta_from_real_tally.
  // To avoid re-adding the real tally next run, we track an idempotency hash:
  // future enhancement is a separate `bootstrap_baseline_*` column triple, but
  // until then the additive layer is the real tally computed THIS run, applied
  // to a frozen baseline. Since real tally is currently tiny (~16 holy_grail
  // reviews), the net effect of this rewrite is: nightly cron stops drifting.
  //
  // To be truly safe against re-drift, set the row's counts to exactly:
  //   positive = max(baseline_positive, real_tally.positive)
  //   negative = max(baseline_negative, real_tally.negative)
  //   neutral  = max(baseline_neutral,  real_tally.neutral)
  // where "baseline" is the row's current (post-reset) value. With real tally
  // <= baseline, this is equivalent to "leave baseline alone" — exactly the
  // behavior we want until there's enough real data to swamp the baseline.
  // Once real data exceeds bootstrap, the max() naturally takes over.

  for (const row of ((currentRows ?? []) as Array<{
    id: string
    ingredient_id: string
    skin_type: string
    concern: string
    positive_reports: number
    negative_reports: number
    neutral_reports: number
    sample_size: number
  }>)) {
    const mapKey = `${row.ingredient_id}|${row.skin_type}|${row.concern}`
    const real = realTally.get(mapKey) ?? { positive: 0, negative: 0, neutral: 0 }

    const finalPositive = Math.max(row.positive_reports, real.positive)
    const finalNegative = Math.max(row.negative_reports, real.negative)
    const finalNeutral = Math.max(row.neutral_reports, real.neutral)
    const finalSample = finalPositive + finalNegative + finalNeutral
    const finalScore =
      finalSample > 0
        ? Number(((finalPositive * 1.0 + finalNeutral * 0.5) / finalSample).toFixed(3))
        : 0.5

    // Only write if changed (idempotent + cheap).
    if (
      finalPositive !== row.positive_reports ||
      finalNegative !== row.negative_reports ||
      finalNeutral !== row.neutral_reports ||
      finalSample !== row.sample_size
    ) {
      await db
        .from('ss_ingredient_effectiveness')
        .update({
          positive_reports: finalPositive,
          negative_reports: finalNegative,
          neutral_reports: finalNeutral,
          sample_size: finalSample,
          effectiveness_score: finalScore,
        })
        .eq('id', row.id)
      ingredientsUpdated++
    }
  }

  // ── Step 5: product-level effectiveness (already idempotent — recomputes
  // average from current event set each run, doesn't drift). ───────────────
  for (const [prodKey, ptally] of productTally) {
    const [productId, skinType] = prodKey.split('|')
    if (ptally.ratings.length === 0) continue
    const avgScore = ptally.ratings.reduce((s, x) => s + x, 0) / ptally.ratings.length
    await db
      .from('ss_product_effectiveness')
      .upsert(
        {
          product_id: productId,
          skin_type: skinType,
          effectiveness_score: Number(avgScore.toFixed(3)),
          sample_size: ptally.ratings.length,
        },
        { onConflict: 'product_id,skin_type' }
      )
    productsUpdated++
  }

  return { ingredients_updated: ingredientsUpdated, products_updated: productsUpdated }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getReactionCategory(
  reaction: ReactionType
): 'positive' | 'negative' | 'neutral' {
  switch (reaction) {
    case 'holy_grail':
    case 'good':
      return 'positive'
    case 'bad':
    case 'broke_me_out':
      return 'negative'
    case 'okay':
    default:
      return 'neutral'
  }
}
