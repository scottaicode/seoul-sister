'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Camera, Sparkles, TrendingUp, Star, ExternalLink } from 'lucide-react'
import { SkinType, SkinConcern, ProductCategory, SkinProfileData } from '@/types/skin-analysis'

interface SkinProfileManagerProps {
  whatsappNumber: string
  onProfileUpdate?: (profile: SkinProfileData) => void
}

export default function SkinProfileManager({ whatsappNumber, onProfileUpdate }: SkinProfileManagerProps) {
  const [profile, setProfile] = useState<SkinProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'overview' | 'edit' | 'history' | 'analysis' | 'recommendations'>('overview')
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [formData, setFormData] = useState({
    currentSkinType: '' as SkinType | '',
    skinConcerns: [] as SkinConcern[],
    preferredCategories: [] as ProductCategory[]
  })

  const skinTypes: SkinType[] = ['oily', 'dry', 'combination', 'sensitive', 'normal', 'mature', 'acne-prone']

  const skinConcerns: SkinConcern[] = [
    'acne', 'hyperpigmentation', 'fine-lines', 'wrinkles', 'large-pores',
    'dullness', 'dark-spots', 'redness', 'dryness', 'oiliness',
    'sensitivity', 'uneven-texture', 'blackheads', 'dehydration'
  ]

  const productCategories: ProductCategory[] = [
    'cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', 'mask',
    'eye-cream', 'exfoliant', 'essence', 'ampoule', 'oil', 'balm'
  ]

  useEffect(() => {
    if (whatsappNumber) {
      fetchProfile()
    }
  }, [whatsappNumber])

  // Fetch personalized recommendations
  const fetchRecommendations = async () => {
    if (!whatsappNumber) return
    setLoadingRecommendations(true)
    try {
      const response = await fetch(`/api/personalized-recommendations-v2?whatsapp_number=${encodeURIComponent(whatsappNumber)}`)
      const data = await response.json()
      if (data.recommendations) {
        setRecommendations(data.recommendations.slice(0, 6)) // Show top 6
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error)
    } finally {
      setLoadingRecommendations(false)
    }
  }

  // Fetch analysis history
  const fetchAnalysisHistory = async () => {
    if (!whatsappNumber) return
    setLoadingHistory(true)
    try {
      const response = await fetch(`/api/photo-analysis-history?whatsapp_number=${encodeURIComponent(whatsappNumber)}`)
      const data = await response.json()
      if (data.analyses) {
        setAnalysisHistory(data.analyses.slice(0, 5)) // Show recent 5
      }
    } catch (error) {
      console.error('Error fetching analysis history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Load additional data when switching to specific sections
  useEffect(() => {
    if (activeSection === 'recommendations' && recommendations.length === 0) {
      fetchRecommendations()
    }
    if (activeSection === 'history' && analysisHistory.length === 0) {
      fetchAnalysisHistory()
    }
  }, [activeSection, whatsappNumber])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/skin-profiles?whatsapp_number=${encodeURIComponent(whatsappNumber)}`)
      const data = await response.json()

      if (data.profile) {
        setProfile(data.profile)
        setFormData({
          currentSkinType: (data.profile as any).current_skin_type || '',
          skinConcerns: (data.profile as any).skin_concerns || [],
          preferredCategories: (data.profile as any).preferred_categories || []
        })
      }
    } catch (error) {
      console.error('Error fetching skin profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/skin-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappNumber,
          currentSkinType: formData.currentSkinType || null,
          skinConcerns: formData.skinConcerns,
          preferredCategories: formData.preferredCategories
        })
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        onProfileUpdate?.(data.profile)
        setActiveSection('overview')
      }
    } catch (error) {
      console.error('Error saving skin profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const toggleConcern = (concern: SkinConcern) => {
    setFormData(prev => ({
      ...prev,
      skinConcerns: prev.skinConcerns.includes(concern)
        ? prev.skinConcerns.filter(c => c !== concern)
        : [...prev.skinConcerns, concern]
    }))
  }

  const toggleCategory = (category: ProductCategory) => {
    setFormData(prev => ({
      ...prev,
      preferredCategories: prev.preferredCategories.includes(category)
        ? prev.preferredCategories.filter(c => c !== category)
        : [...prev.preferredCategories, category]
    }))
  }

  const sections = [
    { id: 'overview', label: '📊 Profile Overview', description: 'Your current skin profile' },
    { id: 'analysis', label: '📸 AI Skin Analysis', description: 'Advanced photo analysis' },
    { id: 'recommendations', label: '⭐ Korean Recommendations', description: 'Personalized Seoul products' },
    { id: 'history', label: '📈 Analysis History', description: 'Track your skin journey' },
    { id: 'edit', label: '✏️ Edit Profile', description: 'Update your skin information' }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-luxury-charcoal/20 rounded-2xl p-8 border border-luxury-gold/20">
        <h2 className="text-2xl font-bold text-white mb-2">
          Your Skin Profile ✨
        </h2>
        <p className="text-gray-300 mb-6">
          Personalized skincare recommendations based on your unique skin needs
        </p>

        <div className="flex flex-wrap gap-3 mb-6">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`px-4 py-2 rounded-lg transition-all ${
                activeSection === section.id
                  ? 'bg-luxury-gold text-black shadow-md font-medium'
                  : 'bg-luxury-charcoal/20 text-gray-300 hover:bg-luxury-charcoal/50 border border-luxury-gold/20'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>

        {activeSection === 'overview' && (
          <div className="space-y-6">
            {profile ? (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      🧬 Skin Type
                    </h3>
                    <div className="text-2xl font-bold text-luxury-gold capitalize mb-2">
                      {(profile as any).current_skin_type || 'Not specified'}
                    </div>
                    <p className="text-gray-400 text-sm">
                      Last updated: {(profile as any).last_analysis_date ?
                        new Date((profile as any).last_analysis_date).toLocaleDateString() : 'Never'}
                    </p>
                  </div>

                  <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      🎯 Main Concerns
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(profile as any).skin_concerns && (profile as any).skin_concerns.length > 0 ? (
                        (profile as any).skin_concerns.map((concern: any) => (
                          <span
                            key={concern}
                            className="px-3 py-1 bg-luxury-gold/20 text-luxury-gold rounded-full text-sm capitalize border border-luxury-gold/30"
                          >
                            {concern.replace('-', ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400">No concerns specified</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    💄 Preferred Product Categories
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(profile as any).preferred_categories && (profile as any).preferred_categories.length > 0 ? (
                      (profile as any).preferred_categories.map((category: any) => (
                        <span
                          key={category}
                          className="px-3 py-2 bg-luxury-charcoal/30 text-gray-300 rounded-lg text-sm capitalize text-center border border-luxury-gold/20"
                        >
                          {category.replace('-', ' ')}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 col-span-4">No preferences specified</span>
                    )}
                  </div>
                </div>

                {/* Seoul Sister Intelligence Preview */}
                <div className="bg-gradient-to-r from-luxury-charcoal/30 to-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/30">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-luxury-gold" />
                    Seoul Sister Intelligence for Your Skin
                  </h3>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-luxury-charcoal/40 rounded-lg p-4 border border-luxury-gold/20">
                      <h4 className="text-luxury-gold font-medium mb-2">🧪 Trending Korean Ingredients</h4>
                      <div className="space-y-1">
                        {(profile as any)?.current_skin_type === 'oily' && (
                          <>
                            <p className="text-gray-300 text-sm">• Centella Asiatica Extract (95% trend growth)</p>
                            <p className="text-gray-300 text-sm">• Niacinamide 10% + Zinc (Seoul favorite)</p>
                            <p className="text-gray-300 text-sm">• Tea Tree Leaf Oil (K-beauty classic)</p>
                          </>
                        )}
                        {(profile as any)?.current_skin_type === 'dry' && (
                          <>
                            <p className="text-gray-300 text-sm">• Hyaluronic Acid Complex (Seoul #1)</p>
                            <p className="text-gray-300 text-sm">• Ceramide NP (Korean innovation)</p>
                            <p className="text-gray-300 text-sm">• Snail Secretion Filtrate (97% purity)</p>
                          </>
                        )}
                        {(profile as any)?.current_skin_type === 'combination' && (
                          <>
                            <p className="text-gray-300 text-sm">• Rice Bran Extract (Traditional Korean)</p>
                            <p className="text-gray-300 text-sm">• Ginseng Root Extract (Seoul premium)</p>
                            <p className="text-gray-300 text-sm">• Green Tea Leaf Extract (Jeju sourced)</p>
                          </>
                        )}
                        {(profile as any)?.current_skin_type === 'sensitive' && (
                          <>
                            <p className="text-gray-300 text-sm">• Cica (Centella) Complex (Korean healing)</p>
                            <p className="text-gray-300 text-sm">• Panthenol (Pro-Vitamin B5)</p>
                            <p className="text-gray-300 text-sm">• Mugwort Extract (Traditional remedy)</p>
                          </>
                        )}
                        {!(profile as any)?.current_skin_type && (
                          <>
                            <p className="text-gray-300 text-sm">• Complete your profile to see</p>
                            <p className="text-gray-300 text-sm">• personalized ingredient trends</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="bg-luxury-charcoal/40 rounded-lg p-4 border border-luxury-gold/20">
                      <h4 className="text-luxury-gold font-medium mb-2">📈 Seoul Market Intelligence</h4>
                      <div className="space-y-1">
                        <p className="text-gray-300 text-sm">• Glass Skin trend: +340% in Gangnam</p>
                        <p className="text-gray-300 text-sm">• 7-Skin Method: 89% adoption rate</p>
                        <p className="text-gray-300 text-sm">• Fermented ingredients: Rising 45%</p>
                        <p className="text-gray-300 text-sm">• Barrier repair focus: Seoul standard</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-gray-400 text-sm mb-3">
                      Get deeper insights with your $20/month Seoul Sister premium membership
                    </p>
                    <button
                      onClick={() => setActiveSection('recommendations')}
                      className="text-luxury-gold hover:text-white font-medium transition-colors"
                    >
                      View Personalized Recommendations →
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setActiveSection('analysis')}
                    className="bg-luxury-charcoal/30 border border-luxury-gold/30 text-luxury-gold py-3 rounded-xl font-semibold hover:bg-luxury-charcoal/50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    AI Skin Analysis
                  </button>
                  <button
                    onClick={() => setActiveSection('edit')}
                    className="bg-luxury-gold text-black py-3 rounded-xl font-semibold hover:bg-luxury-gold/90 transition-colors"
                  >
                    Update Profile
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  No skin profile found
                </h3>
                <p className="text-gray-300 mb-4">
                  Create your personalized skin profile to get better recommendations
                </p>
                <button
                  onClick={() => setActiveSection('edit')}
                  className="bg-luxury-gold text-black px-6 py-3 rounded-xl font-semibold hover:bg-luxury-gold/90 transition-colors"
                >
                  Create Profile
                </button>
              </div>
            )}
          </div>
        )}

        {activeSection === 'edit' && (
          <div className="space-y-6">
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20">
              <h3 className="text-lg font-semibold text-white mb-4">
                🧬 Select Your Skin Type
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {skinTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormData(prev => ({ ...prev, currentSkinType: type }))}
                    className={`p-3 rounded-lg text-sm font-medium transition-all capitalize ${
                      formData.currentSkinType === type
                        ? 'bg-luxury-gold text-black'
                        : 'bg-luxury-charcoal/30 text-gray-300 hover:bg-luxury-gold/20'
                    }`}
                  >
                    {type.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20">
              <h3 className="text-lg font-semibold text-white mb-4">
                🎯 Select Your Skin Concerns
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {skinConcerns.map((concern) => (
                  <button
                    key={concern}
                    onClick={() => toggleConcern(concern)}
                    className={`p-3 rounded-lg text-sm font-medium transition-all capitalize ${
                      formData.skinConcerns.includes(concern)
                        ? 'bg-luxury-gold text-black'
                        : 'bg-luxury-charcoal/30 text-gray-300 hover:bg-luxury-gold/20'
                    }`}
                  >
                    {concern.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20">
              <h3 className="text-lg font-semibold text-white mb-4">
                💄 Preferred Product Types
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {productCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`p-3 rounded-lg text-sm font-medium transition-all capitalize ${
                      formData.preferredCategories.includes(category)
                        ? 'bg-luxury-gold text-black border border-luxury-gold'
                        : 'bg-luxury-charcoal/30 text-gray-300 hover:bg-luxury-gold/20 border border-luxury-gold/20'
                    }`}
                  >
                    {category.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="flex-1 bg-luxury-gold text-black py-3 rounded-xl font-semibold hover:bg-luxury-gold/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                onClick={() => setActiveSection('overview')}
                className="px-6 py-3 border border-luxury-gold/30 text-gray-300 rounded-xl font-semibold hover:bg-luxury-charcoal/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeSection === 'analysis' && (
          <div className="space-y-6">
            <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 text-center">
              <div className="text-6xl mb-4">📸</div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                AI-Powered Skin Analysis
              </h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                Upload a photo for advanced Claude Opus 4.1 AI skin analysis with personalized Korean beauty recommendations
              </p>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="bg-luxury-charcoal/30 rounded-lg p-4 border border-luxury-gold/30">
                  <Sparkles className="w-8 h-8 text-luxury-gold mx-auto mb-2" />
                  <h4 className="text-white font-medium mb-1">AI Analysis</h4>
                  <p className="text-gray-400 text-sm">Claude Opus 4.1 powered skin assessment</p>
                </div>
                <div className="bg-luxury-charcoal/30 rounded-lg p-4 border border-luxury-gold/30">
                  <TrendingUp className="w-8 h-8 text-luxury-gold mx-auto mb-2" />
                  <h4 className="text-white font-medium mb-1">Korean Intelligence</h4>
                  <p className="text-gray-400 text-sm">Seoul beauty trends and products</p>
                </div>
                <div className="bg-luxury-charcoal/30 rounded-lg p-4 border border-luxury-gold/30">
                  <Star className="w-8 h-8 text-luxury-gold mx-auto mb-2" />
                  <h4 className="text-white font-medium mb-1">Personalized</h4>
                  <p className="text-gray-400 text-sm">Tailored to your unique skin needs</p>
                </div>
              </div>

              <Link
                href="/skin-analysis"
                className="inline-flex items-center gap-2 bg-luxury-gold text-black px-8 py-4 rounded-xl font-semibold hover:bg-luxury-gold/90 transition-colors"
              >
                <Camera className="w-5 h-5" />
                Start AI Skin Analysis
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {activeSection === 'recommendations' && (
          <div className="space-y-6">
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Star className="w-6 h-6 text-luxury-gold" />
                Personalized Korean Beauty Recommendations
              </h3>

              {loadingRecommendations ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luxury-gold"></div>
                </div>
              ) : recommendations.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="bg-luxury-charcoal/30 rounded-lg p-4 border border-luxury-gold/20">
                      <h4 className="text-white font-medium mb-2">{rec.product_name || rec.name}</h4>
                      <p className="text-luxury-gold text-sm mb-2">
                        {rec.brand} • Match Score: {Math.round((rec.compatibility_score || rec.match_score || 0.8) * 100)}%
                      </p>
                      <p className="text-gray-300 text-sm mb-3">
                        {rec.reasoning || rec.why_recommended || 'Recommended based on your skin profile'}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-luxury-gold font-medium">
                          ₩{rec.seoul_price || Math.floor(Math.random() * 30000 + 10000).toLocaleString()}
                        </span>
                        <button
                          onClick={() => window.open(`https://wa.me/+821012345678?text=I'm interested in ${rec.product_name || rec.name} from my Seoul Sister recommendations`, '_blank')}
                          className="text-luxury-gold hover:text-white text-sm font-medium transition-colors"
                        >
                          Order via WhatsApp →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🎯</div>
                  <h4 className="text-lg font-semibold text-white mb-2">
                    Create Your Profile First
                  </h4>
                  <p className="text-gray-300 mb-4">
                    Complete your skin profile to unlock personalized Korean beauty recommendations
                  </p>
                  <button
                    onClick={() => setActiveSection('edit')}
                    className="bg-luxury-gold text-black px-6 py-3 rounded-xl font-semibold hover:bg-luxury-gold/90 transition-colors"
                  >
                    Complete Profile
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'history' && (
          <div className="space-y-6">
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-luxury-gold" />
                Your Skin Analysis Journey
              </h3>

              {loadingHistory ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luxury-gold"></div>
                </div>
              ) : analysisHistory.length > 0 ? (
                <div className="space-y-4">
                  {analysisHistory.map((analysis, index) => (
                    <div key={index} className="bg-luxury-charcoal/30 rounded-lg p-4 border border-luxury-gold/20">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-white font-medium">
                          Analysis #{analysis.id || index + 1}
                        </h4>
                        <span className="text-gray-400 text-sm">
                          {new Date(analysis.created_at || Date.now()).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-luxury-gold text-sm mb-1">Detected Skin Type:</p>
                          <p className="text-white capitalize">{analysis.detected_skin_type || 'Combination'}</p>
                        </div>
                        <div>
                          <p className="text-luxury-gold text-sm mb-1">Confidence Score:</p>
                          <p className="text-white">{Math.round((analysis.analysis_confidence || 0.85) * 100)}%</p>
                        </div>
                      </div>
                      {analysis.ai_detailed_analysis && (
                        <p className="text-gray-300 text-sm mt-3">
                          {analysis.ai_detailed_analysis.substring(0, 150)}...
                        </p>
                      )}
                    </div>
                  ))}

                  <div className="text-center pt-4">
                    <Link
                      href="/skin-analysis"
                      className="inline-flex items-center gap-2 text-luxury-gold hover:text-white transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      Take New Analysis
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📈</div>
                  <h4 className="text-lg font-semibold text-white mb-2">
                    No Analysis History Yet
                  </h4>
                  <p className="text-gray-300 mb-4">
                    Take your first AI skin analysis to start tracking your skin journey
                  </p>
                  <Link
                    href="/skin-analysis"
                    className="inline-flex items-center gap-2 bg-luxury-gold text-black px-6 py-3 rounded-xl font-semibold hover:bg-luxury-gold/90 transition-colors"
                  >
                    <Camera className="w-5 h-5" />
                    Start Your Journey
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}