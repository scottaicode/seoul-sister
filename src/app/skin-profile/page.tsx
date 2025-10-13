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
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Your Personalized Skin Profile
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
            Create your detailed skin profile to unlock AI-powered Korean beauty recommendations
            tailored specifically for your unique skin needs and concerns.
          </p>

          <div className="flex justify-center items-center gap-4 mb-8">
            <label className="text-sm font-medium text-gray-700">WhatsApp Number:</label>
            <input
              type="text"
              value={whatsappNumber}
              onChange={(e) => handlePhoneNumberChange(e.target.value)}
              placeholder="+1234567890"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
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
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Enter Your WhatsApp Number
            </h3>
            <p className="text-gray-600">
              We need your WhatsApp number to save and sync your skin profile
            </p>
          </div>
        )}
      </div>
    </div>
  )
}