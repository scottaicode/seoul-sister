'use client'

import { useState, useEffect } from 'react'
import { BaileyUserProfile } from '@/types/bailey-profile'
import { MapPin, Calendar, Globe, User } from 'lucide-react'

interface UserProfileSettingsProps {
  profile: Partial<BaileyUserProfile> | null
  onUpdate: (data: Partial<BaileyUserProfile>) => void
  userEmail?: string
}

export default function UserProfileSettings({ profile, onUpdate, userEmail }: UserProfileSettingsProps) {
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    age: profile?.age || '',
    ethnicity: profile?.ethnicity || '',
    location: {
      city: profile?.location?.city || '',
      state: profile?.location?.state || '',
      country: profile?.location?.country || 'United States',
      climate: profile?.location?.climate || '',
      humidity: profile?.location?.humidity || ''
    }
  })

  const [hasChanges, setHasChanges] = useState(false)

  // Update form when profile changes
  useEffect(() => {
    setFormData({
      name: profile?.name || '',
      age: profile?.age || '',
      ethnicity: profile?.ethnicity || '',
      location: {
        city: profile?.location?.city || '',
        state: profile?.location?.state || '',
        country: profile?.location?.country || 'United States',
        climate: profile?.location?.climate || '',
        humidity: profile?.location?.humidity || ''
      }
    })
    setHasChanges(false)
  }, [profile])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev }
      if (field.includes('.')) {
        const [parent, child] = field.split('.')
        updated[parent as keyof typeof updated] = {
          ...(updated[parent as keyof typeof updated] as object),
          [child]: value
        }
      } else {
        updated[field as keyof typeof updated] = value
      }
      return updated
    })
    setHasChanges(true)

    // Auto-update parent component
    const updatedProfile = {
      ...formData,
      [field.includes('.') ? field.split('.')[0] : field]:
        field.includes('.')
          ? { ...formData.location, [field.split('.')[1]]: value }
          : value
    }
    onUpdate(updatedProfile)
  }

  const ageRanges = [
    '13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'
  ]

  const ethnicities = [
    'East Asian', 'Southeast Asian', 'South Asian', 'Black/African',
    'Hispanic/Latino', 'Middle Eastern', 'Native American', 'White/Caucasian',
    'Pacific Islander', 'Mixed/Multiracial', 'Other', 'Prefer not to say'
  ]

  const climates = [
    'tropical', 'subtropical', 'temperate', 'continental', 'dry', 'polar'
  ]

  const humidityLevels = [
    'very-low', 'low', 'moderate', 'high', 'very-high'
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-light text-white mb-2">Personal Information</h2>
        <p className="text-gray-400">
          Basic information that helps Bailey understand your unique skin needs and environment
        </p>
      </div>

      {/* Account Info */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <User className="w-5 h-5 mr-2" />
          Account Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={userEmail || ''}
              disabled
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 text-gray-400 rounded-lg cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Demographics */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          Demographics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Age Range
            </label>
            <select
              value={formData.age}
              onChange={(e) => handleInputChange('age', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select age range</option>
              {ageRanges.map(range => (
                <option key={range} value={range}>{range}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Different ages require different skincare approaches
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ethnicity (Optional)
            </label>
            <select
              value={formData.ethnicity}
              onChange={(e) => handleInputChange('ethnicity', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select ethnicity (optional)</option>
              {ethnicities.map(ethnicity => (
                <option key={ethnicity} value={ethnicity}>{ethnicity}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Helps us understand your skin's unique characteristics
            </p>
          </div>
        </div>
      </div>

      {/* Location & Environment */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          Location & Environment
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              City
            </label>
            <input
              type="text"
              value={formData.location.city}
              onChange={(e) => handleInputChange('location.city', e.target.value)}
              placeholder="e.g. Los Angeles"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              State/Province
            </label>
            <input
              type="text"
              value={formData.location.state}
              onChange={(e) => handleInputChange('location.state', e.target.value)}
              placeholder="e.g. California"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Climate Type
            </label>
            <select
              value={formData.location.climate}
              onChange={(e) => handleInputChange('location.climate', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select climate</option>
              {climates.map(climate => (
                <option key={climate} value={climate}>
                  {climate.charAt(0).toUpperCase() + climate.slice(1)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Climate affects your skin's hydration needs
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Average Humidity
            </label>
            <select
              value={formData.location.humidity}
              onChange={(e) => handleInputChange('location.humidity', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select humidity level</option>
              {humidityLevels.map(level => (
                <option key={level} value={level}>
                  {level.split('-').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Humidity impacts product absorption and skin barrier
            </p>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {profile && (formData.age || formData.location.climate) && (
        <div className="bg-[#d4a574]/5 border border-[#d4a574]/20 rounded-lg p-6">
          <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            Bailey's Insights
          </h3>
          <div className="space-y-3 text-sm">
            {formData.age && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-[#d4a574] rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-[#d4a574] font-medium">Age-specific care:</span>
                  {formData.age === '18-24' && ' Focus on prevention and gentle introduction of active ingredients'}
                  {formData.age === '25-34' && ' Perfect time to introduce anti-aging ingredients like retinol'}
                  {formData.age === '35-44' && ' Emphasize hydration and target specific concerns'}
                  {(formData.age === '45-54' || formData.age === '55-64' || formData.age === '65+') && ' Focus on intensive repair and barrier strengthening'}
                </p>
              </div>
            )}
            {formData.location.climate && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-[#d4a574] rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-[#d4a574] font-medium">Climate adaptation:</span>
                  {formData.location.climate === 'dry' && ' Your dry climate requires extra hydrating ingredients and barrier support'}
                  {formData.location.climate === 'tropical' && ' Humid climate calls for lighter formulations and oil control'}
                  {formData.location.climate === 'temperate' && ' Seasonal adjustments needed for changing humidity levels'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}