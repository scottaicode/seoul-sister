interface ProductWithCategory {
  id: string
  name_en: string
  brand_en: string
  category: string
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

    // Same position: sort alphabetically by name
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
 * Detect missing essential steps in a routine.
 */
export function detectMissingSteps(
  routineType: 'am' | 'pm',
  products: ProductWithCategory[]
): MissingStepAlert[] {
  const categoriesPresent = new Set(products.map((p) => p.category))
  const alerts: MissingStepAlert[] = []

  // Required steps
  if (!categoriesPresent.has('cleanser')) {
    alerts.push({
      category: 'cleanser',
      label: 'Cleanser',
      importance: 'required',
      reason: 'Cleansing removes impurities and preps skin for actives',
    })
  }

  if (!categoriesPresent.has('moisturizer') && !categoriesPresent.has('oil')) {
    alerts.push({
      category: 'moisturizer',
      label: 'Moisturizer',
      importance: 'required',
      reason: 'Moisturizer seals in hydration and protects the skin barrier',
    })
  }

  if (routineType === 'am' && !categoriesPresent.has('sunscreen')) {
    alerts.push({
      category: 'sunscreen',
      label: 'Sunscreen (SPF 50+ PA++++)',
      importance: 'required',
      reason: 'Sunscreen is the most important anti-aging step. Korean dermatologists consider this non-negotiable.',
    })
  }

  // Recommended steps
  if (!categoriesPresent.has('toner')) {
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
