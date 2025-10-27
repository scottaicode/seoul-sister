// Affiliate tracking and commission management
import { createClient } from './supabase'

// Retailer affiliate programs configuration
export const AFFILIATE_PROGRAMS = {
  'YesStyle': {
    programName: 'YesStyle Partner Program',
    baseUrl: 'https://www.yesstyle.com',
    trackingParam: 'rco=SEOULSIS',
    commissionRate: 10, // 10% commission
    cookieDuration: 30, // 30 days
  },
  'Olive Young Global': {
    programName: 'Olive Young Affiliate',
    baseUrl: 'https://global.oliveyoung.com',
    trackingParam: 'utm_source=seoul_sister',
    commissionRate: 8,
    cookieDuration: 7,
  },
  'Sephora': {
    programName: 'Sephora Affiliate',
    baseUrl: 'https://www.sephora.com',
    trackingParam: 'utm_source=seoul_sister&utm_medium=affiliate',
    commissionRate: 5,
    cookieDuration: 24, // 24 hours
  },
  'Ulta': {
    programName: 'Ulta Affiliate Network',
    baseUrl: 'https://www.ulta.com',
    trackingParam: 'utm_source=seoul_sister',
    commissionRate: 4,
    cookieDuration: 7,
  },
  'iHerb': {
    programName: 'iHerb Rewards',
    baseUrl: 'https://www.iherb.com',
    trackingParam: 'rcode=SEOUL20',
    commissionRate: 12,
    cookieDuration: 30,
  },
  'Amazon': {
    programName: 'Amazon Associates',
    baseUrl: 'https://www.amazon.com',
    trackingParam: 'tag=seoulsis-20',
    commissionRate: 3,
    cookieDuration: 1, // 24 hours
  },
  'Stylevana': {
    programName: 'Stylevana Partners',
    baseUrl: 'https://www.stylevana.com',
    trackingParam: 'utm_source=seoul_sister',
    commissionRate: 15,
    cookieDuration: 30,
  },
  'Sokoglam': {
    programName: 'Sokoglam Affiliate',
    baseUrl: 'https://sokoglam.com',
    trackingParam: 'ref=seoul_sister',
    commissionRate: 10,
    cookieDuration: 30,
  },
} as const

export type RetailerName = keyof typeof AFFILIATE_PROGRAMS

// Generate affiliate link for a product
export async function generateAffiliateLink(
  productId: string,
  retailer: RetailerName,
  directUrl: string
): Promise<string> {
  const program = AFFILIATE_PROGRAMS[retailer]
  if (!program) {
    return directUrl
  }

  // Build affiliate URL
  const separator = directUrl.includes('?') ? '&' : '?'
  const affiliateUrl = `${directUrl}${separator}${program.trackingParam}`

  // Store in database for tracking
  const supabase = createClient()
  await supabase
    .from('affiliate_links')
    .upsert({
      product_id: productId,
      retailer,
      affiliate_url: affiliateUrl,
      direct_url: directUrl,
      commission_rate: program.commissionRate,
      is_active: true,
    })
    .select()
    .single()

  return affiliateUrl
}

