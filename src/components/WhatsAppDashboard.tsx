'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Phone, MessageCircle, Image, MapPin, TrendingUp, Package } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface WhatsAppStats {
  totalUsers: number
  totalMessages: number
  productPhotos: number
  avgSavings: number
  topProducts: Array<{
    name: string
    count: number
    savings: number
  }>
  recentConversations: Array<{
    phone: string
    lastMessage: string
    type: string
    time: string
  }>
}

export default function WhatsAppDashboard() {
  const [stats, setStats] = useState<WhatsAppStats>({
    totalUsers: 0,
    totalMessages: 0,
    productPhotos: 0,
    avgSavings: 0,
    topProducts: [],
    recentConversations: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWhatsAppStats()

    // Set up real-time subscription
    const subscription = supabase
      .channel('whatsapp-updates')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversations' },
        () => loadWhatsAppStats()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function loadWhatsAppStats() {
    try {
      // Get user count
      const { count: userCount } = await supabase
        .from('whatsapp_users')
        .select('*', { count: 'exact', head: true })

      // Get message stats
      const { data: messages } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .order('created_at', { ascending: false })

      // Get product identifications
      const { data: products } = await supabase
        .from('product_identifications')
        .select('*')

      // Calculate stats
      const productPhotos = messages?.filter(m => m.message_type === 'image').length || 0
      const avgSavings = products?.reduce((acc, p) => acc + (p.savings_amount || 0), 0) / (products?.length || 1) || 0

      // Get top products
      const productCounts = products?.reduce((acc: any, p) => {
        const key = `${p.identified_brand} ${p.identified_product}`
        if (!acc[key]) {
          acc[key] = { name: key, count: 0, savings: p.savings_amount || 0 }
        }
        acc[key].count++
        return acc
      }, {})

      const topProducts = Object.values(productCounts || {})
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 5) as any[]

      // Get recent conversations
      const recentConversations = messages?.slice(0, 5).map(m => ({
        phone: m.phone_number.slice(-4),
        lastMessage: m.message_type === 'image' ? '📸 Product photo' :
                     m.message_type === 'location' ? '📍 Location' :
                     (m.message_content as any)?.text?.body?.slice(0, 50) || 'Message',
        type: m.message_type,
        time: new Date(m.created_at).toLocaleTimeString()
      })) || []

      setStats({
        totalUsers: userCount || 0,
        totalMessages: messages?.length || 0,
        productPhotos,
        avgSavings: Math.round(avgSavings),
        topProducts,
        recentConversations
      })

      setLoading(false)
    } catch (error) {
      console.error('Error loading WhatsApp stats:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-black/50 backdrop-blur-sm rounded-xl p-6 border border-yellow-500/20">
        <div className="animate-pulse">
          <div className="h-8 bg-yellow-500/20 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-yellow-500/10 rounded"></div>
            <div className="h-20 bg-yellow-500/10 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black/50 backdrop-blur-sm rounded-xl p-6 border border-yellow-500/20">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-yellow-500 mb-2 flex items-center gap-2">
          <Phone className="w-6 h-6" />
          WhatsApp AI Assistant
        </h2>
        <p className="text-gray-400">Real-time beauty consultation metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-black/30 rounded-lg p-4 border border-yellow-500/10">
          <div className="flex items-center justify-between mb-2">
            <Phone className="w-5 h-5 text-yellow-500" />
            <span className="text-xs text-green-400">+23%</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
          <div className="text-xs text-gray-400">Active Users</div>
        </div>

        <div className="bg-black/30 rounded-lg p-4 border border-yellow-500/10">
          <div className="flex items-center justify-between mb-2">
            <MessageCircle className="w-5 h-5 text-yellow-500" />
            <span className="text-xs text-green-400">+47%</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalMessages}</div>
          <div className="text-xs text-gray-400">Messages</div>
        </div>

        <div className="bg-black/30 rounded-lg p-4 border border-yellow-500/10">
          <div className="flex items-center justify-between mb-2">
            <Image className="w-5 h-5 text-yellow-500" />
            <span className="text-xs text-green-400">+89%</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.productPhotos}</div>
          <div className="text-xs text-gray-400">Product IDs</div>
        </div>

        <div className="bg-black/30 rounded-lg p-4 border border-yellow-500/10">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-yellow-500" />
            <span className="text-xs text-green-400">73%</span>
          </div>
          <div className="text-2xl font-bold text-white">${stats.avgSavings}</div>
          <div className="text-xs text-gray-400">Avg Savings</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <div className="bg-black/30 rounded-lg p-4 border border-yellow-500/10">
          <h3 className="text-sm font-semibold text-yellow-500 mb-3">Recent Conversations</h3>
          <div className="space-y-3">
            {stats.recentConversations.map((conv, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-xs font-bold text-yellow-500">
                    {conv.phone}
                  </div>
                  <div>
                    <div className="text-sm text-white truncate max-w-[200px]">
                      {conv.lastMessage}
                    </div>
                    <div className="text-xs text-gray-500">{conv.time}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {conv.type === 'image' ? '📸' :
                   conv.type === 'location' ? '📍' : '💬'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products Identified */}
        <div className="bg-black/30 rounded-lg p-4 border border-yellow-500/10">
          <h3 className="text-sm font-semibold text-yellow-500 mb-3">Top Products Identified</h3>
          <div className="space-y-3">
            {stats.topProducts.map((product, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-yellow-500/60" />
                  <div>
                    <div className="text-sm text-white">{product.name}</div>
                    <div className="text-xs text-green-400">Saves ${product.savings}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {product.count} requests
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 flex gap-3">
        <button className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 rounded-lg text-sm font-medium transition-colors">
          View Full Conversations
        </button>
        <button className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors">
          Export Analytics
        </button>
        <button className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors">
          Send Broadcast
        </button>
      </div>
    </div>
  )
}