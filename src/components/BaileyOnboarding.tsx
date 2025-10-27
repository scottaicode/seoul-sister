'use client'

import { useState } from 'react'
import { ChevronRight, ChevronLeft, MapPin, Heart, Sparkles, Camera, Target } from 'lucide-react'
import { BaileyUserProfile } from '@/types/bailey-profile'

interface OnboardingProps {
  onComplete: (profile: Partial<BaileyUserProfile>) => void
}

export default function BaileyOnboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState<Partial<BaileyUserProfile>>({
    skin: {
      type: 'normal',
      tone: 'medium',
      concerns: [],
      sensitivities: [],
      currentCondition: 'good'
    },
    lifestyle: {
      smokingStatus: 'never',
      alcoholConsumption: 'moderate',
      exerciseFrequency: '3-4x/week',
      sleepHours: 7,
      sleepQuality: 'good',
      stressLevel: 'moderate',
      waterIntake: 'adequate',
      diet: { type: 'standard', dairyConsumption: false, sugarIntake: 'moderate', processedFoods: 'sometimes' },
      sunExposure: 'moderate',
      screenTime: 8,
      outdoorTime: 2
    },
    medical: {
      currentMedications: [],
      allergies: [],
      medicalConditions: []
    },
    goals: {
      primary: '',
      secondary: [],
      timeline: '3-months',
      commitment: 'moderate',
      willingToInvest: false
    },
    preferences: {
      budgetRange: 'mid-range',
      preferClean: false,
      preferKBeauty: false,
      preferFragranceFree: false,
      preferCrueltyFree: false,
      avoidIngredients: [],
      texturePreferences: []
    }
  })

  const totalSteps = 8

  const updateProfile = (updates: Partial<BaileyUserProfile>) => {
    setProfile(prev => {
      const newProfile = { ...prev }

      // Simple properties
      if (updates.name !== undefined) newProfile.name = updates.name
      if (updates.age !== undefined) newProfile.age = updates.age
      if (updates.ethnicity !== undefined) newProfile.ethnicity = updates.ethnicity
      if (updates.location !== undefined) newProfile.location = updates.location
      if (updates.birthDate !== undefined) newProfile.birthDate = updates.birthDate
      if (updates.email !== undefined) newProfile.email = updates.email
      if (updates.id !== undefined) newProfile.id = updates.id

      // Complex properties - merge with existing
      if (updates.skin) {
        newProfile.skin = { ...prev.skin, ...updates.skin }
      }
      if (updates.lifestyle) {
        newProfile.lifestyle = { ...prev.lifestyle, ...updates.lifestyle }
      }
      if (updates.medical) {
        newProfile.medical = { ...prev.medical, ...updates.medical }
      }
      if (updates.goals) {
        newProfile.goals = { ...prev.goals, ...updates.goals }
      }
      if (updates.preferences) {
        newProfile.preferences = { ...prev.preferences, ...updates.preferences }
      }

      return newProfile
    })
  }

  const nextStep = () => {
    if (step < totalSteps) setStep(step + 1)
    else onComplete(profile)
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-light text-white">Let's Get To Know You</h2>
            <span className="text-sm text-gray-400">{step} of {totalSteps}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-[#d4a574] to-[#f4c794] h-2 rounded-full transition-all duration-500"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-900/50 border border-[#d4a574]/20 rounded-2xl shadow-xl p-8 backdrop-blur-sm">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-[#d4a574]/20 to-[#f4c794]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-10 h-10 text-[#d4a574]" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Welcome to Your Skin Journey</h3>
                <p className="text-gray-400">Every individual has unique skin. Let's understand yours.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Your Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574]"
                  placeholder="Enter your name"
                  value={profile.name || ''}
                  onChange={(e) => updateProfile({ name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Age Range</label>
                <select
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574]"
                  value={profile.age || ''}
                  onChange={(e) => updateProfile({ age: e.target.value })}
                >
                  <option value="">Select your age range</option>
                  <option value="13-17">13-17</option>
                  <option value="18-24">18-24</option>
                  <option value="25-34">25-34</option>
                  <option value="35-44">35-44</option>
                  <option value="45-54">45-54</option>
                  <option value="55-64">55-64</option>
                  <option value="65+">65+</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Different ages need different skincare approaches</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Ethnicity (Optional)</label>
                <select
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574]"
                  value={profile.ethnicity || ''}
                  onChange={(e) => updateProfile({ ethnicity: e.target.value })}
                >
                  <option value="">Select your ethnicity (optional)</option>
                  <option value="East Asian">East Asian</option>
                  <option value="Southeast Asian">Southeast Asian</option>
                  <option value="South Asian">South Asian</option>
                  <option value="Black/African">Black/African</option>
                  <option value="Hispanic/Latino">Hispanic/Latino</option>
                  <option value="Middle Eastern">Middle Eastern</option>
                  <option value="Native American">Native American</option>
                  <option value="White/Caucasian">White/Caucasian</option>
                  <option value="Pacific Islander">Pacific Islander</option>
                  <option value="Mixed/Multiracial">Mixed/Multiracial</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Helps us understand your skin's unique characteristics</p>
              </div>
            </div>
          )}

          {/* Step 2: Location & Climate */}
          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-[#d4a574]/20 to-[#f4c794]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-10 h-10 text-[#d4a574]" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Where Do You Live?</h3>
                <p className="text-gray-400">Your environment greatly affects your skin's needs</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">City</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574]"
                    placeholder="Your city"
                    value={profile.location?.city || ''}
                    onChange={(e) => updateProfile({
                      location: { ...profile.location, city: e.target.value } as any
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">State</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574]"
                    placeholder="Your state"
                    value={profile.location?.state || ''}
                    onChange={(e) => updateProfile({
                      location: { ...profile.location, state: e.target.value } as any
                    })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Climate Type</label>
                <select
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574]"
                  value={profile.location?.climate || ''}
                  onChange={(e) => updateProfile({
                    location: { ...profile.location, climate: e.target.value } as any
                  })}
                >
                  <option value="">Select your climate</option>
                  <option value="tropical">Tropical (Hot & Humid)</option>
                  <option value="dry">Dry (Low Humidity)</option>
                  <option value="temperate">Temperate (Moderate)</option>
                  <option value="continental">Continental (Hot Summers, Cold Winters)</option>
                  <option value="polar">Polar (Very Cold)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Minnesota winters need different care than California winters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Humidity Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {['low', 'moderate', 'high'].map((level) => (
                    <button
                      key={level}
                      className={`py-3 px-4 rounded-lg border-2 transition-all ${
                        profile.location?.humidity === level
                          ? 'border-[#d4a574] bg-[#d4a574]/10 text-[#d4a574]'
                          : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-[#d4a574] hover:bg-gray-700'
                      }`}
                      onClick={() => updateProfile({
                        location: { ...profile.location, humidity: level } as any
                      })}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Lifestyle Habits */}
          {step === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-[#d4a574]/20 to-[#f4c794]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-10 h-10 text-[#d4a574]" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Your Lifestyle</h3>
                <p className="text-gray-400">Your habits directly impact your skin health</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Do you smoke?</label>
                <div className="grid grid-cols-4 gap-2">
                  {['never', 'former', 'occasional', 'regular'].map((status) => (
                    <button
                      key={status}
                      className={`py-2 px-3 rounded-lg border-2 text-sm transition-all ${
                        profile.lifestyle?.smokingStatus === status
                          ? 'border-[#d4a574] bg-[#d4a574]/10 text-[#d4a574]'
                          : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-[#d4a574] hover:bg-gray-700'
                      }`}
                      onClick={() => updateProfile({
                        lifestyle: { ...profile.lifestyle, smokingStatus: status } as any
                      })}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Exercise Frequency</label>
                <div className="grid grid-cols-2 gap-2">
                  {['sedentary', '1-2x/week', '3-4x/week', 'daily'].map((freq) => (
                    <button
                      key={freq}
                      className={`py-3 px-4 rounded-lg border-2 transition-all ${
                        profile.lifestyle?.exerciseFrequency === freq
                          ? 'border-[#d4a574] bg-[#d4a574]/10 text-[#d4a574]'
                          : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-[#d4a574] hover:bg-gray-700'
                      }`}
                      onClick={() => updateProfile({
                        lifestyle: { ...profile.lifestyle, exerciseFrequency: freq } as any
                      })}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Water Intake</label>
                <div className="grid grid-cols-2 gap-2">
                  {['insufficient', 'moderate', 'adequate', 'excellent'].map((intake) => (
                    <button
                      key={intake}
                      className={`py-3 px-4 rounded-lg border-2 transition-all ${
                        profile.lifestyle?.waterIntake === intake
                          ? 'border-[#d4a574] bg-[#d4a574]/10 text-[#d4a574]'
                          : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-[#d4a574] hover:bg-gray-700'
                      }`}
                      onClick={() => updateProfile({
                        lifestyle: { ...profile.lifestyle, waterIntake: intake } as any
                      })}
                    >
                      {intake.charAt(0).toUpperCase() + intake.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">Hydration affects skin from within</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sleep Quality</label>
                <div className="grid grid-cols-4 gap-2">
                  {['poor', 'fair', 'good', 'excellent'].map((quality) => (
                    <button
                      key={quality}
                      className={`py-2 px-3 rounded-lg border-2 text-sm transition-all ${
                        profile.lifestyle?.sleepQuality === quality
                          ? 'border-[#d4a574] bg-[#d4a574]/10 text-[#d4a574]'
                          : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-[#d4a574] hover:bg-gray-700'
                      }`}
                      onClick={() => updateProfile({
                        lifestyle: { ...profile.lifestyle, sleepQuality: quality } as any
                      })}
                    >
                      {quality.charAt(0).toUpperCase() + quality.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Diet Type</label>
                <select
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574]"
                  value={profile.lifestyle?.diet?.type || 'standard'}
                  onChange={(e) => updateProfile({
                    lifestyle: {
                      ...profile.lifestyle,
                      diet: { ...profile.lifestyle?.diet, type: e.target.value }
                    } as any
                  })}
                >
                  <option value="standard">Standard</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="keto">Keto</option>
                  <option value="paleo">Paleo</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Medical Information */}
          {step === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-[#d4a574]/20 to-[#f4c794]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-10 h-10 text-[#d4a574]" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Medical Information</h3>
                <p className="text-gray-400">Helps us avoid conflicts and provide safe recommendations</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Medications (especially Accutane, tretinoin, etc.)
                </label>
                <textarea
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574]"
                  rows={3}
                  placeholder="List any medications you're taking, separated by commas"
                  value={profile.medical?.currentMedications?.join(', ') || ''}
                  onChange={(e) => updateProfile({
                    medical: {
                      ...profile.medical,
                      currentMedications: e.target.value ? e.target.value.split(',').map(m => m.trim()).filter(m => m) : [],
                      allergies: profile.medical?.allergies || [],
                      medicalConditions: profile.medical?.medicalConditions || []
                    }
                  })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Some medications affect which skincare products you can use
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Allergies</label>
                <textarea
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574]"
                  rows={2}
                  placeholder="List any allergies, especially to skincare ingredients"
                  value={profile.medical?.allergies?.join(', ') || ''}
                  onChange={(e) => updateProfile({
                    medical: {
                      ...profile.medical,
                      currentMedications: profile.medical?.currentMedications || [],
                      allergies: e.target.value ? e.target.value.split(',').map(a => a.trim()).filter(a => a) : [],
                      medicalConditions: profile.medical?.medicalConditions || []
                    }
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Hormone Status (Optional)
                </label>
                <select
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574]"
                  value={profile.medical?.hormoneStatus || ''}
                  onChange={(e) => updateProfile({
                    medical: { ...profile.medical, hormoneStatus: e.target.value } as any
                  })}
                >
                  <option value="">Select if applicable</option>
                  <option value="regular">Regular Cycle</option>
                  <option value="irregular">Irregular Cycle</option>
                  <option value="pregnancy">Pregnancy</option>
                  <option value="menopause">Menopause</option>
                  <option value="birth-control">Birth Control</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Hormones can significantly affect skin behavior
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Skin Profile */}
          {step === 5 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-[#d4a574]/20 to-[#f4c794]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-10 h-10 text-[#d4a574]" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Your Skin Type</h3>
                <p className="text-gray-400">Understanding your skin is the foundation</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Skin Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {['oily', 'dry', 'combination', 'sensitive', 'normal'].map((type) => (
                    <button
                      key={type}
                      className={`py-3 px-4 rounded-lg border-2 transition-all ${
                        profile.skin?.type === type
                          ? 'border-[#d4a574] bg-[#d4a574]/10 text-[#d4a574]'
                          : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-[#d4a574] hover:bg-gray-700'
                      }`}
                      onClick={() => updateProfile({
                        skin: { ...profile.skin, type: type } as any
                      })}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Skin Concerns</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'acne', 'blackheads', 'large-pores', 'oiliness',
                    'dryness', 'dehydration', 'sensitivity', 'redness',
                    'dark-spots', 'hyperpigmentation', 'dullness', 'uneven-texture',
                    'fine-lines', 'wrinkles'
                  ].map((concern) => (
                    <button
                      key={concern}
                      className={`py-2 px-3 rounded-lg border-2 text-sm transition-all ${
                        profile.skin?.concerns?.includes(concern)
                          ? 'border-[#d4a574] bg-[#d4a574]/10 text-[#d4a574]'
                          : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-[#d4a574] hover:bg-gray-700'
                      }`}
                      onClick={() => {
                        const concerns = profile.skin?.concerns || []
                        updateProfile({
                          skin: {
                            ...profile.skin,
                            concerns: concerns.includes(concern)
                              ? concerns.filter(c => c !== concern)
                              : [...concerns, concern]
                          } as any
                        })
                      }}
                    >
                      {concern.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Current Skin Condition</label>
                <div className="grid grid-cols-4 gap-2">
                  {['poor', 'fair', 'good', 'excellent'].map((condition) => (
                    <button
                      key={condition}
                      className={`py-2 px-3 rounded-lg border-2 text-sm transition-all ${
                        profile.skin?.currentCondition === condition
                          ? 'border-[#d4a574] bg-[#d4a574]/10 text-[#d4a574]'
                          : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-[#d4a574] hover:bg-gray-700'
                      }`}
                      onClick={() => updateProfile({
                        skin: { ...profile.skin, currentCondition: condition } as any
                      })}
                    >
                      {condition.charAt(0).toUpperCase() + condition.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Skincare Goals */}
          {step === 6 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-[#d4a574]/20 to-[#f4c794]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="w-10 h-10 text-[#d4a574]" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Your Goals</h3>
                <p className="text-gray-400">What do you want to achieve with your skincare?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Why are you looking to improve your skincare?
                </label>
                <textarea
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574]"
                  rows={3}
                  placeholder="Tell us your main skincare goal..."
                  value={profile.goals?.primary || ''}
                  onChange={(e) => updateProfile({
                    goals: { ...profile.goals, primary: e.target.value } as any
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Timeline</label>
                <div className="grid grid-cols-2 gap-2">
                  {['1-month', '3-months', '6-months', '1-year'].map((timeline) => (
                    <button
                      key={timeline}
                      className={`py-3 px-4 rounded-lg border-2 transition-all ${
                        profile.goals?.timeline === timeline
                          ? 'border-[#d4a574] bg-[#d4a574]/10 text-[#d4a574]'
                          : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-[#d4a574] hover:bg-gray-700'
                      }`}
                      onClick={() => updateProfile({
                        goals: { ...profile.goals, timeline: timeline } as any
                      })}
                    >
                      {timeline}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Commitment Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {['minimal', 'moderate', 'dedicated'].map((level) => (
                    <button
                      key={level}
                      className={`py-3 px-4 rounded-lg border-2 transition-all ${
                        profile.goals?.commitment === level
                          ? 'border-[#d4a574] bg-[#d4a574]/10 text-[#d4a574]'
                          : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-[#d4a574] hover:bg-gray-700'
                      }`}
                      onClick={() => updateProfile({
                        goals: { ...profile.goals, commitment: level } as any
                      })}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">How much time can you dedicate daily?</p>
              </div>
            </div>
          )}

          {/* Step 7: Current Routine (if any) */}
          {step === 7 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-[#d4a574]/20 to-[#f4c794]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Camera className="w-10 h-10 text-[#d4a574]" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Current Routine</h3>
                <p className="text-gray-400">Do you have a skincare routine already?</p>
              </div>

              <div className="space-y-4">
                <button
                  className="w-full py-4 px-6 rounded-xl border-2 border-dashed border-gray-700 hover:border-[#d4a574] transition-all"
                  onClick={() => {/* Will implement photo upload */}}
                >
                  <Camera className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-400">Take photos of your current products</p>
                  <p className="text-xs text-gray-400 mt-1">We'll analyze ingredients and compatibility</p>
                </button>

                <div className="text-center">
                  <p className="text-sm text-gray-500">or</p>
                </div>

                <button
                  className="w-full py-4 px-6 rounded-xl bg-[#d4a574]/10 hover:bg-[#d4a574]/20 transition-all"
                  onClick={() => nextStep()}
                >
                  <p className="text-[#d4a574] font-medium">I don't have a routine yet</p>
                  <p className="text-xs text-[#d4a574]/80 mt-1">We'll help you build one from scratch</p>
                </button>
              </div>
            </div>
          )}

          {/* Step 8: Preferences */}
          {step === 8 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-[#d4a574]/20 to-[#f4c794]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-10 h-10 text-[#d4a574]" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Your Preferences</h3>
                <p className="text-gray-400">Let's personalize your recommendations</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Budget Range</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['budget', 'mid-range', 'luxury', 'no-limit'] as const).map((range) => (
                    <button
                      key={range}
                      className={`py-3 px-4 rounded-lg border-2 transition-all ${
                        profile.preferences?.budgetRange === range
                          ? 'border-[#d4a574] bg-[#d4a574]/10 text-[#d4a574]'
                          : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-[#d4a574] hover:bg-gray-700'
                      }`}
                      onClick={() => updateProfile({
                        preferences: {
                          ...profile.preferences,
                          budgetRange: range,
                          preferClean: profile.preferences?.preferClean || false,
                          preferKBeauty: profile.preferences?.preferKBeauty || false,
                          preferFragranceFree: profile.preferences?.preferFragranceFree || false,
                          preferCrueltyFree: profile.preferences?.preferCrueltyFree || false,
                          avoidIngredients: profile.preferences?.avoidIngredients || [],
                          texturePreferences: profile.preferences?.texturePreferences || []
                        }
                      })}
                    >
                      {range.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Product Preferences</label>
                <div className="space-y-2">
                  {[
                    { key: 'preferClean', label: 'Clean Beauty' },
                    { key: 'preferKBeauty', label: 'K-Beauty' },
                    { key: 'preferFragranceFree', label: 'Fragrance-Free' },
                    { key: 'preferCrueltyFree', label: 'Cruelty-Free' }
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-[#d4a574] border-gray-600 bg-gray-800 rounded focus:ring-[#d4a574]"
                        checked={profile.preferences?.[key as keyof typeof profile.preferences] as boolean || false}
                        onChange={(e) => updateProfile({
                          preferences: {
                            ...profile.preferences,
                            [key]: e.target.checked,
                            budgetRange: profile.preferences?.budgetRange || 'mid-range',
                            preferClean: profile.preferences?.preferClean || false,
                            preferKBeauty: profile.preferences?.preferKBeauty || false,
                            preferFragranceFree: profile.preferences?.preferFragranceFree || false,
                            preferCrueltyFree: profile.preferences?.preferCrueltyFree || false,
                            avoidIngredients: profile.preferences?.avoidIngredients || [],
                            texturePreferences: profile.preferences?.texturePreferences || [],
                            ...{ [key]: e.target.checked }
                          }
                        })}
                      />
                      <span className="text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Ingredients to Avoid
                </label>
                <textarea
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574]"
                  rows={2}
                  placeholder="List any ingredients you want to avoid"
                  value={profile.preferences?.avoidIngredients?.join(', ') || ''}
                  onChange={(e) => updateProfile({
                    preferences: {
                      ...profile.preferences,
                      budgetRange: profile.preferences?.budgetRange || 'mid-range',
                      preferClean: profile.preferences?.preferClean || false,
                      preferKBeauty: profile.preferences?.preferKBeauty || false,
                      preferFragranceFree: profile.preferences?.preferFragranceFree || false,
                      preferCrueltyFree: profile.preferences?.preferCrueltyFree || false,
                      avoidIngredients: e.target.value ? e.target.value.split(',').map(i => i.trim()).filter(i => i) : [],
                      texturePreferences: profile.preferences?.texturePreferences || []
                    }
                  })}
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            {step > 1 && (
              <button
                onClick={prevStep}
                className="flex items-center space-x-2 px-6 py-3 text-gray-400 hover:text-white transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={nextStep}
              className="ml-auto flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-[#d4a574] to-[#f4c794] text-black rounded-lg hover:from-[#c49660] hover:to-[#e4b680] transition-all transform hover:scale-105"
            >
              <span>{step === totalSteps ? 'Complete' : 'Next'}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bailey's Note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Designed with care by Bailey to understand your unique skin journey
        </p>
      </div>
    </div>
  )
}