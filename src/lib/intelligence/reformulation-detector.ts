import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReformulationDetectionResult } from '@/types/database'

interface StoredIngredient {
  ingredient_id: string
  position: number
  ingredient: { name_inci: string }
}

/**
 * Compare a scanned ingredient list against the stored ingredients for a product.
 * Detects additions, removals, and reorderings that signal a reformulation.
 */
export async function detectReformulation(
  supabase: SupabaseClient,
  productId: string,
  scannedInciNames: string[]
): Promise<ReformulationDetectionResult> {
  const noChange: ReformulationDetectionResult = {
    changed: false,
    added: [],
    removed: [],
    reordered: false,
    alerts_created: 0,
  }

  if (!scannedInciNames.length) return noChange

  // Fetch stored ingredient list for this product
  const { data: storedIngredients } = await supabase
    .from('ss_product_ingredients')
    .select('ingredient_id, position, ingredient:ss_ingredients(name_inci)')
    .eq('product_id', productId)
    .order('position', { ascending: true })

  if (!storedIngredients?.length) return noChange

  // Normalize names for comparison (lowercase, trim whitespace)
  const normalize = (s: string) => s.toLowerCase().trim()

  const storedNames = (storedIngredients as unknown as StoredIngredient[])
    .map((si) => normalize(si.ingredient.name_inci))
  const scannedNormalized = scannedInciNames.map(normalize)

  const storedSet = new Set(storedNames)
  const scannedSet = new Set(scannedNormalized)

  // Find additions and removals
  const added = scannedNormalized.filter((name) => !storedSet.has(name))
  const removed = storedNames.filter((name) => !scannedSet.has(name))

  // Check reordering: compare order of shared ingredients
  const sharedStored = storedNames.filter((name) => scannedSet.has(name))
  const sharedScanned = scannedNormalized.filter((name) => storedSet.has(name))
  const reordered = sharedStored.length > 2 && sharedStored.join(',') !== sharedScanned.join(',')

  // Determine if this is a meaningful change
  // Minor changes (1 filler ingredient swap) shouldn't trigger alerts
  const totalIngredients = Math.max(storedNames.length, scannedNormalized.length)
  const changeCount = added.length + removed.length
  const changePct = changeCount / totalIngredients

  // Only flag as reformulation if >5% of ingredients changed or key reordering
  if (changePct < 0.05 && !reordered) return noChange

  return {
    changed: true,
    added,
    removed,
    reordered,
    alerts_created: 0,
  }
}

/**
 * Record a detected reformulation and create alerts for affected users.
 * Uses service role client to write across user boundaries.
 */
export async function recordReformulation(
  serviceClient: SupabaseClient,
  productId: string,
  detection: ReformulationDetectionResult,
  detectedBy: 'manual' | 'scan_comparison' | 'cron_job'
): Promise<{ historyId: string; alertsCreated: number }> {
  // Get current formulation version
  const { data: product } = await serviceClient
    .from('ss_products')
    .select('current_formulation_version, name_en, brand_en')
    .eq('id', productId)
    .single()

  const currentVersion = product?.current_formulation_version ?? 1
  const newVersion = currentVersion + 1

  // Determine change type
  let changeType: string = 'reformulation'
  if (detection.added.length === 0 && detection.removed.length === 0 && detection.reordered) {
    changeType = 'minor_tweak'
  }

  // Build summary
  const summaryParts: string[] = []
  if (detection.added.length > 0) {
    summaryParts.push(`Added: ${detection.added.join(', ')}`)
  }
  if (detection.removed.length > 0) {
    summaryParts.push(`Removed: ${detection.removed.join(', ')}`)
  }
  if (detection.reordered) {
    summaryParts.push('Ingredient order changed (may indicate concentration adjustments)')
  }
  const changeSummary = summaryParts.join('. ')

  // Build impact assessment
  const impactParts: string[] = []
  const fragranceTerms = ['fragrance', 'parfum', 'linalool', 'limonene']
  const removedFragrance = detection.removed.some((r) =>
    fragranceTerms.some((f) => r.toLowerCase().includes(f))
  )
  const addedFragrance = detection.added.some((a) =>
    fragranceTerms.some((f) => a.toLowerCase().includes(f))
  )
  if (removedFragrance) impactParts.push('Fragrance removed — better for sensitive skin')
  if (addedFragrance) impactParts.push('Fragrance added — sensitive skin users should re-evaluate')

  const activeTerms = ['retinol', 'niacinamide', 'vitamin c', 'ascorbic', 'hyaluronic', 'salicylic', 'glycolic']
  for (const added of detection.added) {
    if (activeTerms.some((t) => added.toLowerCase().includes(t))) {
      impactParts.push(`Active ingredient added: ${added}`)
    }
  }
  for (const removed of detection.removed) {
    if (activeTerms.some((t) => removed.toLowerCase().includes(t))) {
      impactParts.push(`Active ingredient removed: ${removed}`)
    }
  }

  const impactAssessment = impactParts.length > 0
    ? impactParts.join('. ')
    : 'Minor formulation adjustment. Monitor for changes in texture or effectiveness.'

  // Insert formulation history record
  const { data: history, error: historyError } = await serviceClient
    .from('ss_product_formulation_history')
    .insert({
      product_id: productId,
      version_number: newVersion,
      change_date: new Date().toISOString().split('T')[0],
      change_type: changeType,
      ingredients_added: detection.added,
      ingredients_removed: detection.removed,
      ingredients_reordered: detection.reordered,
      change_summary: changeSummary,
      impact_assessment: impactAssessment,
      detected_by: detectedBy,
      confirmed: detectedBy === 'manual',
    })
    .select('id')
    .single()

  if (historyError || !history) {
    throw new Error(`Failed to record formulation history: ${historyError?.message}`)
  }

  // Update product version
  await serviceClient
    .from('ss_products')
    .update({
      current_formulation_version: newVersion,
      last_reformulated_at: new Date().toISOString().split('T')[0],
    })
    .eq('id', productId)

  // Find affected users: those with this product in active routines or wishlists
  const { data: affectedRoutineUsers } = await serviceClient
    .from('ss_routine_products')
    .select('ss_user_routines!inner(user_id)')
    .eq('product_id', productId)
    .eq('ss_user_routines.is_active', true)

  const affectedUserIds = new Set<string>()
  if (affectedRoutineUsers) {
    for (const rp of affectedRoutineUsers) {
      const routine = rp.ss_user_routines as unknown as { user_id: string }
      if (routine?.user_id) {
        affectedUserIds.add(routine.user_id)
      }
    }
  }

  // Also check users tracking this product (expiration tracking)
  const { data: trackingUsers } = await serviceClient
    .from('ss_user_product_tracking')
    .select('user_id')
    .eq('product_id', productId)
    .eq('status', 'active')

  if (trackingUsers) {
    for (const tu of trackingUsers) {
      affectedUserIds.add(tu.user_id)
    }
  }

  // Create alerts for affected users
  let alertsCreated = 0
  if (affectedUserIds.size > 0) {
    const alertRows = Array.from(affectedUserIds).map((userId) => ({
      user_id: userId,
      product_id: productId,
      formulation_history_id: history.id,
    }))

    const { error: alertError } = await serviceClient
      .from('ss_user_reformulation_alerts')
      .insert(alertRows)

    if (!alertError) {
      alertsCreated = alertRows.length
    }
  }

  return { historyId: history.id, alertsCreated }
}
