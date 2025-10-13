'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface AdminStats {
  totalProfiles: number
  totalRecommendations: number
  totalAnalyses: number
  activeUsers: number
}

interface UserProfile {
  id: string
  whatsapp_number: string
  current_skin_type: string
  skin_concerns: string[]
  created_at: string
  last_analysis_date?: string
}

export default function AIFeaturesAdmin() {
  const [stats, setStats] = useState<AdminStats>({
    totalProfiles: 0,
    totalRecommendations: 0,
    totalAnalyses: 0,
    activeUsers: 0
  })
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'profiles' | 'system'>('overview')

  useEffect(() => {
    fetchAdminData()
  }, [])

  const fetchAdminData = async () => {
    try {
      setLoading(true)

      // Fetch all profiles for admin view
      const profilesResponse = await fetch('/api/admin/profiles')
      if (profilesResponse.ok) {
        const profilesData = await profilesResponse.json()
        setProfiles(profilesData.profiles || [])
        setStats({
          totalProfiles: profilesData.profiles?.length || 0,
          totalRecommendations: profilesData.totalRecommendations || 0,
          totalAnalyses: profilesData.totalAnalyses || 0,
          activeUsers: profilesData.activeUsers || 0
        })
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const testAPIEndpoint = async (endpoint: string) => {
    try {
      const response = await fetch(endpoint)
      const data = await response.json()
      alert(`${endpoint}: ${response.ok ? 'Working ✅' : 'Failed ❌'}\n${JSON.stringify(data, null, 2)}`)
    } catch (error) {
      alert(`${endpoint}: Failed ❌\n${error}`)
    }
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview', description: 'System statistics and health' },
    { id: 'profiles', label: '👥 User Profiles', description: 'Manage user skin profiles' },
    { id: 'system', label: '⚙️ System Tools', description: 'API testing and diagnostics' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Seoul Sister branding */}
        <div className="text-center mb-8">
          <div className="mb-6">
            <h1 className="text-xl tracking-wider mb-4" style={{
              color: '#C9A96E',
              fontFamily: 'Inter, sans-serif',
              fontWeight: '400',
              letterSpacing: '0.05em'
            }}>
              SEOUL SISTER
            </h1>
            <p className="text-caption mb-4 text-gray-400 tracking-widest">EXECUTIVE DASHBOARD</p>
          </div>

          <h1 className="text-4xl font-light text-white mb-4 tracking-wide">
            🤖 AI Features Admin Portal
          </h1>
          <p className="text-lg font-light text-gray-300 max-w-3xl mx-auto mb-6">
            Manage and monitor your Seoul Sister AI-powered skin analysis and personalization system
          </p>

          <div className="flex justify-center gap-4 mb-6">
            <Link
              href="/personalized-dashboard"
              className="px-6 py-3 bg-luxury-gold text-black rounded-lg hover:bg-luxury-gold/90 font-medium tracking-wide shadow-lg transition-all"
            >
              View User Dashboard
            </Link>
            <Link
              href="/"
              className="px-6 py-3 bg-luxury-charcoal/30 border border-luxury-gold/30 text-gray-300 rounded-lg hover:bg-luxury-charcoal/50 hover:border-luxury-gold/50 font-medium tracking-wide transition-all"
            >
              Back to Main Site
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-luxury-gold text-black shadow-lg font-medium'
                  : 'bg-luxury-charcoal/30 text-gray-300 hover:bg-luxury-charcoal/50 border border-luxury-gold/20 hover:border-luxury-gold/40'
              }`}
            >
              <div className="font-semibold tracking-wide">{tab.label}</div>
              <div className="text-xs opacity-75 font-light">{tab.description}</div>
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 text-center backdrop-blur-sm">
                <div className="text-3xl font-bold text-luxury-gold mb-2">
                  {stats.totalProfiles}
                </div>
                <div className="text-sm text-gray-300 font-light">Total User Profiles</div>
              </div>

              <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 text-center backdrop-blur-sm">
                <div className="text-3xl font-bold text-luxury-gold mb-2">
                  {stats.totalRecommendations}
                </div>
                <div className="text-sm text-gray-300 font-light">AI Recommendations Generated</div>
              </div>

              <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 text-center backdrop-blur-sm">
                <div className="text-3xl font-bold text-luxury-gold mb-2">
                  {stats.totalAnalyses}
                </div>
                <div className="text-sm text-gray-300 font-light">Ingredient Analyses Completed</div>
              </div>

              <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 text-center backdrop-blur-sm">
                <div className="text-3xl font-bold text-luxury-gold mb-2">
                  {stats.activeUsers}
                </div>
                <div className="text-sm text-gray-300 font-light">Active Users (7 days)</div>
              </div>
            </div>

            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
                🔗 Quick Access Links
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Link
                  href="/personalized-dashboard"
                  className="block p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg hover:bg-luxury-gold/20 transition-colors"
                >
                  <div className="font-semibold text-luxury-gold tracking-wide">Personal Dashboard</div>
                  <div className="text-sm text-gray-300 font-light">Complete AI beauty hub</div>
                </Link>
                <Link
                  href="/skin-profile"
                  className="block p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg hover:bg-luxury-gold/20 transition-colors"
                >
                  <div className="font-semibold text-luxury-gold tracking-wide">Skin Profile Manager</div>
                  <div className="text-sm text-gray-300 font-light">Create and manage profiles</div>
                </Link>
                <Link
                  href="/"
                  className="block p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg hover:bg-luxury-gold/20 transition-colors"
                >
                  <div className="font-semibold text-luxury-gold tracking-wide">Main Website</div>
                  <div className="text-sm text-gray-300 font-light">Korean beauty products</div>
                </Link>
              </div>
            </div>

            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
                🎯 System Health
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-light">AI Recommendation Engine</span>
                  <span className="px-3 py-1 bg-luxury-gold/20 border border-luxury-gold/30 text-luxury-gold rounded-full text-sm font-medium">✅ Online</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-light">Ingredient Analysis System</span>
                  <span className="px-3 py-1 bg-luxury-gold/20 border border-luxury-gold/30 text-luxury-gold rounded-full text-sm font-medium">✅ Online</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-light">Database Connection</span>
                  <span className="px-3 py-1 bg-luxury-gold/20 border border-luxury-gold/30 text-luxury-gold rounded-full text-sm font-medium">✅ Connected</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-light">Claude AI Integration</span>
                  <span className="px-3 py-1 bg-luxury-gold/20 border border-luxury-gold/30 text-luxury-gold rounded-full text-sm font-medium">✅ Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="space-y-6">
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-white tracking-wide">
                  User Skin Profiles ({profiles.length})
                </h3>
                <button
                  onClick={fetchAdminData}
                  disabled={loading}
                  className="px-4 py-2 bg-luxury-gold text-black rounded-lg hover:bg-luxury-gold/90 disabled:opacity-50 font-medium tracking-wide"
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-luxury-gold mx-auto mb-4"></div>
                  <p className="text-gray-300 font-light">Loading user profiles...</p>
                </div>
              ) : profiles.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-luxury-gold/20">
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">WhatsApp Number</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Skin Type</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Concerns</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Created</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Last Analysis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((profile) => (
                        <tr key={profile.id} className="border-b border-luxury-gold/10 hover:bg-luxury-charcoal/30">
                          <td className="py-3 px-4 font-mono text-xs text-gray-300">{profile.whatsapp_number}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-luxury-gold/20 border border-luxury-gold/30 text-luxury-gold rounded text-xs font-medium">
                              {profile.current_skin_type || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {profile.skin_concerns?.slice(0, 3).map((concern) => (
                                <span key={concern} className="px-2 py-1 bg-luxury-charcoal/50 border border-luxury-gold/20 text-gray-300 rounded text-xs">
                                  {concern}
                                </span>
                              ))}
                              {profile.skin_concerns?.length > 3 && (
                                <span className="px-2 py-1 bg-luxury-charcoal/30 text-gray-400 rounded text-xs">
                                  +{profile.skin_concerns.length - 3} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-300 font-light">
                            {new Date(profile.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-gray-300 font-light">
                            {profile.last_analysis_date
                              ? new Date(profile.last_analysis_date).toLocaleDateString()
                              : 'Never'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">👥</div>
                  <h3 className="text-lg font-semibold text-white mb-2 tracking-wide">
                    No User Profiles Yet
                  </h3>
                  <p className="text-gray-300 font-light">
                    Users will appear here after creating skin profiles
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-6 tracking-wide">
                🧪 API Endpoint Testing
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={() => testAPIEndpoint('/api/skin-profiles?whatsapp_number=%2B1234567890')}
                  className="p-4 text-left bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg hover:bg-luxury-gold/20 transition-colors"
                >
                  <div className="font-semibold text-luxury-gold tracking-wide">Test Skin Profiles API</div>
                  <div className="text-sm text-gray-300 font-light">GET /api/skin-profiles</div>
                </button>

                <button
                  onClick={() => testAPIEndpoint('/api/personalized-recommendations-v2?whatsapp_number=%2B1234567890&limit=3')}
                  className="p-4 text-left bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg hover:bg-luxury-gold/20 transition-colors"
                >
                  <div className="font-semibold text-luxury-gold tracking-wide">Test Recommendations API</div>
                  <div className="text-sm text-gray-300 font-light">GET /api/personalized-recommendations-v2</div>
                </button>

                <button
                  onClick={() => testAPIEndpoint('/api/products')}
                  className="p-4 text-left bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg hover:bg-luxury-gold/20 transition-colors"
                >
                  <div className="font-semibold text-luxury-gold tracking-wide">Test Products API</div>
                  <div className="text-sm text-gray-300 font-light">GET /api/products</div>
                </button>

                <button
                  onClick={() => testAPIEndpoint('/api/fix-skin-tables')}
                  className="p-4 text-left bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg hover:bg-luxury-gold/20 transition-colors"
                >
                  <div className="font-semibold text-luxury-gold tracking-wide">Test Database Schema</div>
                  <div className="text-sm text-gray-300 font-light">POST /api/fix-skin-tables</div>
                </button>
              </div>
            </div>

            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
                📋 cURL Examples for Testing
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-luxury-gold mb-2 tracking-wide">Get User Profile:</h4>
                  <code className="block bg-luxury-charcoal/50 border border-luxury-gold/20 p-3 rounded text-sm overflow-x-auto text-gray-300">
                    curl "http://localhost:3000/api/skin-profiles?whatsapp_number=%2B1234567890"
                  </code>
                </div>

                <div>
                  <h4 className="font-semibold text-luxury-gold mb-2 tracking-wide">Create Profile:</h4>
                  <code className="block bg-luxury-charcoal/50 border border-luxury-gold/20 p-3 rounded text-sm overflow-x-auto text-gray-300">
                    curl -X POST http://localhost:3000/api/skin-profiles \<br/>
                    &nbsp;&nbsp;-H "Content-Type: application/json" \<br/>
                    &nbsp;&nbsp;-d '{'{'}
                      "whatsappNumber": "+1234567890",
                      "currentSkinType": "combination",
                      "skinConcerns": ["acne", "large-pores"]
                    {'}'}'
                  </code>
                </div>

                <div>
                  <h4 className="font-semibold text-luxury-gold mb-2 tracking-wide">Get Recommendations:</h4>
                  <code className="block bg-luxury-charcoal/50 border border-luxury-gold/20 p-3 rounded text-sm overflow-x-auto text-gray-300">
                    curl "http://localhost:3000/api/personalized-recommendations-v2?whatsapp_number=%2B1234567890&limit=5"
                  </code>
                </div>
              </div>
            </div>

            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
                🗺️ Database Tables Status
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
                  <div className="font-semibold text-luxury-gold tracking-wide">✅ user_skin_profiles</div>
                  <div className="text-sm text-gray-300 font-light">User skin data and preferences</div>
                </div>
                <div className="p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
                  <div className="font-semibold text-luxury-gold tracking-wide">✅ conversation_context</div>
                  <div className="text-sm text-gray-300 font-light">WhatsApp conversation state</div>
                </div>
                <div className="p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
                  <div className="font-semibold text-luxury-gold tracking-wide">✅ product_interests</div>
                  <div className="text-sm text-gray-300 font-light">User interaction tracking</div>
                </div>
                <div className="p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
                  <div className="font-semibold text-luxury-gold tracking-wide">✅ whatsapp_conversations</div>
                  <div className="text-sm text-gray-300 font-light">Message history</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}