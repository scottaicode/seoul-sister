'use client'

import { useState, useEffect } from 'react'
import { BaileyUserProfile } from '@/types/bailey-profile'
import { Sliders, DollarSign, Leaf, Sparkles } from 'lucide-react'

interface PreferencesSettingsProps {
  profile: Partial<BaileyUserProfile> | null
  onUpdate: (data: Partial<BaileyUserProfile>) => void
}

export default function PreferencesSettings({ profile, onUpdate }: PreferencesSettingsProps) {
  const [formData, setFormData] = useState({
    preferences: {
      budgetRange: profile?.preferences?.budgetRange || 'mid-range' as 'budget' | 'mid-range' | 'luxury' | 'ultra-luxury' | 'no-limit',
      preferClean: profile?.preferences?.preferClean || false,
      preferKBeauty: profile?.preferences?.preferKBeauty || false,
      preferFragranceFree: profile?.preferences?.preferFragranceFree || false,
      preferCrueltyFree: profile?.preferences?.preferCrueltyFree || false,
      texturePreferences: profile?.preferences?.texturePreferences || [],
      avoidIngredients: profile?.preferences?.avoidIngredients || []
    }
  })

  const [customIngredient, setCustomIngredient] = useState('')

  useEffect(() => {
    setFormData({
      preferences: {
        budgetRange: profile?.preferences?.budgetRange || 'mid-range' as 'budget' | 'mid-range' | 'luxury' | 'ultra-luxury' | 'no-limit',
        preferClean: profile?.preferences?.preferClean || false,
        preferKBeauty: profile?.preferences?.preferKBeauty || false,
        preferFragranceFree: profile?.preferences?.preferFragranceFree || false,
        preferCrueltyFree: profile?.preferences?.preferCrueltyFree || false,
        texturePreferences: profile?.preferences?.texturePreferences || [],
        avoidIngredients: profile?.preferences?.avoidIngredients || []
      }
    })
  }, [profile])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev }
      const [parent, child] = field.split('.')

      if (parent === 'preferences') {
        updated.preferences = {
          ...updated.preferences,
          [child]: value
        }
      }
      return updated
    })
    onUpdate(formData)
  }

  const handleArrayChange = (field: string, value: string) => {
    const [parent, child] = field.split('.')
    const currentArray = formData[parent as keyof typeof formData][child as keyof typeof formData.preferences] as string[]
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value]

    handleInputChange(field, newArray)
  }

  const addCustomIngredient = () => {
    if (!customIngredient.trim()) return
    const currentIngredients = formData.preferences.avoidIngredients
    if (!currentIngredients.includes(customIngredient.trim())) {
      handleInputChange('preferences.avoidIngredients', [...currentIngredients, customIngredient.trim()])
    }
    setCustomIngredient('')
  }

  const removeIngredient = (ingredient: string) => {
    const newIngredients = formData.preferences.avoidIngredients.filter(ing => ing !== ingredient)
    handleInputChange('preferences.avoidIngredients', newIngredients)
  }

  const budgetRanges = [
    'budget', 'mid-range', 'luxury', 'ultra-luxury'
  ]

  const textureOptions = [
    'gel', 'cream', 'lotion', 'serum', 'oil', 'balm', 'foam', 'water-based', 'essence'
  ]

  const commonAvoidIngredients = [
    'Fragrance', 'Essential Oils', 'Alcohol (Denat)', 'Sulfates', 'Parabens',
    'Formaldehyde', 'Retinol', 'AHA/BHA', 'Vitamin C', 'Niacinamide'
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-light text-white mb-2">Product Preferences</h2>
        <p className="text-gray-400">
          Your preferences help Bailey curate the perfect product selection for your lifestyle and values
        </p>
      </div>

      {/* Budget Range */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2" />
          Budget Range
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {budgetRanges.map(range => (
            <label key={range} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="budgetRange"
                value={range}
                checked={formData.preferences.budgetRange === range}
                onChange={(e) => handleInputChange('preferences.budgetRange', e.target.value)}
                className="text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
              />
              <div>
                <div className="text-gray-300 font-medium">
                  {range.split('-').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </div>
                <div className="text-xs text-gray-500">
                  {range === 'budget' && '$5-25 per product'}
                  {range === 'mid-range' && '$25-60 per product'}
                  {range === 'luxury' && '$60-150 per product'}
                  {range === 'ultra-luxury' && '$150+ per product'}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Product Values */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Leaf className="w-5 h-5 mr-2" />
          Product Values & Ethics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.preferences.preferClean}
                onChange={(e) => handleInputChange('preferences.preferClean', e.target.checked)}
                className="rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
              />
              <div>
                <span className="text-gray-300">Prefer Clean Beauty</span>
                <p className="text-xs text-gray-500">Non-toxic, sustainable ingredients</p>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.preferences.preferKBeauty}
                onChange={(e) => handleInputChange('preferences.preferKBeauty', e.target.checked)}
                className="rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
              />
              <div>
                <span className="text-gray-300">Prefer K-Beauty</span>
                <p className="text-xs text-gray-500">Korean skincare innovations</p>
              </div>
            </label>
          </div>

          <div className="space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.preferences.preferFragranceFree}
                onChange={(e) => handleInputChange('preferences.preferFragranceFree', e.target.checked)}
                className="rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
              />
              <div>
                <span className="text-gray-300">Fragrance-Free</span>
                <p className="text-xs text-gray-500">No added fragrances or essential oils</p>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.preferences.preferCrueltyFree}
                onChange={(e) => handleInputChange('preferences.preferCrueltyFree', e.target.checked)}
                className="rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
              />
              <div>
                <span className="text-gray-300">Cruelty-Free</span>
                <p className="text-xs text-gray-500">No animal testing</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Texture Preferences */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Sparkles className="w-5 h-5 mr-2" />
          Texture Preferences
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Select the textures you prefer (multiple selections help Bailey find products you'll love)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {textureOptions.map(texture => (
            <label key={texture} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.preferences.texturePreferences.includes(texture)}
                onChange={() => handleArrayChange('preferences.texturePreferences', texture)}
                className="rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">
                {texture.split('-').map(word =>
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Ingredients to Avoid */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4">Ingredients to Avoid</h3>
        <p className="text-sm text-gray-400 mb-4">
          Select ingredients you prefer to avoid (these will be filtered out of all recommendations)
        </p>

        {/* Common ingredients */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-300 mb-3">Common Ingredients:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {commonAvoidIngredients.map(ingredient => (
              <label key={ingredient} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.preferences.avoidIngredients.includes(ingredient)}
                  onChange={() => handleArrayChange('preferences.avoidIngredients', ingredient)}
                  className="rounded border-gray-600 text-red-400 focus:ring-red-400 focus:ring-offset-0"
                />
                <span className="text-sm text-gray-300">{ingredient}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom ingredient input */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-300">Add Custom Ingredient:</p>
          <div className="flex space-x-2">
            <input
              type="text"
              value={customIngredient}
              onChange={(e) => setCustomIngredient(e.target.value)}
              placeholder="Enter ingredient name"
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
              onKeyPress={(e) => e.key === 'Enter' && addCustomIngredient()}
            />
            <button
              onClick={addCustomIngredient}
              className="px-6 py-3 bg-[#d4a574] text-black rounded-lg hover:bg-[#d4a574]/90 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Current avoid list */}
        {formData.preferences.avoidIngredients.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-300 mb-3">Currently Avoiding:</p>
            <div className="flex flex-wrap gap-2">
              {formData.preferences.avoidIngredients.map(ingredient => (
                <span
                  key={ingredient}
                  className="inline-flex items-center space-x-2 px-3 py-1 bg-red-900/20 border border-red-400/30 text-red-300 rounded-full text-sm"
                >
                  <span>{ingredient}</span>
                  <button
                    onClick={() => removeIngredient(ingredient)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Insights */}
      {(formData.preferences.budgetRange || formData.preferences.texturePreferences.length > 0) && (
        <div className="bg-[#d4a574]/5 border border-[#d4a574]/20 rounded-lg p-6">
          <h3 className="text-lg font-medium text-[#d4a574] mb-4">Bailey's Preference Analysis</h3>
          <div className="space-y-3 text-sm">
            {formData.preferences.budgetRange && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-[#d4a574] rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-[#d4a574] font-medium">Budget Optimization:</span>
                  {formData.preferences.budgetRange === 'budget' && ' Bailey will prioritize high-value, effective products from trusted Korean brands'}
                  {formData.preferences.budgetRange === 'mid-range' && ' Perfect balance of quality and value - access to premium K-beauty innovations'}
                  {formData.preferences.budgetRange === 'luxury' && ' Premium formulations with cutting-edge ingredients and elegant packaging'}
                  {formData.preferences.budgetRange === 'ultra-luxury' && ' Exclusive access to the finest Korean beauty innovations and limited editions'}
                </p>
              </div>
            )}
            {formData.preferences.preferKBeauty && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-[#d4a574] rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-[#d4a574] font-medium">K-Beauty Focus:</span>
                  You'll receive recommendations from innovative Korean brands known for gentle yet effective formulations
                </p>
              </div>
            )}
            {formData.preferences.avoidIngredients.length > 0 && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-orange-400 font-medium">Ingredient Filtering:</span>
                  Bailey will automatically exclude {formData.preferences.avoidIngredients.length} ingredient{formData.preferences.avoidIngredients.length > 1 ? 's' : ''} from all recommendations
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}