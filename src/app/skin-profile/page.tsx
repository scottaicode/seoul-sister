import SkinProfileManager from '@/components/SkinProfileManager'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Your Skin Profile - Seoul Sister',
  description: 'Create and manage your personalized skin profile for AI-powered Korean beauty recommendations. Get products perfectly matched to your skin needs.',
}

export default function SkinProfilePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Your Personalized Skin Profile
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Create your detailed skin profile to unlock AI-powered Korean beauty recommendations
            tailored specifically for your unique skin needs and concerns.
          </p>
        </div>

        <SkinProfileManager
          whatsappNumber="+1234567890"
          onProfileUpdate={(profile) => {
            console.log('Profile updated:', profile)
            // You can add additional logic here like showing success messages
          }}
        />
      </div>
    </div>
  )
}