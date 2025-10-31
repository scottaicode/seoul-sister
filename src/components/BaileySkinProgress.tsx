'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Camera,
  ChevronRight,
  Star,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'

interface ProgressData {
  date: string
  hydration: number
  clarity: number
  texture: number
  overall: number
}

interface SkinProgressProps {
  userId?: string
  onPhotoUpload?: (file: File) => void
}

export default function BaileySkinProgress({ userId, onPhotoUpload }: SkinProgressProps) {
  const [progressData, setProgressData] = useState<ProgressData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState<'overall' | 'hydration' | 'clarity' | 'texture'>('overall')
  const [timeRange, setTimeRange] = useState<'1w' | '1m' | '3m' | 'all'>('1m')
  const [improvements, setImprovements] = useState<string[]>([])
  const [concerns, setConcerns] = useState<string[]>([])
  const [baileyInsight, setBaileyInsight] = useState('')

  useEffect(() => {
    fetchProgressData()
  }, [userId, timeRange])

  const fetchProgressData = async () => {
    setLoading(true)
    try {
      // In production, fetch from API
      // For demo, use mock data
      const mockData = generateMockProgressData(timeRange)
      setProgressData(mockData)
      setImprovements([
        'Hydration levels improved by 15%',
        'Pore size reduced visibly',
        'Dark spots fading (20% reduction)',
        'Texture significantly smoother'
      ])
      setConcerns([
        'Minor breakout on chin area',
        'Seasonal dryness developing'
      ])
      setBaileyInsight(
        "Amazing progress this month! Your skin clarity has improved by 22% since we started. " +
        "The combination of niacinamide and vitamin C is really working for your dark spots. " +
        "I'm noticing some seasonal dryness - let's add a hydrating essence to your routine."
      )
    } catch (error) {
      console.error('Failed to fetch progress data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateMockProgressData = (range: string): ProgressData[] => {
    const dataPoints = range === '1w' ? 7 : range === '1m' ? 30 : range === '3m' ? 90 : 180
    const data: ProgressData[] = []
    const today = new Date()

    for (let i = dataPoints - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)

      // Simulate gradual improvement with some variance
      const baseImprovement = (dataPoints - i) / dataPoints * 20
      const variance = Math.random() * 5 - 2.5

      data.push({
        date: date.toISOString().split('T')[0],
        hydration: Math.min(95, 60 + baseImprovement + variance),
        clarity: Math.min(95, 65 + baseImprovement * 1.2 + variance),
        texture: Math.min(95, 62 + baseImprovement * 0.9 + variance),
        overall: Math.min(95, 63 + baseImprovement + variance)
      })
    }

    return data
  }

  const calculateTrend = () => {
    if (progressData.length < 2) return { trend: 'stable', change: 0 }

    const recent = progressData[progressData.length - 1]
    const previous = progressData[Math.max(0, progressData.length - 8)]
    const change = recent[selectedMetric] - previous[selectedMetric]

    return {
      trend: change > 2 ? 'improving' : change < -2 ? 'declining' : 'stable',
      change: Math.round(change)
    }
  }

  const { trend, change } = calculateTrend()
  const latestScores = progressData[progressData.length - 1] || {
    hydration: 0,
    clarity: 0,
    texture: 0,
    overall: 0
  }

  if (loading) {
    return (
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-800 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Bailey Insight */}
      <div className="bg-gradient-to-r from-[#d4a574]/10 to-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[#d4a574]/20 rounded-full flex items-center justify-center">
            <Star className="w-6 h-6 text-[#d4a574]" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-light text-[#d4a574] mb-2">Bailey's Progress Insight</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{baileyInsight}</p>
          </div>
        </div>
      </div>

      {/* Current Scores */}
      <div className="grid grid-cols-4 gap-4">
        {(['overall', 'hydration', 'clarity', 'texture'] as const).map(metric => (
          <button
            key={metric}
            onClick={() => setSelectedMetric(metric)}
            className={`bg-black/40 border rounded-lg p-4 transition-all ${
              selectedMetric === metric
                ? 'border-[#d4a574] bg-[#d4a574]/10'
                : 'border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="text-xs text-gray-400 mb-1 capitalize">{metric}</div>
            <div className="text-2xl font-light text-white">
              {Math.round(latestScores[metric])}
            </div>
            <div className="text-xs text-[#d4a574] mt-1">/ 100</div>
          </button>
        ))}
      </div>

      {/* Progress Chart */}
      <div className="bg-black/40 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-light text-white">Progress Timeline</h3>
          <div className="flex items-center gap-2">
            {(['1w', '1m', '3m', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  timeRange === range
                    ? 'bg-[#d4a574] text-black'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {range === '1w' ? '1 Week' : range === '1m' ? '1 Month' : range === '3m' ? '3 Months' : 'All Time'}
              </button>
            ))}
          </div>
        </div>

        {/* Simple Chart Visualization */}
        <div className="relative h-48 border-l border-b border-gray-800">
          <div className="absolute inset-0 flex items-end justify-around p-4">
            {progressData.slice(-10).map((point, index) => (
              <div
                key={index}
                className="w-full mx-1"
                style={{ maxWidth: '20px' }}
              >
                <div
                  className="bg-gradient-to-t from-[#d4a574] to-[#d4a574]/40 rounded-t"
                  style={{
                    height: `${(point[selectedMetric] / 100) * 160}px`,
                    transition: 'height 0.3s ease'
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Trend Indicator */}
        <div className="flex items-center justify-center mt-4 gap-2">
          {trend === 'improving' ? (
            <>
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-green-500 text-sm">+{change}% improvement</span>
            </>
          ) : trend === 'declining' ? (
            <>
              <TrendingDown className="w-5 h-5 text-red-500" />
              <span className="text-red-500 text-sm">{change}% decline</span>
            </>
          ) : (
            <>
              <Minus className="w-5 h-5 text-gray-500" />
              <span className="text-gray-500 text-sm">Stable</span>
            </>
          )}
        </div>
      </div>

      {/* Improvements & Concerns */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-green-900/10 border border-green-700/30 rounded-lg p-4">
          <h3 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Recent Improvements
          </h3>
          <ul className="space-y-2">
            {improvements.map((improvement, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <ChevronRight className="w-3 h-3 text-green-500 mt-1" />
                {improvement}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-yellow-900/10 border border-yellow-700/30 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Areas to Monitor
          </h3>
          <ul className="space-y-2">
            {concerns.map((concern, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <ChevronRight className="w-3 h-3 text-yellow-500 mt-1" />
                {concern}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Photo Upload CTA */}
      <div className="bg-[#d4a574]/10 border border-[#d4a574]/30 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-light text-[#d4a574] mb-1">
              Time for Your Weekly Check-in!
            </h3>
            <p className="text-sm text-gray-400">
              Upload a photo to track your progress and get updated recommendations
            </p>
          </div>
          <label className="cursor-pointer">
            <div className="bg-[#d4a574] text-black px-6 py-3 rounded-lg font-light hover:bg-[#d4a574]/90 transition-colors flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Take Photo
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file && onPhotoUpload) {
                  onPhotoUpload(file)
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-900/10 border border-blue-700/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Progress Tips
        </h3>
        <ul className="space-y-1 text-xs text-gray-400">
          <li>• Take photos at the same time of day for consistency</li>
          <li>• Use natural lighting when possible</li>
          <li>• Track your routine changes in the app</li>
          <li>• Be patient - real changes take 4-6 weeks</li>
        </ul>
      </div>
    </div>
  )
}