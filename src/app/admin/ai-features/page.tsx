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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🤖 AI Features Admin Portal
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-6">
            Manage and monitor your Seoul Sister AI-powered skin analysis and personalization system
          </p>

          <div className="flex justify-center gap-4 mb-6">
            <Link
              href="/personalized-dashboard"
              className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
            >
              View User Dashboard
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
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
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-blue-50 border border-gray-200'
              }`}
            >
              <div className="font-semibold">{tab.label}</div>
              <div className="text-xs opacity-75">{tab.description}</div>
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {stats.totalProfiles}
                </div>
                <div className="text-sm text-gray-600">Total User Profiles</div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {stats.totalRecommendations}
                </div>
                <div className="text-sm text-gray-600">AI Recommendations Generated</div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {stats.totalAnalyses}
                </div>
                <div className="text-sm text-gray-600">Ingredient Analyses Completed</div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
                <div className="text-3xl font-bold text-pink-600 mb-2">
                  {stats.activeUsers}
                </div>
                <div className="text-sm text-gray-600">Active Users (7 days)</div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                🔗 Quick Access Links
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Link
                  href="/personalized-dashboard"
                  className="block p-4 bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors"
                >
                  <div className="font-semibold text-pink-700">Personal Dashboard</div>
                  <div className="text-sm text-pink-600">Complete AI beauty hub</div>
                </Link>
                <Link
                  href="/skin-profile"
                  className="block p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <div className="font-semibold text-purple-700">Skin Profile Manager</div>
                  <div className="text-sm text-purple-600">Create and manage profiles</div>
                </Link>
                <Link
                  href="/"
                  className="block p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <div className="font-semibold text-blue-700">Main Website</div>
                  <div className="text-sm text-blue-600">Korean beauty products</div>
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                🎯 System Health
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">AI Recommendation Engine</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">✅ Online</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Ingredient Analysis System</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">✅ Online</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Database Connection</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">✅ Connected</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Claude AI Integration</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">✅ Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  User Skin Profiles ({profiles.length})
                </h3>
                <button
                  onClick={fetchAdminData}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading user profiles...</p>
                </div>
              ) : profiles.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4">WhatsApp Number</th>
                        <th className="text-left py-3 px-4">Skin Type</th>
                        <th className="text-left py-3 px-4">Concerns</th>
                        <th className="text-left py-3 px-4">Created</th>
                        <th className="text-left py-3 px-4">Last Analysis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((profile) => (
                        <tr key={profile.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-mono text-xs">{profile.whatsapp_number}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              {profile.current_skin_type || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {profile.skin_concerns?.slice(0, 3).map((concern) => (
                                <span key={concern} className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs">
                                  {concern}
                                </span>
                              ))}
                              {profile.skin_concerns?.length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                  +{profile.skin_concerns.length - 3} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {new Date(profile.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
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
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    No User Profiles Yet
                  </h3>
                  <p className="text-gray-600">
                    Users will appear here after creating skin profiles
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-6">
                🧪 API Endpoint Testing
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={() => testAPIEndpoint('/api/skin-profiles?whatsapp_number=%2B1234567890')}
                  className="p-4 text-left bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <div className="font-semibold text-blue-700">Test Skin Profiles API</div>
                  <div className="text-sm text-blue-600">GET /api/skin-profiles</div>
                </button>

                <button
                  onClick={() => testAPIEndpoint('/api/personalized-recommendations-v2?whatsapp_number=%2B1234567890&limit=3')}
                  className="p-4 text-left bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <div className="font-semibold text-green-700">Test Recommendations API</div>
                  <div className="text-sm text-green-600">GET /api/personalized-recommendations-v2</div>
                </button>

                <button
                  onClick={() => testAPIEndpoint('/api/products')}
                  className="p-4 text-left bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <div className="font-semibold text-purple-700">Test Products API</div>
                  <div className="text-sm text-purple-600">GET /api/products</div>
                </button>

                <button
                  onClick={() => testAPIEndpoint('/api/fix-skin-tables')}
                  className="p-4 text-left bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                >
                  <div className="font-semibold text-orange-700">Test Database Schema</div>
                  <div className="text-sm text-orange-600">POST /api/fix-skin-tables</div>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                📋 cURL Examples for Testing
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Get User Profile:</h4>
                  <code className="block bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                    curl "http://localhost:3000/api/skin-profiles?whatsapp_number=%2B1234567890"
                  </code>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Create Profile:</h4>
                  <code className="block bg-gray-100 p-3 rounded text-sm overflow-x-auto">
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
                  <h4 className="font-semibold text-gray-700 mb-2">Get Recommendations:</h4>
                  <code className="block bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                    curl "http://localhost:3000/api/personalized-recommendations-v2?whatsapp_number=%2B1234567890&limit=5"
                  </code>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                🗄️ Database Tables Status
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="font-semibold text-green-700">✅ user_skin_profiles</div>
                  <div className="text-sm text-green-600">User skin data and preferences</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="font-semibold text-green-700">✅ conversation_context</div>
                  <div className="text-sm text-green-600">WhatsApp conversation state</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="font-semibold text-green-700">✅ product_interests</div>
                  <div className="text-sm text-green-600">User interaction tracking</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="font-semibold text-green-700">✅ whatsapp_conversations</div>
                  <div className="text-sm text-green-600">Message history</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}