// Track affiliate link click
export async function trackAffiliateClick(
  productId: string,
  retailer: string
): Promise<void> {
  const supabase = createClient()

  // Increment click count
  const { data: link } = await supabase
    .from('affiliate_links')
    .select('click_count')
    .eq('product_id', productId)
    .eq('retailer', retailer)
    .single()

  if (link) {
    await supabase
      .from('affiliate_links')
      .update({
        click_count: (link.click_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('product_id', productId)
      .eq('retailer', retailer)
  }
}

// Calculate potential earnings from affiliate links
export async function calculatePotentialEarnings(
  productPrice: number,
  retailer: RetailerName
): Promise<number> {
  const program = AFFILIATE_PROGRAMS[retailer]
  if (!program) return 0

  return (productPrice * program.commissionRate) / 100
}

// Get best affiliate deal for a product
export async function getBestAffiliateDeal(productId: string) {
  const supabase = createClient()

  const { data: priceHistory } = await supabase
    .from('price_tracking_history')
    .select('*')
    .eq('product_id', productId)
    .order('price', { ascending: true })
    .limit(1)

  if (!priceHistory || priceHistory.length === 0) {
    return null
  }

  const bestPrice = priceHistory[0]
  const retailer = bestPrice.retailer as RetailerName
  const program = AFFILIATE_PROGRAMS[retailer]

  if (!program) {
    return {
      ...bestPrice,
      affiliateUrl: null,
      commission: 0,
    }
  }

  // Get or create affiliate link
  const { data: affiliateLink } = await supabase
    .from('affiliate_links')
    .select('*')
    .eq('product_id', productId)
    .eq('retailer', retailer)
    .single()

  return {
    ...bestPrice,
    affiliateUrl: affiliateLink?.affiliate_url,
    commission: calculatePotentialEarnings(bestPrice.price, retailer),
    program: program.programName,
  }
}

// Retailer comparison for a product
export async function compareRetailerPrices(productId: string) {
  const supabase = createClient()

  // Get latest prices from all retailers
  const { data: prices } = await supabase
    .from('price_tracking_history')
    .select('*')
    .eq('product_id', productId)
    .gte('tracked_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
    .order('price', { ascending: true })

  if (!prices || prices.length === 0) {
    return []
  }

  // Get trust scores for retailers
  const { data: trustScores } = await supabase
    .from('retailer_trust_scores')
    .select('*')

  const trustScoreMap = (trustScores || []).reduce((acc: any, score: any) => {
    acc[score.retailer_name] = score
    return acc
  }, {})

  // Enhance with affiliate information
  const comparisons = await Promise.all(
    prices.map(async (price: any) => {
      const retailer = price.retailer as RetailerName
      const program = AFFILIATE_PROGRAMS[retailer]
      const trustScore = trustScoreMap[price.retailer] || {}

      const { data: affiliateLink } = await supabase
        .from('affiliate_links')
        .select('affiliate_url')
        .eq('product_id', productId)
        .eq('retailer', retailer)
        .single()

      return {
        retailer: price.retailer,
        price: price.price,
        shipping: price.shipping_cost || 0,
        totalCost: price.total_cost || price.price + (price.shipping_cost || 0),
        availability: price.availability,
        trustScore: trustScore.overall_trust_rating || 0,
        authenticityScore: trustScore.authenticity_score || 0,
        affiliateUrl: affiliateLink?.affiliate_url,
        commission: program ? (price.price * program.commissionRate) / 100 : 0,
        lastUpdated: price.tracked_at,
        promotions: price.promotion_info,
      }
    })
  )

  return comparisons.sort((a, b) => a.totalCost - b.totalCost)
}

// Initialize affiliate tracking on page load
export function initAffiliateTracking() {
  // Check for affiliate cookies and attribution
  const urlParams = new URLSearchParams(window.location.search)

  // Store affiliate attribution in localStorage
  for (const [retailer, program] of Object.entries(AFFILIATE_PROGRAMS)) {
    const paramValue = urlParams.get(program.trackingParam.split('=')[0])
    if (paramValue) {
      localStorage.setItem(
        `affiliate_${retailer}`,
        JSON.stringify({
          timestamp: Date.now(),
          expiry: Date.now() + program.cookieDuration * 24 * 60 * 60 * 1000,
        })
      )
    }
  }
}

// Check if user came through an affiliate link
export function getAffiliateAttribution(): RetailerName | null {
  for (const retailer of Object.keys(AFFILIATE_PROGRAMS) as RetailerName[]) {
    const stored = localStorage.getItem(`affiliate_${retailer}`)
    if (stored) {
      const data = JSON.parse(stored)
      if (Date.now() < data.expiry) {
        return retailer
      } else {
        localStorage.removeItem(`affiliate_${retailer}`)
      }
    }
  }
  return null
}