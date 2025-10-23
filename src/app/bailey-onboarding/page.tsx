'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BaileyOnboarding from '@/components/BaileyOnboarding'
import { BaileyUserProfile } from '@/types/bailey-profile'

export default function BaileyOnboardingPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleProfileComplete = async (profile: Partial<BaileyUserProfile>) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/bailey-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      })

      const data = await response.json()

      if (data.success) {
        // Store user identifier for future use
        if (typeof window !== 'undefined') {
          localStorage.setItem('baileyUserId', data.profile.whatsapp_number)
          localStorage.setItem('baileyProfileComplete', 'true')
        }

        // Redirect to personalized dashboard with Bailey's recommendations
        router.push('/bailey-dashboard')
      } else {
        console.error('Failed to save profile:', data.error)
        alert('There was an error saving your profile. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting profile:', error)
      alert('There was an error connecting to the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Creating Your Personalized Profile</h2>
          <p className="text-gray-600">Bailey's AI is analyzing your unique skin needs...</p>
        </div>
      </div>
    )
  }

  return <BaileyOnboarding onComplete={handleProfileComplete} />
}