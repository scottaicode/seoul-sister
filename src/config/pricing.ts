/**
 * Centralized Pricing Configuration
 * Single source of truth for Seoul Sister pricing
 */

export const PRICING_CONFIG = {
  subscription: {
    starter: {
      price: 14.99,
      currency: 'USD',
      interval: 'month',
      trialDays: 14,
      features: [
        'AI-powered product recommendations',
        'Basic skin analysis (monthly)',
        'Price tracking on 50 products',
        'Deal alerts (daily digest)',
        'Access to community reviews'
      ]
    },
    premium: {
      price: 24.99,
      currency: 'USD',
      interval: 'month',
      trialDays: 14,
      recommended: true,
      features: [
        'Everything in Starter, plus:',
        'Unlimited AI skin analysis',
        'Real-time price tracking (all products)',
        'Instant deal notifications',
        'Ingredient compatibility analysis',
        'Personalized routine builder',
        'Priority customer support',
        'Exclusive early access to trends',
        'Retailer trust scores'
      ]
    },
    elite: {
      price: 44.99,
      currency: 'USD',
      interval: 'month',
      trialDays: 14,
      features: [
        'Everything in Premium, plus:',
        'Custom product sourcing',
        '1-on-1 virtual consultations (monthly)',
        'Beta features access',
        'Wholesale pricing access',
        'Custom formulation recommendations',
        'VIP customer service'
      ]
    },
    annual: {
      price: 239.99,
      currency: 'USD',
      interval: 'year',
      savings: 60.00,
      basedOn: 'premium'
    }
  },

  // Commission rates for affiliate links
  affiliate: {
    defaultRate: 0.08, // 8% default commission
    retailers: {
      'YesStyle': 0.10,
      'Olive Young': 0.07,
      'Sephora': 0.05,
      'iHerb': 0.08,
      'Amazon': 0.06
    }
  },

  // Service fees for orders (deprecated - moving to subscription model)
  serviceFee: {
    percentage: 0.15, // 15% service fee
    minimum: 5.00,    // Minimum $5 fee
    maximum: 25.00    // Maximum $25 fee
  }
} as const

export function calculateServiceFee(productPrice: number): number {
  const fee = productPrice * PRICING_CONFIG.serviceFee.percentage
  return Math.max(
    PRICING_CONFIG.serviceFee.minimum,
    Math.min(fee, PRICING_CONFIG.serviceFee.maximum)
  )
}

export function getSubscriptionPrice(): string {
  const { price, currency } = PRICING_CONFIG.subscription.premium
  return `${currency} ${price}/month`
}

export function getTrialEndDate(startDate: Date = new Date()): Date {
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + PRICING_CONFIG.subscription.premium.trialDays)
  return endDate
}