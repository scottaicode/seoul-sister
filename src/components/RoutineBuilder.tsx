'use client'

import { useState, useEffect } from 'react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { SkinConcernMatcher } from '@/lib/skin-concern-matcher'
import type { Product } from '@/hooks/useProducts'

interface RoutineStep {
  id: string
  step_order: number
  product_id?: string
  custom_product_name?: string
  product_category: string
  application_method: string
  amount_description: string
  wait_time_seconds: number
  frequency: string
  instructions: string
  tips?: string
  warnings?: string
}

interface SkincareRoutine {
  id?: string
  name: string
  description: string
  routine_type: 'morning' | 'evening' | 'weekly' | 'custom'
  complexity_level: 'minimal' | 'moderate' | 'extensive'
  estimated_time_minutes: number
  primary_goals: string[]
  steps: RoutineStep[]
}

interface RoutineBuilderProps {
  userEmail?: string
  products: Product[]
}

export default function RoutineBuilder({ userEmail, products }: RoutineBuilderProps) {
  const { profile } = useUserProfile(userEmail)
  const [currentRoutine, setCurrentRoutine] = useState<SkincareRoutine>({
    name: 'My Custom Routine',
    description: '',
    routine_type: 'morning',
    complexity_level: 'moderate',
    estimated_time_minutes: 10,
    primary_goals: [],
    steps: []
  })
  const [savedRoutines, setSavedRoutines] = useState<SkincareRoutine[]>([])
  const [activeTab, setActiveTab] = useState<'builder' | 'tracker' | 'saved'>('builder')
  const [loading, setLoading] = useState(false)
  const [showAIBuilder, setShowAIBuilder] = useState(false)

  // Fetch user's saved routines
  useEffect(() => {
    if (profile?.id) {
      fetchSavedRoutines()
    }
  }, [profile?.id])

  const fetchSavedRoutines = async () => {
    if (!profile?.id) return

    try {
      const response = await fetch(`/api/skincare-routines?user_id=${profile.id}`)
      const data = await response.json()
      setSavedRoutines(data.routines || [])
    } catch (error) {
      console.error('Error fetching routines:', error)
    }
  }

  // Generate AI-powered routine
  const generateAIRoutine = async () => {
    if (!profile) return

    setLoading(true)
    try {
      const response = await fetch('/api/ai-routine-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_profile: profile,
          routine_type: currentRoutine.routine_type,
          complexity_level: currentRoutine.complexity_level,
          available_products: products
        })
      })

      const data = await response.json()
      setCurrentRoutine(data.routine)
      setShowAIBuilder(false)
    } catch (error) {
      console.error('Error generating AI routine:', error)
      alert('Failed to generate routine. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Add manual step
  const addManualStep = () => {
    const newStep: RoutineStep = {
      id: `step_${Date.now()}`,
      step_order: currentRoutine.steps.length + 1,
      product_category: 'cleanser',
      application_method: 'Gently massage onto skin',
      amount_description: 'Small amount',
      wait_time_seconds: 0,
      frequency: 'daily',
      instructions: 'Apply evenly to face'
    }

    setCurrentRoutine(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }))
  }

  // Update step
  const updateStep = (stepId: string, updates: Partial<RoutineStep>) => {
    setCurrentRoutine(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      )
    }))
  }

  // Remove step
  const removeStep = (stepId: string) => {
    setCurrentRoutine(prev => ({
      ...prev,
      steps: prev.steps
        .filter(step => step.id !== stepId)
        .map((step, index) => ({ ...step, step_order: index + 1 }))
    }))
  }

  // Save routine
  const saveRoutine = async () => {
    if (!profile?.id) return

    setLoading(true)
    try {
      const response = await fetch('/api/skincare-routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profile.id,
          routine: currentRoutine
        })
      })

      if (response.ok) {
        alert('Routine saved successfully!')
        fetchSavedRoutines()
      } else {
        throw new Error('Failed to save routine')
      }
    } catch (error) {
      console.error('Error saving routine:', error)
      alert('Failed to save routine. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Load routine for editing
  const loadRoutine = (routine: SkincareRoutine) => {
    setCurrentRoutine(routine)
    setActiveTab('builder')
  }

  // Calculate estimated time
  const calculateEstimatedTime = () => {
    const baseTime = currentRoutine.steps.length * 2 // 2 minutes per step base
    const waitTime = currentRoutine.steps.reduce((total, step) => total + (step.wait_time_seconds / 60), 0)
    return Math.ceil(baseTime + waitTime)
  }

  // Get routine suggestions based on user profile
  const getRoutineSuggestions = () => {
    if (!profile?.skin_concerns?.length) return { morning: [], evening: [], tips: [] }

    return SkinConcernMatcher.getRoutineSuggestions(
      profile.skin_concerns,
      profile
    )
  }

  const suggestions = getRoutineSuggestions()

  const stepCategories = [
    'cleanser', 'toner', 'essence', 'serum', 'moisturizer', 'sunscreen',
    'exfoliator', 'mask', 'oil', 'eye_cream', 'spot_treatment'
  ]

  const frequencies = ['daily', 'alternate', 'weekly', '2-3x per week', 'as needed']

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🧴 Smart Routine Builder
        </h1>
        <p className="text-gray-600">
          Create and track personalized Korean skincare routines powered by AI
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-4 mb-8">
        {[
          { id: 'builder', label: '🔨 Builder', desc: 'Create custom routines' },
          { id: 'tracker', label: '📊 Tracker', desc: 'Track daily progress' },
          { id: 'saved', label: '💾 Saved', desc: 'Manage saved routines' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-48 p-4 rounded-xl border transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent shadow-lg'
                : 'bg-white text-gray-700 border-gray-200 hover:border-pink-300 hover:shadow-md'
            }`}
          >
            <div className="text-lg font-medium mb-1">{tab.label}</div>
            <div className={`text-sm ${activeTab === tab.id ? 'text-pink-100' : 'text-gray-500'}`}>
              {tab.desc}
            </div>
          </button>
        ))}
      </div>

      {/* Builder Tab */}
      {activeTab === 'builder' && (
        <div className="space-y-8">
          {/* Routine Configuration */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">Routine Configuration</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Routine Name</label>
                <input
                  type="text"
                  value={currentRoutine.name}
                  onChange={(e) => setCurrentRoutine(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Routine Type</label>
                <select
                  value={currentRoutine.routine_type}
                  onChange={(e) => setCurrentRoutine(prev => ({ ...prev, routine_type: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="morning">Morning Routine</option>
                  <option value="evening">Evening Routine</option>
                  <option value="weekly">Weekly Treatment</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Complexity Level</label>
                <select
                  value={currentRoutine.complexity_level}
                  onChange={(e) => setCurrentRoutine(prev => ({ ...prev, complexity_level: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="minimal">Minimal (3-5 steps)</option>
                  <option value="moderate">Moderate (6-8 steps)</option>
                  <option value="extensive">Extensive (9+ steps)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Time: {calculateEstimatedTime()} minutes
                </label>
                <div className="text-sm text-gray-500">
                  Based on {currentRoutine.steps.length} steps
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={currentRoutine.description}
                onChange={(e) => setCurrentRoutine(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                rows={3}
                placeholder="Describe your routine goals and any special notes..."
              />
            </div>

            {/* AI Builder Button */}
            <div className="flex gap-4">
              <button
                onClick={() => setShowAIBuilder(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all"
                disabled={loading}
              >
                {loading ? 'Generating...' : '🤖 AI Generate Routine'}
              </button>
              <button
                onClick={addManualStep}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                ➕ Add Manual Step
              </button>
            </div>
          </div>

          {/* AI Builder Modal */}
          {showAIBuilder && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-8 max-w-md w-full m-4">
                <h3 className="text-xl font-bold text-gray-800 mb-4">🤖 AI Routine Generator</h3>
                <p className="text-gray-600 mb-6">
                  Our AI will create a personalized routine based on your skin profile, concerns, and preferences.
                </p>

                {profile && (
                  <div className="bg-blue-50 p-4 rounded-lg mb-6">
                    <h4 className="font-medium text-blue-800 mb-2">Your Profile:</h4>
                    <div className="text-sm text-blue-700 space-y-1">
                      <div>Skin Type: {profile.skin_type || 'Not specified'}</div>
                      <div>Concerns: {profile.skin_concerns?.join(', ') || 'None specified'}</div>
                      <div>Experience: {profile.skincare_experience || 'Not specified'}</div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={generateAIRoutine}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {loading ? 'Generating...' : 'Generate Routine'}
                  </button>
                  <button
                    onClick={() => setShowAIBuilder(false)}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Routine Steps */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">Routine Steps</h3>

            {currentRoutine.steps.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">🧴</div>
                <p>No steps added yet. Use AI Generator or add manual steps to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentRoutine.steps.map((step, index) => (
                  <div key={step.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-800">Step {step.step_order}</h4>
                      <button
                        onClick={() => removeStep(step.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Product Category</label>
                        <select
                          value={step.product_category}
                          onChange={(e) => updateStep(step.id, { product_category: e.target.value })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-pink-500"
                        >
                          {stepCategories.map(category => (
                            <option key={category} value={category}>
                              {category.replace('_', ' ').toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Amount</label>
                        <input
                          type="text"
                          value={step.amount_description}
                          onChange={(e) => updateStep(step.id, { amount_description: e.target.value })}
                          placeholder="e.g., 2-3 drops"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-pink-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Frequency</label>
                        <select
                          value={step.frequency}
                          onChange={(e) => updateStep(step.id, { frequency: e.target.value })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-pink-500"
                        >
                          {frequencies.map(freq => (
                            <option key={freq} value={freq}>{freq}</option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="block text-xs text-gray-500 mb-1">Instructions</label>
                        <textarea
                          value={step.instructions}
                          onChange={(e) => updateStep(step.id, { instructions: e.target.value })}
                          placeholder="How to apply this product..."
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-pink-500"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save Routine */}
          {currentRoutine.steps.length > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Ready to Save?</h3>
                  <p className="text-gray-600">
                    Your routine has {currentRoutine.steps.length} steps and takes about {calculateEstimatedTime()} minutes
                  </p>
                </div>
                <button
                  onClick={saveRoutine}
                  disabled={loading || !profile}
                  className="bg-gradient-to-r from-green-500 to-blue-600 text-white px-8 py-3 rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Routine'}
                </button>
              </div>
            </div>
          )}

          {/* Smart Suggestions */}
          {suggestions.tips.length > 0 && (
            <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">💡 Smart Suggestions</h3>
              <div className="space-y-2">
                {suggestions.tips.map((tip, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span className="text-gray-700 text-sm">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tracker Tab */}
      {activeTab === 'tracker' && (
        <div>
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-4">📊</div>
            <p>Routine tracking coming soon! Save a routine first to start tracking your progress.</p>
          </div>
        </div>
      )}

      {/* Saved Routines Tab */}
      {activeTab === 'saved' && (
        <div>
          {savedRoutines.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">💾</div>
              <p>No saved routines yet. Create your first routine to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {savedRoutines.map(routine => (
                <div key={routine.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">{routine.name}</h3>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {routine.routine_type}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-4">{routine.description}</p>

                  <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                    <span>{routine.steps?.length || 0} steps</span>
                    <span>{routine.estimated_time_minutes} minutes</span>
                    <span className="capitalize">{routine.complexity_level}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => loadRoutine(routine)}
                      className="flex-1 bg-pink-500 text-white py-2 px-4 rounded-lg hover:bg-pink-600 transition-colors"
                    >
                      Edit
                    </button>
                    <button className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                      Start Tracking
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}