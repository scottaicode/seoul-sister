'use client'

import { useAuth } from '@/contexts/AuthContext'
import AuthHeader from '@/components/AuthHeader'
import SkinAnalysisUpload from '@/components/SkinAnalysisUpload'
import { Brain, TrendingUp, Star } from 'lucide-react'

export default function SkinAnalysisPage() {
  const { user } = useAuth()

  return (
    <main className="min-h-screen bg-black text-white">
      <AuthHeader />

      {/* Hero Section */}
      <section className="pt-24 pb-12 border-b border-[#d4a574]/20">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-[#d4a574]/10 text-[#d4a574] px-4 py-2 rounded-full text-sm mb-6">
            <Star className="w-4 h-4" />
            Professional-Grade Analysis • $200+ Value
          </div>
          <h1 className="text-4xl md:text-5xl font-light mb-4">
            AI-Powered Skin Analysis
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Get a comprehensive skin assessment with personalized K-beauty recommendations,
            ingredient compatibility analysis, and a custom routine designed just for you.
          </p>
        </div>
      </section>

      {/* Analysis Component */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-8">
          <SkinAnalysisUpload userId={user?.id} />
        </div>
      </section>

      {/* Features */}
      <section className="py-12 border-t border-[#d4a574]/20">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-2xl font-light text-center mb-8 text-[#d4a574]">
            What You'll Discover
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <FeatureCard
              icon={<Brain className="w-6 h-6" />}
              title="Skin Type Analysis"
              description="Precise identification of your skin type with hydration and texture scores"
            />
            <FeatureCard
              icon={<TrendingUp className="w-6 h-6" />}
              title="Progress Tracking"
              description="Monitor improvements over time with visual timeline and AI insights"
            />
            <FeatureCard
              icon={<Star className="w-6 h-6" />}
              title="Custom Routine"
              description="Personalized morning and evening routines based on your unique needs"
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
      <div className="w-12 h-12 bg-[#d4a574]/10 border border-[#d4a574]/30 rounded-lg flex items-center justify-center mb-4 text-[#d4a574]">
        {icon}
      </div>
      <h3 className="text-lg font-light mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  )
}