'use client'

import { useState, useEffect } from 'react'
import { BaileyUserProfile } from '@/types/bailey-profile'
import { Target, Clock, TrendingUp, Award } from 'lucide-react'

interface GoalsSettingsProps {
  profile: Partial<BaileyUserProfile> | null
  onUpdate: (data: Partial<BaileyUserProfile>) => void
}

export default function GoalsSettings({ profile, onUpdate }: GoalsSettingsProps) {
  const [formData, setFormData] = useState({
    goals: {
      primary: profile?.goals?.primary || '',
      secondary: profile?.goals?.secondary || [],
      timeline: profile?.goals?.timeline || '',
      commitment: profile?.goals?.commitment || '',
      willingToInvest: profile?.goals?.willingToInvest || false
    }
  })

  useEffect(() => {
    setFormData({
      goals: {
        primary: profile?.goals?.primary || '',
        secondary: profile?.goals?.secondary || [],
        timeline: profile?.goals?.timeline || '',
        commitment: profile?.goals?.commitment || '',
        willingToInvest: profile?.goals?.willingToInvest || false
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
    const currentArray = formData[parent as keyof typeof formData][child as keyof typeof formData.goals] as string[]
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value]

    handleInputChange(field, newArray)
  }

  const primaryGoals = [
    'clear-acne', 'reduce-aging', 'brighten-skin', 'hydrate-skin', 'even-skin-tone',
    'minimize-pores', 'improve-texture', 'reduce-sensitivity', 'prevent-damage', 'maintain-health'
  ]

  const secondaryGoals = [
    'reduce-dark-spots', 'minimize-fine-lines', 'control-oil', 'boost-radiance',
    'firm-skin', 'soothe-irritation', 'prevent-breakouts', 'improve-barrier',
    'reduce-redness', 'enhance-glow', 'smooth-texture', 'strengthen-skin'
  ]

  const timelines = [
    '1-month', '3-months', '6-months', '12-months', 'long-term'
  ]

  const commitmentLevels = [
    'minimal', 'moderate', 'dedicated', 'enthusiast'
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-light text-white mb-2">Skincare Goals</h2>
        <p className="text-gray-400">
          Clear goals help Bailey create a targeted routine and track your progress over time
        </p>
      </div>

      {/* Primary Goal */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2" />
          Primary Skincare Goal
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          What is your main skin concern you'd like to address?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {primaryGoals.map(goal => (
            <label key={goal} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="primaryGoal"
                value={goal}
                checked={formData.goals.primary === goal}
                onChange={(e) => handleInputChange('goals.primary', e.target.value)}
                className="text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
              />
              <span className="text-gray-300">
                {goal.split('-').map(word =>
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Secondary Goals */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Secondary Goals
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Select additional concerns you'd like to address (optional, multiple selections welcome)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {secondaryGoals.map(goal => (
            <label key={goal} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.goals.secondary.includes(goal)}
                onChange={() => handleArrayChange('goals.secondary', goal)}
                className="rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">
                {goal.split('-').map(word =>
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Timeline & Commitment */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Timeline & Commitment
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Expected Timeline for Results
            </label>
            <select
              value={formData.goals.timeline}
              onChange={(e) => handleInputChange('goals.timeline', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select timeline</option>
              {timelines.map(timeline => (
                <option key={timeline} value={timeline}>
                  {timeline.replace('-', ' ').replace('term', ' term')}
                  {timeline === '1-month' && ' (quick improvements)'}
                  {timeline === '3-months' && ' (noticeable changes)'}
                  {timeline === '6-months' && ' (significant transformation)'}
                  {timeline === '12-months' && ' (complete skin renewal)'}
                  {timeline === 'long-term' && ' (ongoing maintenance)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Realistic timelines help set proper expectations
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Commitment Level
            </label>
            <select
              value={formData.goals.commitment}
              onChange={(e) => handleInputChange('goals.commitment', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="">Select commitment level</option>
              {commitmentLevels.map(level => (
                <option key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                  {level === 'minimal' && ' (2-3 steps, 5 min/day)'}
                  {level === 'moderate' && ' (4-5 steps, 10 min/day)'}
                  {level === 'dedicated' && ' (6-8 steps, 15 min/day)'}
                  {level === 'enthusiast' && ' (10+ steps, 20+ min/day)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              How much time can you realistically dedicate daily?
            </p>
          </div>
        </div>
      </div>

      {/* Investment Willingness */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Award className="w-5 h-5 mr-2" />
          Investment in Results
        </h3>
        <div className="space-y-4">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.goals.willingToInvest}
              onChange={(e) => handleInputChange('goals.willingToInvest', e.target.checked)}
              className="rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
            />
            <div>
              <span className="text-gray-300">Willing to invest in premium products for better results</span>
              <p className="text-xs text-gray-500">
                This helps Bailey recommend higher-end formulations when they offer significantly better outcomes
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Progress Tracking */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4">Progress Tracking Preferences</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h4 className="font-medium text-gray-300 mb-2">Photo Progress</h4>
            <p className="text-sm text-gray-500">
              Take weekly photos to track visual improvements (optional but recommended)
            </p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h4 className="font-medium text-gray-300 mb-2">Skin Journal</h4>
            <p className="text-sm text-gray-500">
              Log daily skin condition and product reactions for better insights
            </p>
          </div>
        </div>
      </div>

      {/* AI Goal Analysis */}
      {formData.goals.primary && formData.goals.commitment && (
        <div className="bg-[#d4a574]/5 border border-[#d4a574]/20 rounded-lg p-6">
          <h3 className="text-lg font-medium text-[#d4a574] mb-4">Bailey's Goal Analysis</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-[#d4a574] rounded-full mt-2"></div>
              <p className="text-gray-300">
                <span className="text-[#d4a574] font-medium">Primary Focus:</span>
                {formData.goals.primary === 'clear-acne' && ' Bailey will prioritize gentle, anti-inflammatory ingredients and oil control'}
                {formData.goals.primary === 'reduce-aging' && ' Anti-aging routine with retinoids, peptides, and antioxidants'}
                {formData.goals.primary === 'brighten-skin' && ' Vitamin C, niacinamide, and gentle exfoliation for radiance'}
                {formData.goals.primary === 'hydrate-skin' && ' Deep hydration with hyaluronic acid, ceramides, and barrier repair'}
                {formData.goals.primary === 'even-skin-tone' && ' Targeted pigmentation treatments with arbutin and gentle acids'}
                {!['clear-acne', 'reduce-aging', 'brighten-skin', 'hydrate-skin', 'even-skin-tone'].includes(formData.goals.primary) && ' Customized routine targeting your specific concern'}
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-[#d4a574] rounded-full mt-2"></div>
              <p className="text-gray-300">
                <span className="text-[#d4a574] font-medium">Routine Complexity:</span>
                {formData.goals.commitment === 'minimal' && ' Simple 3-step routine focusing on essentials only'}
                {formData.goals.commitment === 'moderate' && ' Balanced 5-step routine with targeted treatments'}
                {formData.goals.commitment === 'dedicated' && ' Comprehensive routine with specialized products'}
                {formData.goals.commitment === 'enthusiast' && ' Full Korean beauty experience with advanced techniques'}
              </p>
            </div>
            {formData.goals.timeline && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-[#d4a574] rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-[#d4a574] font-medium">Expected Results:</span>
                  {formData.goals.timeline === '1-month' && ' Initial hydration and texture improvements'}
                  {formData.goals.timeline === '3-months' && ' Noticeable improvement in primary concern'}
                  {formData.goals.timeline === '6-months' && ' Significant transformation and skin renewal'}
                  {formData.goals.timeline === '12-months' && ' Complete skin transformation with optimal health'}
                  {formData.goals.timeline === 'long-term' && ' Ongoing maintenance and prevention focus'}
                </p>
              </div>
            )}
            {formData.goals.secondary.length > 0 && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-blue-400 font-medium">Bonus Benefits:</span>
                  Bailey will incorporate ingredients that address your {formData.goals.secondary.length} secondary goal{formData.goals.secondary.length > 1 ? 's' : ''} without compromising your primary focus
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}