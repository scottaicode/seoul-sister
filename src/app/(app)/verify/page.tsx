'use client'

import { useState } from 'react'
import {
  Shield,
  Hash,
  Store,
  Flag,
} from 'lucide-react'
import CounterfeitScanner from '@/components/counterfeit/CounterfeitScanner'
import BatchCodeChecker from '@/components/counterfeit/BatchCodeChecker'
import RetailerDirectory from '@/components/counterfeit/RetailerDirectory'
import CounterfeitReportForm from '@/components/counterfeit/CounterfeitReportForm'
import SafetyAlertsBanner from '@/components/counterfeit/SafetyAlertsBanner'

const TABS = [
  { id: 'scan', label: 'Verify', icon: Shield },
  { id: 'batch', label: 'Batch Code', icon: Hash },
  { id: 'retailers', label: 'Retailers', icon: Store },
  { id: 'report', label: 'Report', icon: Flag },
] as const

type TabId = typeof TABS[number]['id']

export default function VerifyPage() {
  const [activeTab, setActiveTab] = useState<TabId>('scan')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-bold text-2xl text-white section-heading">
          Authenticity Check
        </h1>
        <p className="text-white/40 text-sm">
          Verify your K-beauty products are genuine with AI-powered detection.
        </p>
      </div>

      {/* Safety alerts */}
      <SafetyAlertsBanner />

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 glass-card">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              activeTab === id
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === 'scan' && (
          <div className="space-y-4 animate-fade-in">
            <div className="glass-card p-3">
              <p className="text-xs text-white/50 leading-relaxed">
                <strong className="text-white/80">How it works:</strong> Photograph the product packaging, label, or batch code. Our AI analyzes fonts, print quality, regulatory markings, and known counterfeit indicators to assess authenticity.
              </p>
            </div>
            <CounterfeitScanner />
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="space-y-4 animate-fade-in">
            <div className="glass-card p-3">
              <p className="text-xs text-white/50 leading-relaxed">
                <strong className="text-white/80">Batch Code Decoder:</strong> Enter the batch code stamped on your product. We decode the manufacture date, expiry, and factory location to verify the code matches the brand&apos;s known format.
              </p>
            </div>
            <BatchCodeChecker />
          </div>
        )}

        {activeTab === 'retailers' && (
          <div className="space-y-4 animate-fade-in">
            <RetailerDirectory />
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-4 animate-fade-in">
            <CounterfeitReportForm />
          </div>
        )}
      </div>

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  )
}
