'use client'

import { useState, useEffect } from 'react'
import SkinProfileManager from '@/components/SkinProfileManager'

export default function SkinProfilePage() {
  const [whatsappNumber, setWhatsappNumber] = useState('')

  useEffect(() => {
    const storedNumber = localStorage.getItem('whatsapp_number') || ''
    setWhatsappNumber(storedNumber)
  }, [])

  const handlePhoneNumberChange = (number: string) => {
    setWhatsappNumber(number)
    localStorage.setItem('whatsapp_number', number)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black">
      <div className="container mx-auto px-4 py-8">
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