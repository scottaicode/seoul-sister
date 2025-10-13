'use client'

import { useState, useEffect } from 'react'
import { SkinType, SkinConcern, ProductCategory, SkinProfileData } from '@/types/skin-analysis'

interface SkinProfileManagerProps {
  whatsappNumber: string
  onProfileUpdate?: (profile: SkinProfileData) => void
}

export default function SkinProfileManager({ whatsappNumber, onProfileUpdate }: SkinProfileManagerProps) {
  const [profile, setProfile] = useState<SkinProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'overview' | 'edit' | 'history'>('overview')

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
    { id: 'edit', label: '✏️ Edit Profile', description: 'Update your skin information' },
    { id: 'history', label: '📈 Analysis History', description: 'Track your skin journey' }
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
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-8 border border-pink-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Your Skin Profile ✨
        </h2>
        <p className="text-gray-600 mb-6">
          Personalized skincare recommendations based on your unique skin needs
        </p>

        <div className="flex flex-wrap gap-3 mb-6">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`px-4 py-2 rounded-lg transition-all ${
                activeSection === section.id
                  ? 'bg-pink-500 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-pink-50 border border-gray-200'
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
                  <div className="bg-white rounded-xl p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      🧬 Skin Type
                    </h3>
                    <div className="text-2xl font-bold text-pink-600 capitalize mb-2">
                      {(profile as any).current_skin_type || 'Not specified'}
                    </div>
                    <p className="text-gray-500 text-sm">
                      Last updated: {(profile as any).last_analysis_date ?
                        new Date((profile as any).last_analysis_date).toLocaleDateString() : 'Never'}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      🎯 Main Concerns
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(profile as any).skin_concerns && (profile as any).skin_concerns.length > 0 ? (
                        (profile as any).skin_concerns.map((concern: any) => (
                          <span
                            key={concern}
                            className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm capitalize"
                          >
                            {concern.replace('-', ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500">No concerns specified</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    💄 Preferred Product Categories
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(profile as any).preferred_categories && (profile as any).preferred_categories.length > 0 ? (
                      (profile as any).preferred_categories.map((category: any) => (
                        <span
                          key={category}
                          className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm capitalize text-center"
                        >
                          {category.replace('-', ' ')}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 col-span-4">No preferences specified</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setActiveSection('edit')}
                  className="w-full bg-pink-500 text-white py-3 rounded-xl font-semibold hover:bg-pink-600 transition-colors"
                >
                  Update Profile
                </button>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  No skin profile found
                </h3>
                <p className="text-gray-600 mb-4">
                  Create your personalized skin profile to get better recommendations
                </p>
                <button
                  onClick={() => setActiveSection('edit')}
                  className="bg-pink-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-pink-600 transition-colors"
                >
                  Create Profile
                </button>
              </div>
            )}
          </div>
        )}

        {activeSection === 'edit' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                🧬 Select Your Skin Type
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {skinTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormData(prev => ({ ...prev, currentSkinType: type }))}
                    className={`p-3 rounded-lg text-sm font-medium transition-all capitalize ${
                      formData.currentSkinType === type
                        ? 'bg-pink-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-pink-100'
                    }`}
                  >
                    {type.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                🎯 Select Your Skin Concerns
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {skinConcerns.map((concern) => (
                  <button
                    key={concern}
                    onClick={() => toggleConcern(concern)}
                    className={`p-3 rounded-lg text-sm font-medium transition-all capitalize ${
                      formData.skinConcerns.includes(concern)
                        ? 'bg-pink-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-pink-100'
                    }`}
                  >
                    {concern.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                💄 Preferred Product Types
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {productCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`p-3 rounded-lg text-sm font-medium transition-all capitalize ${
                      formData.preferredCategories.includes(category)
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-purple-100'
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
                className="flex-1 bg-pink-500 text-white py-3 rounded-xl font-semibold hover:bg-pink-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                onClick={() => setActiveSection('overview')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeSection === 'history' && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📈</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Analysis History Coming Soon
              </h3>
              <p className="text-gray-600">
                Track your skin journey and see how your profile evolves over time
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}