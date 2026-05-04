interface ProductWithCategory {
  id: string
  name_en: string
  brand_en: string
  category: string
  texture_weight?: number | null
}

// ---------------------------------------------------------------------------
// Device placement rules — structured data for verify_routine validation
// ---------------------------------------------------------------------------

export interface DevicePlacementRule {
  deviceKeywords: string[]
  placement: 'before_products' | 'with_products' | 'after_products'
  requiresProduct: boolean
  description: string
}

const DEVICE_PLACEMENT_RULES: DevicePlacementRule[] = [
  {
    deviceKeywords: ['led mask', 'red light', 'blue light', 'light therapy', 'light mask', 'led panel'],
    placement: 'before_products',
    requiresProduct: false,
    description: 'LED/light therapy goes on bare, clean skin immediately after cleansing — before any serums, moisturizers, or actives. Light wavelengths penetrate best through clean skin without product barriers.',
  },
  {
    deviceKeywords: ['ems', 'booster mode', 'booster wand', 'microcurrent', 'mc mode'],
    placement: 'with_products',
    requiresProduct: true,
    description: 'EMS and microcurrent devices need product on the skin for conductivity and to drive actives deeper. Apply serum or moisturizer first, then use the device over it.',
  },
  {
    deviceKeywords: ['dermashot', 'electroporation'],
    placement: 'with_products',
    requiresProduct: true,
    description: 'Electroporation devices drive active ingredients deeper. Apply your target active serum first, then use the device.',
  },
  {
    deviceKeywords: ['gua sha', 'facial roller', 'jade roller', 'ice roller'],
    placement: 'with_products',
    requiresProduct: true,
    description: 'Facial tools need product for smooth gliding. Use over serum or facial oil.',
  },
  {
    deviceKeywords: ['airshot'],
    placement: 'with_products',
    requiresProduct: true,
    description: 'Airshot mode is gentle and works with product applied. Safe for sensitive areas.',
  },
]

/**
 * Look up the device placement rule for a product by name.
 * Returns null if the product is not recognized as a device.
 */
export function getDevicePlacementRule(productName: string): DevicePlacementRule | null {
  const nameLower = productName.toLowerCase()
  return DEVICE_PLACEMENT_RULES.find(rule =>
    rule.deviceKeywords.some(kw => nameLower.includes(kw))
  ) || null
}

export interface LayeringStep {
  position: number
  category: string
  label: string
}

export interface WaitTimeSuggestion {
  after_step: number
  product_name: string
  wait_minutes: number
  reason: string
}

export interface MissingStepAlert {
  category: string
  label: string
  importance: 'required' | 'recommended' | 'optional'
  reason: string
}

/**
 * Korean skincare layering order by category.
 * AM and PM share most steps, with sunscreen (AM) and sleeping mask (PM) as the final step.
 *
 * Position 0: Beauty devices (LED masks, red light, microcurrent) — applied to clean skin
 *             BEFORE any products. Light therapy needs direct skin contact for penetration.
 * Positions 1-8: Product layering follows thinnest-to-thickest texture rule.
 */
const LAYERING_ORDER: Record<string, { position: number; label: string }> = {
  // Devices — clean skin, before all products
  device: { position: 0, label: 'Beauty Device (LED/Red Light/Microcurrent)' },
  led_mask: { position: 0, label: 'LED / Red Light Mask' },
  // Products — thinnest to thickest
  cleanser: { position: 1, label: 'Cleanser' },
  toner: { position: 2, label: 'Toner' },
  essence: { position: 3, label: 'Essence' },
  serum: { position: 4, label: 'Serum' },
  ampoule: { position: 4, label: 'Ampoule' },
  eye_care: { position: 5, label: 'Eye Care' },
  moisturizer: { position: 6, label: 'Moisturizer' },
  oil: { position: 6, label: 'Facial Oil' },
  spot_treatment: { position: 4, label: 'Spot Treatment' },
  exfoliator: { position: 2, label: 'Exfoliator' },
  mist: { position: 2, label: 'Mist' },
  lip_care: { position: 7, label: 'Lip Care' },
  sunscreen: { position: 8, label: 'Sunscreen' },
  mask: { position: 8, label: 'Sleeping Mask / Sheet Mask' },
}

/**
 * Categories containing active ingredients that may need wait times.
 */
const ACTIVE_CATEGORIES = new Set(['serum', 'ampoule', 'exfoliator', 'spot_treatment'])

/**
 * Ingredient keywords that trigger wait time recommendations.
 */
