'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import SkinProfileManager from '@/components/SkinProfileManager'
import AuthHeader from '@/components/AuthHeader'
import { useAuth } from '@/contexts/AuthContext'

export default function SkinProfilePage() {
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    const loadUserPhone = async () => {
      if (user) {
        // Clear old global localStorage entry
        localStorage.removeItem('whatsapp_number')

        // Try to get phone from user profile first
        try {
          const response = await fetch('/api/user/profile')
          if (response.ok) {
            const profile = await response.json()
            if (profile.phone) {
              setWhatsappNumber(profile.phone)
              setLoading(false)
              return
            }
          }
        } catch (error) {
          console.log('Could not load user profile')
        }

        // Fallback to user-specific localStorage
        const userSpecificKey = `whatsapp_number_${user.id}`
        const storedNumber = localStorage.getItem(userSpecificKey) || ''
        setWhatsappNumber(storedNumber)
      }
      setLoading(false)
    }

    loadUserPhone()
  }, [user])

  const handlePhoneNumberChange = async (number: string) => {
    setWhatsappNumber(number)

    if (user) {
      // Store in user-specific localStorage
      const userSpecificKey = `whatsapp_number_${user.id}`
      localStorage.setItem(userSpecificKey, number)

      // Also try to update user profile
      try {
        await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phone: number }),
        })
      } catch (error) {
        console.log('Could not update user profile')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black">
      <AuthHeader />
      <div className="container mx-auto px-4 py-8 pt-24">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-luxury-gold hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:translate-x-[-2px] transition-transform" />
          <span className="text-sm tracking-wide">Back</span>
        </button>

        <div className="text-center mb-8">
          <p className="text-caption mb-4 text-luxury-gold tracking-widest">PERSONALIZED BEAUTY INTELLIGENCE</p>
          <h1 className="text-4xl md:text-5xl font-light text-white mb-4 tracking-wide">
            Your Skin Profile
          </h1>
          <div className="gold-line mx-auto mb-6"></div>
          <p className="text-lg font-light text-gray-300 max-w-2xl mx-auto mb-6">
            Create your detailed skin profile to unlock AI-powered Korean beauty recommendations
            tailored specifically for your unique skin needs and concerns.
          </p>

          <div className="flex justify-center items-center gap-4 mb-8">
            <label className="text-sm font-medium text-luxury-gold tracking-wide">WhatsApp Number:</label>
            <input
              type="text"
              value={whatsappNumber}
              onChange={(e) => handlePhoneNumberChange(e.target.value)}
              placeholder="+1234567890"
              className="px-4 py-2 bg-luxury-charcoal/50 border border-luxury-gold/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-luxury-gold/50 text-white placeholder-gray-400"
            />
          </div>
        </div>

        {whatsappNumber ? (
          <SkinProfileManager
            whatsappNumber={whatsappNumber}
            onProfileUpdate={(profile) => {
              console.log('Profile updated:', profile)
            }}
          />
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📱</div>
            <h3 className="text-lg font-semibold text-white mb-2 tracking-wide">
              Enter Your WhatsApp Number
            </h3>
            <p className="text-gray-300 font-light">
              We need your WhatsApp number to save and sync your skin profile
            </p>
          </div>
        )}
      </div>
    </div>
  )
}