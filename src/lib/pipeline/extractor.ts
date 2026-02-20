/**
 * Phase 9.2 — Sonnet AI Extraction & Normalization
 *
 * Takes raw scraped product data and uses Claude Sonnet 4.5 to extract
 * structured, normalized product records ready for insertion into ss_products.
 */

import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import type { RawProductData, ProcessedProductData } from './types'
import type { TokenUsage } from './cost-tracker'

const EXTRACTION_SYSTEM_PROMPT = `You are a K-beauty product data specialist. Given raw product data scraped from a Korean beauty retailer, extract and normalize it into a structured JSON object.

Rules:
- category: Must be exactly one of: cleanser, toner, essence, serum, ampoule, moisturizer, sunscreen, mask, exfoliator, lip_care, eye_care, oil, mist, spot_treatment
- subcategory: A 2-3 word descriptor (e.g., "foam cleanser", "sleeping mask", "vitamin c serum", "cleansing oil", "sheet mask", "gel moisturizer", "cleansing balm", "micellar water", "snail essence", "retinol serum")
- description_en: Write a concise 1-2 sentence product description. Focus on key active ingredients, what the product does, and who it's for. Keep it factual. Do NOT use marketing superlatives like "revolutionary" or "amazing."
- volume_ml: Extract numeric volume in milliliters. Convert from fl oz if needed (1 fl oz = 29.5735 mL). For pads/sheets, use total product weight if available, otherwise null.
- pao_months: Estimate Period After Opening based on category: serums/ampoules=6, moisturizers=12, cleansers=12, sunscreens=6, masks=6, toners=12, lip products=12, eye care=6, essences=12, exfoliators=12, oils=6, mists=12, spot treatments=6. Override if the product data specifies a PAO.
- shelf_life_months: Unopened shelf life. Most K-beauty products = 24-36 months. Default to 30 if unknown.
- For sunscreens ONLY: Extract spf_rating (number), pa_rating ("PA+", "PA++", "PA+++", or "PA++++"), sunscreen_type ("chemical", "physical", or "hybrid"), white_cast ("none", "minimal", "moderate", or "heavy" — infer from ingredients: zinc oxide/titanium dioxide = likely white cast), finish ("matte", "dewy", "natural", or "satin"), under_makeup (boolean — true if description mentions makeup-friendly or primer effect), water_resistant (boolean). For non-sunscreens, set all sunscreen fields to null.
- name_en: Clean up the English product name. Remove retailer-specific prefixes/suffixes. Keep brand name separate from product name.
- brand_en: Normalize brand name to proper casing (e.g., "COSRX" not "cosrx", "Dr. Jart+" not "DR JART").
- name_ko: Keep Korean name as-is if present. If only English available, set to null.
- rating_avg: Pass through if present, rounded to 1 decimal place. Null if not available.
- review_count: Pass through if present. Null if not available.
- is_verified: Set to false (scraped data is unverified until manually confirmed).
- ingredients_raw: Pass through the raw ingredient string as-is (will be parsed separately).

Return ONLY a valid JSON object matching the expected schema. No markdown fencing, no explanation.`

function buildUserPrompt(raw: RawProductData): string {
  return `Extract and normalize this product data:

Product Name: ${raw.name_en}
Korean Name: ${raw.name_ko ?? 'N/A'}
Brand: ${raw.brand_en}
Korean Brand: ${raw.brand_ko ?? 'N/A'}
Category (from retailer): ${raw.category_raw}
Price (USD): ${raw.price_usd ?? 'N/A'}
Price (KRW): ${raw.price_krw ?? 'N/A'}
Description: ${raw.description_raw || 'N/A'}
Ingredients: ${raw.ingredients_raw ?? 'N/A'}
Volume: ${raw.volume_display ?? 'N/A'}
Rating: ${raw.rating_avg ?? 'N/A'}
Reviews: ${raw.review_count ?? 'N/A'}
Image URL: ${raw.image_url ?? 'N/A'}
Source: ${raw.source}
Source URL: ${raw.source_url}`
}

export interface ExtractionResult {
  data: ProcessedProductData
  usage: TokenUsage
}

/**
 * Extract structured product data from raw scraped data using Sonnet 4.5.
 * Returns both the processed data and token usage for cost tracking.
 */