const WAIT_TIME_TRIGGERS: Array<{
  keywords: string[]
  wait_minutes: number
  reason: string
}> = [
  {
    keywords: ['vitamin c', 'ascorbic acid', 'l-ascorbic acid'],
    wait_minutes: 15,
    reason: 'Vitamin C needs time at low pH for absorption',
  },
  {
    keywords: ['aha', 'glycolic acid', 'lactic acid', 'mandelic acid'],
    wait_minutes: 20,
    reason: 'AHA exfoliants need time to work at proper pH',
  },
  {
    keywords: ['bha', 'salicylic acid'],
    wait_minutes: 20,
    reason: 'BHA needs time to penetrate pores at proper pH',
  },
  {
    keywords: ['retinol', 'retinal', 'retinaldehyde', 'tretinoin', 'adapalene'],
    wait_minutes: 5,
    reason: 'Let retinoid absorb before layering to reduce irritation',
  },
]

/**
 * Device detection keywords — products that are beauty devices/tools,
 * not skincare products. These go BEFORE all products (position 0).
 */
const DEVICE_KEYWORDS = [
  'led mask', 'red light', 'blue light', 'light therapy',
  'microcurrent', 'dermaroller', 'derma roller', 'derma pen',
  'gua sha', 'jade roller', 'ice roller', 'facial steamer',
  'high frequency', 'galvanic', 'rf device', 'radio frequency',
  'dermastamp', 'dermashot', 'wand', 'booster mode',
]

/**
 * Check if a product is a beauty device based on its name.
 * Catches devices miscategorized as "mask" or other product categories.
 */
export function isBeautyDevice(productName: string): boolean {
  const lower = productName.toLowerCase()
  return DEVICE_KEYWORDS.some((kw) => lower.includes(kw))
}

/**
 * Get the effective layering position for a product, accounting for
 * devices that may be miscategorized (e.g., red light mask filed as "mask").
 */
export function getEffectivePosition(product: ProductWithCategory): number {
  // Device detection by name overrides category-based position
  if (isBeautyDevice(product.name_en)) return 0
  return LAYERING_ORDER[product.category]?.position ?? 5
}

/**
 * Suggest the optimal layering order for products based on their categories.
 * Returns products sorted by the Korean skincare layering order.
 * Devices (LED masks, red light, etc.) are always placed first (position 0).
 */
export function suggestLayeringOrder(
  products: ProductWithCategory[],
  routineType: 'am' | 'pm' | 'weekly' = 'am'
): ProductWithCategory[] {
  return [...products].sort((a, b) => {
    const posA = getEffectivePosition(a)
    const posB = getEffectivePosition(b)

    if (posA !== posB) return posA - posB

    // Same position: sort by texture_weight (thinnest first)
    const twA = a.texture_weight ?? null
    const twB = b.texture_weight ?? null
    if (twA !== null && twB !== null) return twA - twB
    // Products with texture data sort before those without
    if (twA !== null && twB === null) return -1
    if (twA === null && twB !== null) return 1

    // Fallback: alphabetical
    return a.name_en.localeCompare(b.name_en)
  })
}

/**
 * Get the standard layering steps for a routine type.
 */
export function getLayeringSteps(routineType: 'am' | 'pm'): LayeringStep[] {
  const steps: LayeringStep[] = [
    { position: 1, category: 'cleanser', label: 'Cleanser' },
    { position: 2, category: 'toner', label: 'Toner' },
    { position: 3, category: 'essence', label: 'Essence' },
    { position: 4, category: 'serum', label: 'Serum / Ampoule' },
    { position: 5, category: 'eye_care', label: 'Eye Care' },
    { position: 6, category: 'moisturizer', label: 'Moisturizer' },
  ]

  if (routineType === 'am') {
    steps.push({ position: 8, category: 'sunscreen', label: 'Sunscreen' })
  } else {
    steps.push({ position: 8, category: 'mask', label: 'Sleeping Mask' })
  }

  return steps
}

/**
 * Suggest wait times between steps based on active ingredients.
 * Uses product names as a proxy (checking for ingredient keywords in name).
 * For more accurate results, pass ingredientNames per product.
 */
export function suggestWaitTimes(
  products: Array<ProductWithCategory & { ingredientNames?: string[] }>
): WaitTimeSuggestion[] {
  const suggestions: WaitTimeSuggestion[] = []
  const sortedProducts = suggestLayeringOrder(products)

  for (let i = 0; i < sortedProducts.length; i++) {
    const product = sortedProducts[i] as ProductWithCategory & { ingredientNames?: string[] }
    const searchText = [
      product.name_en.toLowerCase(),
      ...(product.ingredientNames?.map((n: string) => n.toLowerCase()) ?? []),
    ].join(' ')

    for (const trigger of WAIT_TIME_TRIGGERS) {
      if (trigger.keywords.some((kw) => searchText.includes(kw))) {
        suggestions.push({
          after_step: i + 1,
          product_name: product.name_en,
          wait_minutes: trigger.wait_minutes,
          reason: trigger.reason,
        })
        break // Only one wait time per product
      }
    }
  }

  return suggestions
}

