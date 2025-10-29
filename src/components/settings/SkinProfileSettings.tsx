'use client'

import { useState, useEffect } from 'react'
import { BaileyUserProfile } from '@/types/bailey-profile'
import { Heart, Info, AlertTriangle } from 'lucide-react'

interface SkinProfileSettingsProps {
  profile: Partial<BaileyUserProfile> | null
  onUpdate: (data: Partial<BaileyUserProfile>) => void
}

export default function SkinProfileSettings({ profile, onUpdate }: SkinProfileSettingsProps) {
  const [formData, setFormData] = useState({
    skin: {
      type: profile?.skin?.type || '',
      tone: profile?.skin?.tone || '',
      sensitivities: profile?.skin?.sensitivities || [],
      concerns: profile?.skin?.concerns || [],
      currentCondition: profile?.skin?.currentCondition || ''
    }
  })

  useEffect(() => {
    setFormData({
      skin: {
        type: profile?.skin?.type || '',
        tone: profile?.skin?.tone || '',
        sensitivities: profile?.skin?.sensitivities || [],
        concerns: profile?.skin?.concerns || [],
        currentCondition: profile?.skin?.currentCondition || ''
      }
    })
  }, [profile])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev }
      const [parent, child] = field.split('.')
      updated[parent as keyof typeof updated] = {
        ...(updated[parent as keyof typeof updated] as object),
        [child]: value
      }
      return updated
    })
    onUpdate(formData)
  }

  const handleArrayChange = (field: string, value: string) => {
    const [parent, child] = field.split('.')
    const currentArray = formData[parent as keyof typeof formData][child as keyof typeof formData.skin] as string[]
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value]

    handleInputChange(field, newArray)
  }

  const skinTypes = [
    'oily', 'dry', 'combination', 'sensitive', 'normal', 'mature'
  ]

  const skinTones = [
    'light', 'medium-light', 'medium', 'medium-dark', 'dark', 'very-dark'
  ]

  const skinConcerns = [
    'acne', 'blackheads', 'whiteheads', 'large-pores', 'oily-tzone',
    'dry-patches', 'dehydration', 'dullness', 'uneven-tone',
    'dark-spots', 'hyperpigmentation', 'melasma',
    'fine-lines', 'wrinkles', 'loss-of-firmness', 'sagging',
    'redness', 'rosacea', 'sensitivity', 'irritation',
    'sun-damage', 'age-spots', 'texture-issues'
  ]

  const skinSensitivities = [
    'fragrance', 'alcohol', 'sulfates', 'parabens', 'retinoids',
    'aha-bha', 'vitamin-c', 'niacinamide', 'essential-oils'
  ]

  const skinConditions = [
    'excellent', 'good', 'fair', 'poor', 'breaking-out', 'stressed'
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-light text-white mb-2">Skin Analysis</h2>
        <p className="text-gray-400">
          Understanding your skin type and concerns helps Bailey recommend the perfect products
        </p>
      </div>

      {/* Basic Skin Info */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Heart className="w-5 h-5 mr-2" />
          Basic Skin Profile
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Skin Type
            </label>
            <select
              value={formData.skin.type}
              onChange={(e) => handleInputChange('skin.type', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select skin type</option>
              {skinTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Your overall skin type affects product selection
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Skin Tone
            </label>
            <select
              value={formData.skin.tone}
              onChange={(e) => handleInputChange('skin.tone', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select skin tone</option>
              {skinTones.map(tone => (
                <option key={tone} value={tone}>
                  {tone.split('-').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Helps with shade matching and ingredient selection
            </p>
          </div>
        </div>
      </div>

      {/* Skin Concerns */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Info className="w-5 h-5 mr-2" />
          Current Skin Concerns
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Select all concerns you'd like to address (multiple selections help Bailey create targeted recommendations)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {skinConcerns.map(concern => (
            <label key={concern} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.skin.concerns.includes(concern)}
                onChange={() => handleArrayChange('skin.concerns', concern)}
                className="rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">
                {concern.split('-').map(word =>
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Skin Sensitivities */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Known Sensitivities
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Ingredients that have caused irritation or reactions in the past
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {skinSensitivities.map(sensitivity => (
            <label key={sensitivity} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.skin.sensitivities.includes(sensitivity)}
                onChange={() => handleArrayChange('skin.sensitivities', sensitivity)}
                className="rounded border-gray-600 text-red-400 focus:ring-red-400 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">
                {sensitivity.split('-').map(word =>
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Current Condition */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4">Current Skin Condition</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {skinConditions.map(condition => (
            <label key={condition} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="skinCondition"
                value={condition}
                checked={formData.skin.currentCondition === condition}
                onChange={(e) => handleInputChange('skin.currentCondition', e.target.value)}
                className="text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">
                {condition.split('-').map(word =>
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          How would you describe your skin's current state today?
        </p>
      </div>

      {/* AI Insights */}
      {formData.skin.type && formData.skin.concerns.length > 0 && (
        <div className="bg-[#d4a574]/5 border border-[#d4a574]/20 rounded-lg p-6">
          <h3 className="text-lg font-medium text-[#d4a574] mb-4">Bailey's Skin Analysis</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-[#d4a574] rounded-full mt-2"></div>
              <p className="text-gray-300">
                <span className="text-[#d4a574] font-medium">Skin Type Insight:</span>
                {formData.skin.type === 'oily' && ' Focus on oil control and pore care with gentle, non-stripping formulations'}
                {formData.skin.type === 'dry' && ' Prioritize hydration and barrier repair with rich, nourishing ingredients'}
                {formData.skin.type === 'combination' && ' Use targeted treatments for different zones of your face'}
                {formData.skin.type === 'sensitive' && ' Choose gentle, fragrance-free formulations with soothing ingredients'}
                {formData.skin.type === 'normal' && ' Maintain balance with preventive care and antioxidant protection'}
                {formData.skin.type === 'mature' && ' Focus on collagen support and intensive hydration'}
              </p>
            </div>
            {formData.skin.concerns.length > 0 && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-[#d4a574] rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-[#d4a574] font-medium">Concern Priority:</span>
                  {formData.skin.concerns.includes('acne') && ' Acne treatment requires gentle yet effective ingredients like niacinamide and tea tree'}
                  {formData.skin.concerns.includes('hyperpigmentation') && ' Dark spots respond well to vitamin C, arbutin, and gentle acids'}
                  {formData.skin.concerns.includes('fine-lines') && ' Anti-aging benefits from retinol, peptides, and hydrating ingredients'}
                  {!formData.skin.concerns.includes('acne') && !formData.skin.concerns.includes('hyperpigmentation') && !formData.skin.concerns.includes('fine-lines') && ' Bailey will create a targeted routine for your specific concerns'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}