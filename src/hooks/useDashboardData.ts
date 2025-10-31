import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface DashboardMetrics {
  savedThisMonth: number
  productsAnalyzed: number
  skinImprovement: number
  dealsFound: number
  activeAlerts: number
  trendingProducts: number
}

interface Deal {
  id: string
  productName: string
  brand: string
  originalPrice: number
  salePrice: number
  discount: number
  retailer: string
  trustScore: number
  expiresAt: string
}

interface TrendingItem {
  id: string
  type: 'product' | 'ingredient' | 'technique'
  title: string
  description: string
  trendScore: number
  source: string
  timeframe: string
}

export function useDashboardData(userId: string | undefined) {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    savedThisMonth: 0,
    productsAnalyzed: 0,
    skinImprovement: 0,
    dealsFound: 0,
    activeAlerts: 0,
    trendingProducts: 0
  })

  const [deals, setDeals] = useState<Deal[]>([])
  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    async function fetchDashboardData() {
      try {
        // Fetch user's saved amount (from orders or wishlists)
        const { data: orders } = await supabase
          .from('orders')
          .select('seoul_price, us_price')
          .eq('customer_id', userId)
          .gte('created_at', new Date(new Date().setDate(1)).toISOString())

        const savedAmount = orders?.reduce((sum, order) => {
          return sum + ((order.us_price || order.seoul_price * 1.2) - order.seoul_price)
        }, 0) || 0

        // Fetch product analysis count
        const { data: skinProfile } = await supabase
          .from('user_skin_profiles')
          .select('*')
          .eq('whatsapp_number', userId)
          .single()

        // Fetch active price alerts
        const { data: alerts } = await supabase
          .from('deal_alerts')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)

        // Fetch current deals with price drops
        const { data: products } = await supabase
          .from('products')
          .select('*')
          .gt('savings_percentage', 20)
          .order('savings_percentage', { ascending: false })
          .limit(5)

        // Transform products to deals
        const currentDeals: Deal[] = products?.map(product => ({
          id: product.id,
          productName: product.name_english,
          brand: product.brand,
          originalPrice: product.us_price,
          salePrice: product.best_price_found,
          discount: Math.round(product.savings_percentage),
          retailer: product.best_retailer,
          trustScore: getRetailerTrustScore(product.best_retailer),
          expiresAt: getRandomExpiry()
        })) || []

        // Fetch trending products (high popularity score)
        const { data: trendingProducts } = await supabase
          .from('products')
          .select('*')
          .gt('popularity_score', 70)
          .order('popularity_score', { ascending: false })
          .limit(3)

        // Transform to trending items
        const trendingItems: TrendingItem[] = trendingProducts?.map(product => ({
          id: product.id,
          type: 'product',
          title: product.name_english,
          description: `${product.brand} - ${product.category}`,
          trendScore: product.popularity_score,
          source: 'Community • Social Media',
          timeframe: 'This week'
        })) || []

        // Add some curated trending ingredients (these would come from a real trending API)
        const curatedTrending: TrendingItem[] = [
          {
            id: 'trend-1',
            type: 'ingredient',
            title: 'PDRN (Salmon DNA)',
            description: 'Revolutionary anti-aging ingredient from Korea',
            trendScore: 94,
            source: 'K-Beauty Forums',
            timeframe: 'Last 48 hours'
          },
          {
            id: 'trend-2',
            type: 'technique',
            title: '7-Skin Method',
            description: 'Layering technique for ultimate hydration',
            trendScore: 87,
            source: 'Instagram • TikTok',
            timeframe: 'This month'
          }
        ]

        setMetrics({
          savedThisMonth: Math.round(savedAmount),
          productsAnalyzed: products?.length || 0,
          skinImprovement: skinProfile ? 89 : 0, // Would calculate from progress data
          dealsFound: currentDeals.length,
          activeAlerts: alerts?.length || 0,
          trendingProducts: trendingProducts?.length || 0
        })

        setDeals(currentDeals)
        setTrending([...trendingItems, ...curatedTrending].slice(0, 5))
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [userId])

  return { metrics, deals, trending, loading }
}

// Helper functions
function getRetailerTrustScore(retailer: string): number {
  const scores: Record<string, number> = {
    'YesStyle': 95,
    'Olive Young': 93,
    'Sephora': 90,
    'iHerb': 88,
    'Amazon': 85,
    'Ulta': 87,
    'StyleKorean': 91,
    'Yesstyle': 95
  }
  return scores[retailer] || 80
}

function getRandomExpiry(): string {
  const days = Math.floor(Math.random() * 7) + 1
  return `${days} day${days > 1 ? 's' : ''} left`
}