/**
 * Infer a category from custom step notes when the routine_product row has
 * no DB-backed product_id. Bailey's Phase 2 PM has "Shower / cleanse" as a
 * custom step — the function has no product to read category from, but the
 * note text is unambiguous about what step it represents.
 *
 * Returns null when the note doesn't map to any category (e.g. "Wait 10 min").
 */
function inferCategoryFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  const text = notes.toLowerCase()

  // Cleansing actions / micellar / shower step
  if (
    text.includes('cleanse') ||
    text.includes('cleanser') ||
    text.includes('shower') ||
    text.includes('water rinse') ||
    text.includes('micellar')
  ) {
    return 'cleanser'
  }

  // Sunscreen mentions
  if (text.includes('sunscreen') || text.includes('spf') || /\bsun\b/.test(text)) {
    return 'sunscreen'
  }

  // Toner application
  if (text.includes('toner')) return 'toner'

  // Moisturizer / cream / sealant references
  if (
    text.includes('moisturizer') ||
    text.includes('moisturiser') ||
    text.includes('cream') ||
    text.includes('sleeping mask') ||
    text.includes('occlusive')
  ) {
    return 'moisturizer'
  }

  // Devices and tools — these are NOT layering steps; skip
  if (
    text.includes('led') ||
    text.includes('ice roller') ||
    text.includes('cold spoon') ||
    text.includes('microcurrent') ||
    text.includes('booster wand') ||
    text.includes('red light') ||
    text.includes('blue light')
  ) {
    return 'device'
  }

  return null
}

/**
 * Detect missing essential steps in a routine.
 *
 * Phase-aware (v10.3.7): custom steps with informative notes count toward
 * the category-present set. Bailey's PM routine has "Shower / cleanse" as
 * a null-product custom step — pre-fix the cleanser-missing warning fired
 * even though her treatment plan deliberately puts cleansing in the shower.
 *
 * Treatment-plan-aware (v10.3.7): if the user's decision memory contains
 * an explicit exclusion of a category ("no cleanser AM", "barrier still
 * healing"), the warning is suppressed. We accept an optional excluded
 * categories set so the caller can pass in phase-derived exclusions
 * computed from decision_memory.
 */
export function detectMissingSteps(
  routineType: 'am' | 'pm',
  products: ProductWithCategory[],
  options?: {
    /** Custom step notes (for null-product routine entries) */
    customStepNotes?: Array<string | null | undefined>
    /** Categories the user has explicitly excluded from this routine (from decision memory) */
    excludedCategories?: Set<string>
  }
): MissingStepAlert[] {
  const categoriesPresent = new Set<string>(products.map((p) => p.category))

  // Walk custom step notes and infer categories — they count toward presence.
  for (const note of options?.customStepNotes || []) {
    const inferred = inferCategoryFromNotes(note)
    if (inferred && inferred !== 'device') categoriesPresent.add(inferred)
  }

  const excluded = options?.excludedCategories || new Set<string>()
  const alerts: MissingStepAlert[] = []

  // Required steps
  if (!categoriesPresent.has('cleanser') && !excluded.has('cleanser')) {
    alerts.push({
      category: 'cleanser',
      label: 'Cleanser',
      importance: 'required',
      reason: 'Cleansing removes impurities and preps skin for actives',
    })
  }

  if (
    !categoriesPresent.has('moisturizer') &&
    !categoriesPresent.has('oil') &&
    !excluded.has('moisturizer')
  ) {
    alerts.push({
      category: 'moisturizer',
      label: 'Moisturizer',
      importance: 'required',
      reason: 'Moisturizer seals in hydration and protects the skin barrier',
    })
  }

  if (routineType === 'am' && !categoriesPresent.has('sunscreen') && !excluded.has('sunscreen')) {
    alerts.push({
      category: 'sunscreen',
      label: 'Sunscreen (SPF 50+ PA++++)',
      importance: 'required',
      reason: 'Sunscreen is the most important anti-aging step. Korean dermatologists consider this non-negotiable.',
    })
  }

  // Recommended steps
  if (!categoriesPresent.has('toner') && !excluded.has('toner')) {
    alerts.push({
      category: 'toner',
      label: 'Toner',
      importance: 'recommended',
      reason: 'Toner balances pH and preps skin for better absorption of following steps',
    })
  }

  return alerts
}

/**
 * Get the position number for a product category in the layering order.
 * For device-aware positioning, use getEffectivePosition() with a full product object.
 */
export function getCategoryPosition(category: string): number {
  return LAYERING_ORDER[category]?.position ?? 5
}

/**
 * Get the position number for a product, using name-based device detection
 * to override the category position when appropriate.
 */
export function getProductPosition(category: string, productName: string): number {
  if (isBeautyDevice(productName)) return 0
  return LAYERING_ORDER[category]?.position ?? 5
}

/**
 * Get a display label for a product category.
 */
export function getCategoryLabel(category: string): string {
  return LAYERING_ORDER[category]?.label ?? category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}