export async function extractProductData(
  raw: RawProductData
): Promise<ExtractionResult> {
  const client = getAnthropicClient()

  const response = await client.messages.create({
    model: MODELS.background,
    max_tokens: 2048,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserPrompt(raw) },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Sonnet extraction')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(textBlock.text)
  } catch {
    // Strip markdown code fences if present (```json ... ```)
    let cleaned = textBlock.text.trim()
    if (cleaned.startsWith('```')) {
      // Remove opening fence (```json or ```)
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '')
      // Remove closing fence
      cleaned = cleaned.replace(/\n?```\s*$/, '')
    }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Last resort: extract the outermost JSON object
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error(`Failed to parse Sonnet response as JSON: ${textBlock.text.slice(0, 200)}`)
      }
      parsed = JSON.parse(jsonMatch[0])
    }
  }

  const data = normalizeExtraction(parsed, raw)

  return {
    data,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  }
}

/**
 * Normalize and validate the AI-extracted data, filling defaults where the model
 * omitted fields or returned unexpected values.
 */
function normalizeExtraction(
  parsed: Record<string, unknown>,
  raw: RawProductData
): ProcessedProductData {
  const validCategories = [
    'cleanser', 'toner', 'essence', 'serum', 'ampoule', 'moisturizer',
    'sunscreen', 'mask', 'exfoliator', 'lip_care', 'eye_care', 'oil',
    'mist', 'spot_treatment',
  ]

  const category = validCategories.includes(parsed.category as string)
    ? (parsed.category as ProcessedProductData['category'])
    : 'moisturizer' // safe fallback

  const validPaRatings = ['PA+', 'PA++', 'PA+++', 'PA++++']
  const validSunscreenTypes = ['chemical', 'physical', 'hybrid']
  const validWhiteCast = ['none', 'minimal', 'moderate', 'heavy']
  const validFinish = ['matte', 'dewy', 'natural', 'satin']

  const isSunscreen = category === 'sunscreen'

  return {
    name_en: asString(parsed.name_en) || raw.name_en,
    name_ko: asStringOrNull(parsed.name_ko) ?? raw.name_ko,
    brand_en: asString(parsed.brand_en) || raw.brand_en,
    brand_ko: asStringOrNull(parsed.brand_ko) ?? raw.brand_ko,
    category,
    subcategory: asStringOrNull(parsed.subcategory),
    description_en: asString(parsed.description_en) || raw.description_raw.slice(0, 300),
    volume_ml: asNumberOrNull(parsed.volume_ml),
    volume_display: asStringOrNull(parsed.volume_display) ?? raw.volume_display,
    price_krw: asNumberOrNull(parsed.price_krw) ?? raw.price_krw,
    price_usd: asNumberOrNull(parsed.price_usd) ?? raw.price_usd,
    rating_avg: roundOrNull(asNumberOrNull(parsed.rating_avg) ?? raw.rating_avg, 1),
    review_count: asNumberOrNull(parsed.review_count) ?? raw.review_count,
    pao_months: asNumberOrNull(parsed.pao_months),
    shelf_life_months: asNumberOrNull(parsed.shelf_life_months) ?? 30,
    image_url: asStringOrNull(parsed.image_url) ?? raw.image_url,
    is_verified: false,
    ingredients_raw: asStringOrNull(parsed.ingredients_raw) ?? raw.ingredients_raw,
    // Sunscreen-specific fields
    spf_rating: isSunscreen ? asNumberOrNull(parsed.spf_rating) : null,
    pa_rating: isSunscreen && validPaRatings.includes(parsed.pa_rating as string)
      ? (parsed.pa_rating as string)
      : null,
    sunscreen_type: isSunscreen && validSunscreenTypes.includes(parsed.sunscreen_type as string)
      ? (parsed.sunscreen_type as string)
      : null,
    white_cast: isSunscreen && validWhiteCast.includes(parsed.white_cast as string)
      ? (parsed.white_cast as string)
      : null,
    finish: isSunscreen && validFinish.includes(parsed.finish as string)
      ? (parsed.finish as string)
      : null,
    under_makeup: isSunscreen ? asBooleanOrNull(parsed.under_makeup) : null,
    water_resistant: isSunscreen ? asBooleanOrNull(parsed.water_resistant) : null,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function asStringOrNull(v: unknown): string | null {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  return null
}

function asNumberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && !isNaN(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }
  return null
}

function asBooleanOrNull(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  return null
}

function roundOrNull(v: number | null, decimals: number): number | null {
  if (v === null) return null
  const factor = 10 ** decimals
  return Math.round(v * factor) / factor
}
