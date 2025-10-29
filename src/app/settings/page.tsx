'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import AuthHeader from '@/components/AuthHeader'
import UserProfileSettings from '@/components/settings/UserProfileSettings'
import SkinProfileSettings from '@/components/settings/SkinProfileSettings'
import LifestyleSettings from '@/components/settings/LifestyleSettings'
import MedicalSettings from '@/components/settings/MedicalSettings'
import PreferencesSettings from '@/components/settings/PreferencesSettings'
import GoalsSettings from '@/components/settings/GoalsSettings'
import NotificationSettings from '@/components/settings/NotificationSettings'
import DataSettings from '@/components/settings/DataSettings'
import { BaileyUserProfile } from '@/types/bailey-profile'
import {
  User,
  Heart,
  Activity,
  Stethoscope,
  Sliders,
  Target,
  Bell,
  Database,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface SettingsSection {
  id: string
  name: string
  icon: React.ElementType
  description: string
  component: React.ComponentType<any>
}

const settingsSections: SettingsSection[] = [
  {
    id: 'profile',
    name: 'Personal Information',
    icon: User,
    description: 'Basic information and location details',
    component: UserProfileSettings
  },
  {
    id: 'skin',
    name: 'Skin Profile',
    icon: Heart,
    description: 'Skin type, concerns, and current condition',
    component: SkinProfileSettings
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle Factors',
    icon: Activity,
    description: 'Exercise, diet, sleep, and daily habits',
    component: LifestyleSettings
  },
  {
    id: 'medical',
    name: 'Medical Information',
    icon: Stethoscope,
    description: 'Medications, allergies, and health conditions',
    component: MedicalSettings
  },
  {
    id: 'preferences',
    name: 'Product Preferences',
    icon: Sliders,
    description: 'Budget, ingredients, and texture preferences',
    component: PreferencesSettings
  },
  {
    id: 'goals',
    name: 'Skincare Goals',
    icon: Target,
    description: 'Objectives, timeline, and commitment level',
    component: GoalsSettings
  },
  {
    id: 'notifications',
    name: 'Notifications',
    icon: Bell,
    description: 'Email alerts and recommendation frequency',
    component: NotificationSettings
  },
  {
    id: 'data',
    name: 'Data & Privacy',
    icon: Database,
    description: 'Export data, delete account, privacy settings',
    component: DataSettings
  }
]

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState('profile')
  const [profile, setProfile] = useState<Partial<BaileyUserProfile> | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load existing profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.email) return

      try {
        setLoading(true)
        const response = await fetch(`/api/bailey-profile?email=${encodeURIComponent(user.email)}`)

        if (response.ok) {
          const data = await response.json()
          setProfile(data.profile || {})
        } else if (response.status === 404) {
          // No profile exists yet, start with empty profile
          setProfile({})
        } else {
          throw new Error('Failed to load profile')
        }
      } catch (err) {
        console.error('Error loading profile:', err)
        setError('Failed to load your profile. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user?.email])

  // Handle profile updates
  const handleProfileUpdate = (sectionData: Partial<BaileyUserProfile>) => {
    setProfile(prev => ({
      ...prev,
      ...sectionData
    }))
    setHasChanges(true)
  }

  // Save profile changes
  const handleSave = async () => {
    if (!profile || !user?.email) return

    try {
      setSaving(true)
      setError(null)

      const response = await fetch('/api/bailey-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          email: user.email,
          updatedAt: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save profile')
      }

      setHasChanges(false)
      setLastSaved(new Date())

      // Show success notification
      setTimeout(() => setLastSaved(null), 3000)
    } catch (err) {
      console.error('Error saving profile:', err)
      setError('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Auto-save every 30 seconds if there are changes
  useEffect(() => {
    if (!hasChanges) return

    const autoSaveInterval = setInterval(() => {
      if (hasChanges && !saving) {
        handleSave()
      }
    }, 30000)

    return () => clearInterval(autoSaveInterval)
  }, [hasChanges, saving])

  const ActiveComponent = settingsSections.find(s => s.id === activeSection)?.component

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#d4a574] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <AuthHeader />

      <div className="pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-light mb-2">Account Settings</h1>
            <p className="text-gray-400">
              Manage your profile and preferences to get the most personalized skincare recommendations
            </p>
          </div>

          {/* Save Status Bar */}
          {(hasChanges || saving || lastSaved || error) && (
            <div className="mb-6 p-4 rounded-lg border border-[#d4a574]/20 bg-black/40 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {saving && (
                    <>
                      <RefreshCw className="w-5 h-5 text-[#d4a574] animate-spin" />
                      <span className="text-[#d4a574]">Saving changes...</span>
                    </>
                  )}
                  {lastSaved && (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-green-400">
                        Changes saved at {lastSaved.toLocaleTimeString()}
                      </span>
                    </>
                  )}
                  {error && (
                    <>
                      <AlertCircle className="w-5 h-5 text-red-400" />
                      <span className="text-red-400">{error}</span>
                    </>
                  )}
                  {hasChanges && !saving && !lastSaved && (
                    <>
                      <div className="w-2 h-2 bg-[#d4a574] rounded-full"></div>
                      <span className="text-gray-300">Unsaved changes</span>
                    </>
                  )}
                </div>

                {hasChanges && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center space-x-2 px-4 py-2 bg-[#d4a574] text-black rounded-lg hover:bg-[#d4a574]/90 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Settings Navigation */}
            <div className="lg:col-span-1">
              <nav className="space-y-2">
                {settingsSections.map((section) => {
                  const Icon = section.icon
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full text-left p-4 rounded-lg transition-all ${
                        activeSection === section.id
                          ? 'bg-[#d4a574]/10 border border-[#d4a574]/30 text-[#d4a574]'
                          : 'bg-gray-900/50 border border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-[#d4a574]/20'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">{section.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {section.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Settings Content */}
            <div className="lg:col-span-3">
              <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-8 backdrop-blur-sm">
                {ActiveComponent && (
                  <ActiveComponent
                    profile={profile}
                    onUpdate={handleProfileUpdate}
                    userEmail={user?.email}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}