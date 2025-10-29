'use client'

import { useState, useEffect } from 'react'
import { BaileyUserProfile } from '@/types/bailey-profile'
import { Activity, Droplets, Moon, Utensils, Cigarette } from 'lucide-react'

interface LifestyleSettingsProps {
  profile: Partial<BaileyUserProfile> | null
  onUpdate: (data: Partial<BaileyUserProfile>) => void
}

export default function LifestyleSettings({ profile, onUpdate }: LifestyleSettingsProps) {
  const [formData, setFormData] = useState({
    lifestyle: {
      exerciseFrequency: profile?.lifestyle?.exerciseFrequency || '',
      sleepDuration: profile?.lifestyle?.sleepDuration || '',
      stressLevel: profile?.lifestyle?.stressLevel || '',
      waterIntake: profile?.lifestyle?.waterIntake || '',
      dietType: profile?.lifestyle?.dietType || '',
      smokingStatus: profile?.lifestyle?.smokingStatus || '',
      alcoholConsumption: profile?.lifestyle?.alcoholConsumption || ''
    }
  })

  useEffect(() => {
    setFormData({
      lifestyle: {
        exerciseFrequency: profile?.lifestyle?.exerciseFrequency || '',
        sleepDuration: profile?.lifestyle?.sleepDuration || '',
        stressLevel: profile?.lifestyle?.stressLevel || '',
        waterIntake: profile?.lifestyle?.waterIntake || '',
        dietType: profile?.lifestyle?.dietType || '',
        smokingStatus: profile?.lifestyle?.smokingStatus || '',
        alcoholConsumption: profile?.lifestyle?.alcoholConsumption || ''
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

  const exerciseOptions = [
    'none', 'light', 'moderate', 'intense', 'athlete-level'
  ]

  const sleepOptions = [
    'less-than-5', '5-6', '6-7', '7-8', '8-9', 'more-than-9'
  ]

  const stressLevels = [
    'very-low', 'low', 'moderate', 'high', 'very-high'
  ]

  const waterIntakeOptions = [
    'insufficient', 'adequate', 'excellent'
  ]

  const dietTypes = [
    'standard', 'vegetarian', 'vegan', 'keto', 'mediterranean', 'low-carb', 'high-protein'
  ]

  const smokingOptions = [
    'never', 'former', 'occasional', 'regular'
  ]

  const alcoholOptions = [
    'never', 'rarely', 'social', 'moderate', 'frequent'
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-light text-white mb-2">Lifestyle Factors</h2>
        <p className="text-gray-400">
          Your daily habits significantly impact your skin health and influence product recommendations
        </p>
      </div>

      {/* Exercise & Sleep */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          Physical Activity & Rest
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Exercise Frequency
            </label>
            <select
              value={formData.lifestyle.exerciseFrequency}
              onChange={(e) => handleInputChange('lifestyle.exerciseFrequency', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select exercise frequency</option>
              {exerciseOptions.map(option => (
                <option key={option} value={option}>
                  {option.split('-').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Exercise affects oil production and hydration needs
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Sleep Duration (hours per night)
            </label>
            <select
              value={formData.lifestyle.sleepDuration}
              onChange={(e) => handleInputChange('lifestyle.sleepDuration', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select sleep duration</option>
              {sleepOptions.map(option => (
                <option key={option} value={option}>
                  {option.replace('-', ' to ').replace('than-', 'than ')} hours
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Sleep quality affects skin regeneration and appearance
            </p>
          </div>
        </div>
      </div>

      {/* Stress & Hydration */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Droplets className="w-5 h-5 mr-2" />
          Stress & Hydration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Current Stress Level
            </label>
            <select
              value={formData.lifestyle.stressLevel}
              onChange={(e) => handleInputChange('lifestyle.stressLevel', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select stress level</option>
              {stressLevels.map(level => (
                <option key={level} value={level}>
                  {level.split('-').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Stress can trigger breakouts and skin sensitivity
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Daily Water Intake
            </label>
            <select
              value={formData.lifestyle.waterIntake}
              onChange={(e) => handleInputChange('lifestyle.waterIntake', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select water intake</option>
              {waterIntakeOptions.map(option => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)} (
                  {option === 'insufficient' && 'less than 6 glasses'}
                  {option === 'adequate' && '6-8 glasses'}
                  {option === 'excellent' && 'more than 8 glasses'}
                  )
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Hydration directly impacts skin plumpness and texture
            </p>
          </div>
        </div>
      </div>

      {/* Diet & Habits */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Utensils className="w-5 h-5 mr-2" />
          Diet & Nutrition
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Primary Diet Type
          </label>
          <select
            value={formData.lifestyle.dietType}
            onChange={(e) => handleInputChange('lifestyle.dietType', e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
          >
            <option value="">Select diet type</option>
            {dietTypes.map(diet => (
              <option key={diet} value={diet}>
                {diet.split('-').map(word =>
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Diet affects inflammation levels and skin clarity
          </p>
        </div>
      </div>

      {/* Lifestyle Habits */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Cigarette className="w-5 h-5 mr-2" />
          Lifestyle Habits
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Smoking Status
            </label>
            <select
              value={formData.lifestyle.smokingStatus}
              onChange={(e) => handleInputChange('lifestyle.smokingStatus', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select smoking status</option>
              {smokingOptions.map(option => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Smoking significantly impacts skin aging and circulation
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Alcohol Consumption
            </label>
            <select
              value={formData.lifestyle.alcoholConsumption}
              onChange={(e) => handleInputChange('lifestyle.alcoholConsumption', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select alcohol consumption</option>
              {alcoholOptions.map(option => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Alcohol can dehydrate skin and affect circulation
            </p>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {(formData.lifestyle.stressLevel || formData.lifestyle.waterIntake || formData.lifestyle.smokingStatus) && (
        <div className="bg-[#d4a574]/5 border border-[#d4a574]/20 rounded-lg p-6">
          <h3 className="text-lg font-medium text-[#d4a574] mb-4">Bailey's Lifestyle Analysis</h3>
          <div className="space-y-3 text-sm">
            {formData.lifestyle.stressLevel === 'high' || formData.lifestyle.stressLevel === 'very-high' ? (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-red-400 font-medium">Stress Alert:</span>
                  High stress can trigger breakouts and sensitivity. Consider gentle, soothing products and stress-reduction techniques.
                </p>
              </div>
            ) : null}
            {formData.lifestyle.waterIntake === 'insufficient' ? (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-blue-400 font-medium">Hydration Boost:</span>
                  Low water intake affects skin hydration. Bailey will recommend extra hydrating products and ingredients.
                </p>
              </div>
            ) : null}
            {formData.lifestyle.smokingStatus === 'regular' || formData.lifestyle.smokingStatus === 'occasional' ? (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-orange-400 font-medium">Antioxidant Focus:</span>
                  Smoking accelerates aging. Bailey will prioritize antioxidant-rich products and barrier repair ingredients.
                </p>
              </div>
            ) : null}
            {formData.lifestyle.exerciseFrequency === 'intense' || formData.lifestyle.exerciseFrequency === 'athlete-level' ? (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-[#d4a574] rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-[#d4a574] font-medium">Active Lifestyle:</span>
                  Frequent exercise requires gentle, non-comedogenic products that won't clog pores during sweating.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}