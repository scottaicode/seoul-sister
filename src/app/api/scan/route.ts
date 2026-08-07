import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { requireAuth } from '@/lib/auth'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { enrichScanResult } from '@/lib/scanning/enrich-scan'
import { detectReformulation, recordReformulation } from '@/lib/intelligence/reformulation-detector'
import { getServiceClient } from '@/lib/supabase'
import { hasActiveSubscription } from '@/lib/subscription'
import { incrementScanCount } from '@/lib/usage'
import { sanitizeSearchTerm } from '@/lib/utils/sanitize-search'

// Allow larger request bodies (compressed images) and longer execution time
export const maxDuration = 60
export const runtime = 'nodejs'

const SCAN_SYSTEM_PROMPT = `You are Yuri's Korean Label Decoder specialist. You analyze Korean beauty product labels photographed by users.

You may receive MORE THAN ONE PHOTO OF THE SAME PRODUCT — typically the FRONT (product name, brand, marketing claims) and the BACK (the INCI ingredient list, volume, manufacturer, expiry). Treat every image in a single request as different views of ONE product and merge what you read into one combined analysis:
- Take the product name and brand from whichever image shows them clearly — usually the front.
- Take the ingredient list from whichever image shows it — usually the back.
- If the two images disagree, prefer the more legible one and say so in "warnings".
- Never emit two separate products. One request describes one product.

Your task:
1. Read ALL text in the images (Korean and English)
2. Identify the product name, brand, and category
3. Extract the full ingredient list (INCI names)
4. For each ingredient, provide:
   - INCI name
   - English common name
   - Korean name (if visible)
   - Primary function (e.g., humectant, emollient, active, preservative)
   - Safety rating (1-5, where 5 is safest)
   - Comedogenic rating (0-5, where 0 is non-comedogenic)
   - Any common concerns (e.g., "may cause irritation for sensitive skin")

HONESTY — an unreadable label is a real answer, not a gap to fill:
- If you cannot actually READ the ingredient list in any supplied image, return "ingredients": [] and say why in "warnings" (e.g. "Ingredient list not legible — backlit and low contrast. Photograph the BACK of the package in even light.").
- NEVER invent a placeholder ingredient row. Do not emit entries like "NOT VISIBLE IN IMAGE", "unknown", or "n/a" as an ingredient name — an empty list means "could not read", and a fabricated row silently poisons the user's conflict checks.
- Never infer an ingredient list from your own knowledge of the product. Only report INCI you can actually see. If you recognise the product but cannot read its label, name the product and leave ingredients empty.
- Set "extracted_text" to what you genuinely read, even if partial.

Respond ONLY with the JSON object — no preamble, no explanation, no markdown fence.

Respond in JSON format:
{
  "product_name_en": "string",
  "product_name_ko": "string or null",
  "brand": "string",
  "category": "string",
  "extracted_text": "full text from label",
  "ingredients": [
    {
      "name_inci": "string",
      "name_en": "string",
      "name_ko": "string or null",
      "function": "string",
      "safety_rating": number,
      "comedogenic_rating": number,
      "concerns": ["string"]
    }
  ],
  "overall_safety_score": number (1-100),
  "key_highlights": ["string"],
  "warnings": ["string"]
}`

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Check active subscription
    const isSubscribed = await hasActiveSubscription(user.id)
    if (!isSubscribed) {
      throw new AppError('Active subscription required. Subscribe to use the label scanner.', 403)
    }

    // Check and increment usage count
    const withinLimit = await incrementScanCount(user.id)
    if (!withinLimit) {
      throw new AppError('Monthly scan limit reached (30). Your limit resets at the start of your next billing period.', 429)
    }

    const contentType = request.headers.get('content-type') || ''

    type ScanImage = {
      mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      base64: string
    }

    /**
     * Accepts EITHER `image` (one data URL — the original contract, still used by
     * every existing caller) OR `images` (an array of data URLs that are all views
     * of the SAME product, e.g. front + back).
     *
     * Bailey, Aug 7 2026: the scanner needs to store both sides — the front for
     * product identity, the back for the INCI list. Photographing only the back
     * loses the name; photographing only the front loses the ingredients. Before
     * this, each photo was an independent POST, so front and back became two
     * unrelated scan rows for one bottle and neither was complete.
     */
    const MAX_IMAGES = 4
    const images: ScanImage[] = []

    if (!contentType.includes('application/json')) {
      throw new AppError('Content-Type must be application/json', 400)
    }

    const body = await request.json()
    const raw: unknown = Array.isArray(body.images)
      ? body.images
      : body.image
        ? [body.image]
        : null

    if (!raw || (Array.isArray(raw) && raw.length === 0)) {
      throw new AppError('Missing image data', 400)
    }
    if (!Array.isArray(raw)) {
      throw new AppError('Invalid image format. Expected base64 data URL.', 400)
    }
    if (raw.length > MAX_IMAGES) {
      throw new AppError(`Too many images. Send at most ${MAX_IMAGES} views of one product.`, 400)
    }

    for (const entry of raw) {
      if (typeof entry !== 'string') {
        throw new AppError('Invalid image format. Expected base64 data URL.', 400)
      }
      // Expect base64 data URL: "data:image/jpeg;base64,..."
      const match = entry.match(/^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/)
      if (!match) {
        throw new AppError('Invalid image format. Expected base64 data URL.', 400)
      }
      images.push({
        mediaType: match[1] as ScanImage['mediaType'],
        base64: match[3],
      })
    }

    const anthropic = getAnthropicClient()

    // Label each view so the model knows these are the SAME product, and put the
    // instruction AFTER the images (an instruction trailing the content it refers
    // to is followed more reliably than one that precedes it).
    const imageBlocks: Anthropic.ContentBlockParam[] = images.flatMap((img, i) => {
      const blocks: Anthropic.ContentBlockParam[] = []
      if (images.length > 1) {
        blocks.push({
          type: 'text',
          text: `View ${i + 1} of ${images.length} of the same product:`,
        })
      }
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
      })
      return blocks
    })

    const response = await anthropic.messages.create({
      model: MODELS.primary,
      // 4096 truncated real labels. A 40-ingredient INCI list emits 7 verbose
      // fields per ingredient, and a cut-off response is invalid JSON — which
      // surfaced to the user as a bare "Internal server error" (the 500 branch of
      // handleApiError masks the message). Raised, and stop_reason is now checked
      // so truncation reports itself instead of masquerading as a parse failure.
      max_tokens: 8192,
      system: SCAN_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            {
              type: 'text',
              text:
                images.length > 1
                  ? `These ${images.length} photos are different views of ONE product (typically front and back). Merge them into a single analysis: take the name and brand from whichever view shows them, and the ingredient list from whichever view shows it. Extract all ingredients and provide safety analysis.`
                  : 'Analyze this Korean beauty product label. Extract all ingredients and provide safety analysis.',
            },
          ],
        },
      ],
    })

    const textContent = response.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new AppError('No analysis result from AI', 500)
    }

    // NOTE: do NOT add an assistant-prefill turn (`{ role: 'assistant', content: '{' }`)
    // to force bare JSON here. Opus 4.8 REJECTS prefill outright —
    // "This model does not support assistant message prefill. The conversation must
    // end with a user message." (400, verified against the live API Aug 7 2026).
    // Adding it would 400 every scan. The system prompt asks for bare JSON instead,
    // and the fence/prose stripping below is the belt-and-braces.
    const rawText = textContent.text

    // A truncated response is not a parse bug — say which one it is. Without this
    // both failures collapsed into the same opaque 500 and were indistinguishable
    // in the logs.
    if (response.stop_reason === 'max_tokens') {
      console.error('[scan] response truncated at max_tokens', {
        userId: user.id,
        images: images.length,
        chars: rawText.length,
      })
      throw new AppError(
        'That label has a very long ingredient list and the analysis was cut off. Try photographing just the ingredient panel.',
        422
      )
    }

    // Parse the JSON from Claude's response. Strip a ```json fence first — with
    // prefill unavailable on this model, a fenced reply is the likeliest deviation
    // from the requested bare object, and the greedy brace match below would
    // otherwise be the only thing standing between a fence and a 500.
    let analysis: Record<string, unknown>
    const fenced = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    try {
      analysis = JSON.parse(fenced)
    } catch {
      const jsonMatch = fenced.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[scan] unparseable analysis', {
          userId: user.id,
          stopReason: response.stop_reason,
          preview: rawText.slice(0, 300),
        })
        throw new AppError(
          'Could not read that label clearly. Try a straight-on photo of the ingredient panel in even light.',
          422
        )
      }
      try {
        analysis = JSON.parse(jsonMatch[0])
      } catch {
        console.error('[scan] JSON recovery failed', {
          userId: user.id,
          stopReason: response.stop_reason,
          preview: rawText.slice(0, 300),
        })
        throw new AppError(
          'Could not read that label clearly. Try a straight-on photo of the ingredient panel in even light.',
          422
        )
      }
    }

    // Drop placeholder ingredient rows the model may still emit for an unreadable
    // panel. One of Bailey's Aug 7 scans stored a single ingredient literally named
    // "NOT VISIBLE IN IMAGE" — which then flows into ingredients_found and every
    // downstream conflict check as if it were a real INCI name. An empty list is
    // the honest representation of "could not read".
    // Anchored to the START and requiring a word boundary so real INCI names that
    // merely BEGIN with these letters survive — "Nonapeptide-1", "Nutmeg Oil" and
    // "Nannochloropsis Oculata Extract" must never be dropped. Dash-only values
    // include the unicode dashes (– — ‒) an AI is more likely to emit than "-".
    const PLACEHOLDER_INGREDIENT = /^(not visible|not legible|not readable|unknown|unclear|n\/?a|none|null|[-–—‒]+)\s*$|^(not visible|not legible|not readable|unclear)\b/i
    if (Array.isArray(analysis.ingredients)) {
      const before = analysis.ingredients.length
      analysis.ingredients = (analysis.ingredients as Array<{ name_inci?: string; name_en?: string }>)
        .filter((ing) => {
          const name = String(ing?.name_inci || ing?.name_en || '').trim()
          return name.length > 0 && !PLACEHOLDER_INGREDIENT.test(name)
        })
      const dropped = before - (analysis.ingredients as unknown[]).length
      if (dropped > 0) {
        console.warn('[scan] dropped placeholder ingredient rows', { userId: user.id, dropped })
      }
    }

    // Try to match against existing products in our database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let productMatch = null
    if (analysis.product_name_en || analysis.brand) {
      const searchTerm = String(analysis.product_name_en || analysis.brand || '')
      const { data } = await supabase
        .from('ss_products')
        .select('*')
        .or(`name_en.ilike.%${sanitizeSearchTerm(searchTerm)}%,name_ko.ilike.%${sanitizeSearchTerm(searchTerm)}%`)
        .limit(1)

      if (data && data.length > 0) {
        productMatch = data[0]
      }
    }

    // Check for ingredient conflicts against user's current routine
    let conflicts: Array<{
      scanned_ingredient: string
      routine_ingredient: string
      severity: string
      description: string
      recommendation: string
    }> = []
    // An empty `conflicts` list means "checked, found none". This flag records
    // the OTHER case — the check could not run — so the client and the stored
    // scan can tell them apart. Silent failure on a safety path is how a user
    // ends up buying a product that clashes with their routine.
    let conflictCheckFailed = false

    try {
      const ingredients = analysis.ingredients as Array<{ name_inci: string }> | undefined
      if (ingredients?.length) {
        // Look up scanned INCI names in our ingredient database
        const inciNames = ingredients.map((i: { name_inci: string }) => i.name_inci)
        // A failed lookup here silently skips the ENTIRE conflict block below.
        // The .in() list is built from OCR'd label text, so a mis-read
        // character is a realistic way to break it. Rethrow so the catch marks
        // the check as failed rather than letting it look clean.
        const { data: matchedIngredients, error: matchedIngredientsError } = await supabase
          .from('ss_ingredients')
          .select('id, name_inci')
          .in('name_inci', inciNames)

        if (matchedIngredientsError) {
          throw new Error(`scanned-ingredient lookup failed: ${matchedIngredientsError.message}`)
        }

        if (matchedIngredients?.length) {
          const scannedIds = matchedIngredients.map((i) => i.id)

          // Get ingredients from the user's active routine
          // Nested embed — breaks if a FK relationship name changes. Without
          // this the routine set comes back empty and the conflict check is
          // skipped entirely, indistinguishable from "user has no routine".
          const { data: routineIngredients, error: routineIngredientsError } = await supabase
            .from('ss_user_routines')
            .select(`
              id,
              ss_routine_products (
                ss_product_ingredients:product_id (
                  ingredient_id
                )
              )
            `)
            .eq('user_id', user.id)
            .eq('is_active', true)

          if (routineIngredientsError) {
            throw new Error(`routine-ingredient lookup failed: ${routineIngredientsError.message}`)
          }

          const routineIngredientIds = new Set<string>()
          if (routineIngredients) {
            for (const routine of routineIngredients) {
              const products = routine.ss_routine_products as Array<{
                ss_product_ingredients: Array<{ ingredient_id: string }>
              }> | null
              if (products) {
                for (const product of products) {
                  const pIngredients = product.ss_product_ingredients
                  if (Array.isArray(pIngredients)) {
                    for (const pi of pIngredients) {
                      routineIngredientIds.add(pi.ingredient_id)
                    }
                  }
                }
              }
            }
          }

          if (routineIngredientIds.size > 0) {
            const routineIds = Array.from(routineIngredientIds)

            // Fetch rules touching either side, then pair them in memory.
            //
            // The previous version built scannedIds × routineIds `or` clauses in
            // ONE URL. Measured against live data: a subscriber with 163 routine
            // ingredients and a ~30-ingredient label produces 9,780 clauses —
            // roughly 880 KB of URL, far past any server limit. So this query
            // could NOT succeed for the users with the most to lose, and the
            // failure was swallowed by the "non-critical" catch below: they
            // scanned a product in-store and saw no warning.
            //
            // Same shape as the fix already proven in conflict-detector.ts:
            // ss_ingredient_conflicts is a small curated rule table, so two
            // .in() filters answer this in a single cheap request.
            const scannedIdSet = new Set(scannedIds)
            const routineIdSet = new Set(routineIds)
            const bothSides = [...new Set([...scannedIds, ...routineIds])]

            const { data: candidateRules, error: candidateRulesError } = await supabase
              .from('ss_ingredient_conflicts')
              .select('ingredient_a_id, ingredient_b_id, severity, description, recommendation')
              .in('ingredient_a_id', bothSides)
              .in('ingredient_b_id', bothSides)

            // A dead query here is NOT "no conflicts". Rethrow so the catch
            // records it as a failed check instead of an all-clear.
            if (candidateRulesError) {
              throw new Error(`conflict rule lookup failed: ${candidateRulesError.message}`)
            }

            // A rule applies only if it spans the SCANNED product and the
            // routine — in either column order.
            const foundConflicts = (candidateRules || []).filter(
              (c) =>
                (scannedIdSet.has(c.ingredient_a_id) && routineIdSet.has(c.ingredient_b_id)) ||
                (scannedIdSet.has(c.ingredient_b_id) && routineIdSet.has(c.ingredient_a_id))
            )

            if (foundConflicts?.length) {
              // Map ingredient IDs back to names
              const allIds = new Set([
                ...scannedIds,
                ...routineIds,
              ])
              const { data: allNames } = await supabase
                .from('ss_ingredients')
                .select('id, name_inci')
                .in('id', Array.from(allIds))

              const nameMap = new Map(allNames?.map((n) => [n.id, n.name_inci]) ?? [])

              conflicts = foundConflicts.map((c) => ({
                scanned_ingredient: nameMap.get(c.ingredient_a_id) ?? nameMap.get(c.ingredient_b_id) ?? 'Unknown',
                routine_ingredient: nameMap.get(c.ingredient_b_id) ?? nameMap.get(c.ingredient_a_id) ?? 'Unknown',
                severity: c.severity,
                description: c.description,
                recommendation: c.recommendation,
              }))
            }
          }
        }
      }
    } catch (conflictError) {
      // Don't fail the whole scan — the AI analysis is still valuable — but
      // never let a failed check look like a clean one.
      conflictCheckFailed = true
      console.error('[scan] conflict detection failed', {
        error: conflictError instanceof Error ? conflictError.message : String(conflictError),
        userId: user.id,
      })
    }

    // Enrich scan results with personalized intelligence
    let enrichment = null
    try {
      const ingredientNames = (analysis.ingredients as Array<{ name_en: string; name_inci: string }> || [])
        .map(i => i.name_en || i.name_inci)
      const brand = (analysis.brand as string) || ''

      // Fetch user's skin type for community data filtering
      const { data: userProfile } = await supabase
        .from('ss_user_profiles')
        .select('skin_type')
        .eq('user_id', user.id)
        .maybeSingle()

      enrichment = await enrichScanResult(
        supabase,
        user.id,
        productMatch?.id || null,
        brand,
        ingredientNames,
        userProfile?.skin_type || undefined
      )
    } catch {
      // Enrichment is non-critical — don't fail the scan
    }

    // Detect reformulation if product matched and ingredients were extracted
    let reformulation = null
    try {
      const ingredients = analysis.ingredients as Array<{ name_inci: string }> | undefined
      if (productMatch?.id && ingredients?.length) {
        const inciNames = ingredients.map((i) => i.name_inci)
        const detection = await detectReformulation(supabase, productMatch.id, inciNames)
        if (detection.changed) {
          const serviceClient = getServiceClient()
          const result = await recordReformulation(
            serviceClient,
            productMatch.id,
            detection,
            'scan_comparison'
          )
          reformulation = {
            detected: true,
            added: detection.added,
            removed: detection.removed,
            reordered: detection.reordered,
            alerts_created: result.alertsCreated,
          }
        }
      }
    } catch {
      // Reformulation detection is non-critical — don't fail the scan
    }

    // Persist scan history (non-critical — don't fail the scan)
    try {
      const ingredients = analysis.ingredients as Array<{ name_inci: string }> | undefined
      const ingredientNames = ingredients?.map((i) => i.name_inci) ?? []
      const serviceClient = getServiceClient()
      await serviceClient.from('ss_user_scans').insert({
        user_id: user.id,
        product_id: productMatch?.id ?? null,
        scan_type: 'label',
        extracted_text: (analysis.extracted_text as string) ?? null,
        ingredients_found: ingredientNames,
        analysis_result: {
          analysis,
          conflicts,
          conflict_check_failed: conflictCheckFailed,
          enrichment,
          reformulation,
          // How many views fed this analysis. A front+back scan is a materially
          // more complete record than a single blurry back-of-bottle shot, and
          // without this the two are indistinguishable after the fact.
          image_count: images.length,
        },
      })
    } catch {
      // Scan history persistence is non-critical
    }

    // Carry a non-catalog scan's INCI onto the user's library entry.
    //
    // The scan already extracts real ingredients for products we don't carry —
    // a Cetaphil cleanser scan captured 11 of them. That data was written to
    // ss_user_scans and read back by exactly one thing: a count on a dashboard
    // widget. Yuri never saw it, and /api/library actively filters non-catalog
    // scans out. So a user could photograph a label, watch Yuri analyze it, and
    // have her be blind to that same product one message later — while an
    // interaction check across it returned clean.
    //
    // Only fires when the product ISN'T in the catalog (catalog products already
    // have full INCI) and only updates an entry the user already owns; scanning
    // is not a statement of ownership, so it never creates a row.
    try {
      const ingredients = analysis.ingredients as Array<{ name_inci: string }> | undefined
      const inciNames = (ingredients ?? [])
        .map((i) => i.name_inci)
        .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
        .map((n) => n.trim())

      // A front-of-bottle photo yields placeholder text, not an ingredient list.
      // Storing that as INCI would make a blind product look examined.
      const looksLikeRealInci =
        inciNames.length >= 3 && !/^not listed|^unknown|^n\/?a$/i.test(inciNames[0])

      const scannedName = String(analysis.product_name_en || '').trim()

      if (!productMatch?.id && looksLikeRealInci && scannedName) {
        const serviceClient = getServiceClient()
        const { data: owned } = await serviceClient
          .from('ss_user_products')
          .select('id')
          .eq('user_id', user.id)
          .is('product_id', null)
          .ilike('custom_name', `%${scannedName}%`)
          .limit(1)
          .maybeSingle()

        if (owned?.id) {
          await serviceClient
            .from('ss_user_products')
            .update({
              ingredients_inci: inciNames,
              ingredients_source: 'label_scan',
              ingredients_captured_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', owned.id)
        }
      }
    } catch (err) {
      // Never fail a scan over this — the analysis is what the user asked for.
      console.error('[scan] failed to attach INCI to library entry', err)
    }

    return NextResponse.json({
      success: true,
      analysis,
      product_match: productMatch,
      conflicts,
      conflict_check_failed: conflictCheckFailed,
      enrichment,
      reformulation,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
