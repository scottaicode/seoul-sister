import SkinAnalysisAI from '@/components/SkinAnalysisAI'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Skin Analysis - Seoul Sister',
  description: 'Get personalized K-beauty recommendations with our AI-powered skin analysis. Save 70% on your perfect Seoul beauty routine.',
}

export default function SkinAnalysisPage() {
  return <SkinAnalysisAI />
}