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
      exerciseFrequency: profile?.lifestyle?.exerciseFrequency || 'sedentary' as 'sedentary' | '1-2x/week' | '3-4x/week' | 'daily',
      exerciseType: profile?.lifestyle?.exerciseType || [],
      sleepHours: profile?.lifestyle?.sleepHours || 7,
      sleepQuality: profile?.lifestyle?.sleepQuality || 'good' as 'poor' | 'fair' | 'good' | 'excellent',
      stressLevel: profile?.lifestyle?.stressLevel || 'moderate' as 'low' | 'moderate' | 'high' | 'very-high',
      waterIntake: profile?.lifestyle?.waterIntake || 'moderate' as 'insufficient' | 'moderate' | 'adequate' | 'excellent',
      smokingStatus: profile?.lifestyle?.smokingStatus || 'never' as 'never' | 'former' | 'occasional' | 'regular',
      alcoholConsumption: profile?.lifestyle?.alcoholConsumption || 'none' as 'none' | 'occasional' | 'moderate' | 'frequent',
      diet: {
        type: profile?.lifestyle?.diet?.type || 'standard' as 'standard' | 'vegetarian' | 'vegan' | 'keto' | 'paleo' | 'other',
        dairyConsumption: profile?.lifestyle?.diet?.dairyConsumption || false,
        sugarIntake: profile?.lifestyle?.diet?.sugarIntake || 'moderate' as 'low' | 'moderate' | 'high',
        processedFoods: profile?.lifestyle?.diet?.processedFoods || 'sometimes' as 'rarely' | 'sometimes' | 'often'
      },
      sunExposure: profile?.lifestyle?.sunExposure || 'moderate' as 'minimal' | 'moderate' | 'high',
      screenTime: profile?.lifestyle?.screenTime || 8,
      occupation: profile?.lifestyle?.occupation || '',
      outdoorTime: profile?.lifestyle?.outdoorTime || 1
    }
  })

  useEffect(() => {
    setFormData({
      lifestyle: {
        exerciseFrequency: profile?.lifestyle?.exerciseFrequency || 'sedentary' as 'sedentary' | '1-2x/week' | '3-4x/week' | 'daily',
        exerciseType: profile?.lifestyle?.exerciseType || [],
        sleepHours: profile?.lifestyle?.sleepHours || 7,
        sleepQuality: profile?.lifestyle?.sleepQuality || 'good' as 'poor' | 'fair' | 'good' | 'excellent',
        stressLevel: profile?.lifestyle?.stressLevel || 'moderate' as 'low' | 'moderate' | 'high' | 'very-high',
        waterIntake: profile?.lifestyle?.waterIntake || 'moderate' as 'insufficient' | 'moderate' | 'adequate' | 'excellent',
        smokingStatus: profile?.lifestyle?.smokingStatus || 'never' as 'never' | 'former' | 'occasional' | 'regular',
        alcoholConsumption: profile?.lifestyle?.alcoholConsumption || 'none' as 'none' | 'occasional' | 'moderate' | 'frequent',
        diet: {
          type: profile?.lifestyle?.diet?.type || 'standard' as 'standard' | 'vegetarian' | 'vegan' | 'keto' | 'paleo' | 'other',
          dairyConsumption: profile?.lifestyle?.diet?.dairyConsumption || false,
          sugarIntake: profile?.lifestyle?.diet?.sugarIntake || 'moderate' as 'low' | 'moderate' | 'high',
          processedFoods: profile?.lifestyle?.diet?.processedFoods || 'sometimes' as 'rarely' | 'sometimes' | 'often'
        },
        sunExposure: profile?.lifestyle?.sunExposure || 'moderate' as 'minimal' | 'moderate' | 'high',
        screenTime: profile?.lifestyle?.screenTime || 8,
        occupation: profile?.lifestyle?.occupation || '',
        outdoorTime: profile?.lifestyle?.outdoorTime || 1
      }
    })
  }, [profile])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev }
      const parts = field.split('.')

      if (parts[0] === 'lifestyle' && parts.length === 2) {
        updated.lifestyle = {
          ...updated.lifestyle,
          [parts[1]]: value
        }
      } else if (parts[0] === 'lifestyle' && parts[1] === 'diet' && parts.length === 3) {
        updated.lifestyle = {
          ...updated.lifestyle,
          diet: {
            ...updated.lifestyle.diet,
            [parts[2]]: value
          }
        }
      }
      return updated
    })
    onUpdate(formData)
  }

  const exerciseOptions = [
    'sedentary', '1-2x/week', '3-4x/week', 'daily'
  ]

  const sleepQualityOptions = [
    'poor', 'fair', 'good', 'excellent'
  ]

  const stressLevels = [
    'low', 'moderate', 'high', 'very-high'
  ]

  const waterIntakeOptions = [
    'insufficient', 'moderate', 'adequate', 'excellent'
  ]

  const dietTypes = [
    'standard', 'vegetarian', 'vegan', 'keto', 'paleo', 'other'
  ]

  const smokingOptions = [
    'never', 'former', 'occasional', 'regular'
  ]

  const alcoholOptions = [
    'none', 'occasional', 'moderate', 'frequent'
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
                  {option === 'sedentary' ? 'Sedentary (minimal exercise)' :
                   option === '1-2x/week' ? '1-2 times per week' :
                   option === '3-4x/week' ? '3-4 times per week' :
                   option === 'daily' ? 'Daily exercise' : option}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Exercise affects oil production and hydration needs
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Sleep Hours (per night)
            </label>
            <input
              type="number"
              min="4"
              max="12"
              value={formData.lifestyle.sleepHours}
              onChange={(e) => handleInputChange('lifestyle.sleepHours', parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">
              Adequate sleep (7-9 hours) is crucial for skin repair
            </p>
          </div>
        </div>
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Sleep Quality
          </label>
          <select
            value={formData.lifestyle.sleepQuality}
            onChange={(e) => handleInputChange('lifestyle.sleepQuality', e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
          >
            <option value="">Select sleep quality</option>
            {sleepQualityOptions.map(option => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Sleep quality affects skin regeneration and appearance
          </p>
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
                  {level === 'very-high' ? 'Very High' :
                   level.charAt(0).toUpperCase() + level.slice(1)}
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
                  {option === 'moderate' && '6-7 glasses'}
                  {option === 'adequate' && '8 glasses'}
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
            value={formData.lifestyle.diet.type}
            onChange={(e) => handleInputChange('lifestyle.diet.type', e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
          >
            <option value="">Select diet type</option>
            {dietTypes.map(diet => (
              <option key={diet} value={diet}>
                {diet.charAt(0).toUpperCase() + diet.slice(1)}
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
                  {option === 'none' ? 'None' :
                   option === 'occasional' ? 'Occasional (1-2 drinks/week)' :
                   option === 'moderate' ? 'Moderate (3-7 drinks/week)' :
                   option === 'frequent' ? 'Frequent (8+ drinks/week)' : option}
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
            {formData.lifestyle.exerciseFrequency === 'daily' ? (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-[#d4a574] rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-[#d4a574] font-medium">Active Lifestyle:</span>
                  Daily exercise requires gentle, non-comedogenic products that won't clog pores during sweating.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}