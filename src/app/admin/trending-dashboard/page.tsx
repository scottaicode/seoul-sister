'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, BarChart3, Activity, Calendar, Sparkles, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

interface TrendingProduct {
  name: string;
  score: number;
  growth_rate: number;
  mentions: number;
  sentiment: number;
  reason: string;
}

interface TrendingIngredient {
  name: string;
  score: number;
  growth_rate: number;
  mentions: number;
  benefits: string[];
  sentiment: number;
}

interface EmergingTrend {
  name: string;
  score: number;
  description: string;
  growth_rate: number;
  regions: string[];
}

interface ViralContent {
  platform: string;
  content_type: string;
  views: string;
  engagement_rate: string;
  viral_factor: string;
}

interface TrendingAnalysis {
  top_trending_products: TrendingProduct[];
  top_trending_ingredients: TrendingIngredient[];
  emerging_trends: EmergingTrend[];
  viral_social_content: ViralContent[];
  ai_insights: string;
  confidence_score: number;
}

interface AggregatedData {
  summary: {
    total_reports_analyzed: number;
    average_engagement: number;
    trending_score_average: number;
    market_sentiment: string;
  };
  top_products_across_period: any[];
  ingredient_momentum: any[];
  platform_analysis: any;
}

export default function TrendingDashboard() {
  const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null);
  const [specificAnalysis, setSpecificAnalysis] = useState<TrendingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  useEffect(() => {
    loadTrendingData();
  }, [selectedPeriod]);

  const loadTrendingData = async () => {
    try {
      setLoading(true);

      // Load aggregated trending data
      const aggregatedResponse = await fetch(`/api/reports/trending-simple?days=${selectedPeriod}`);
      const aggregatedResult = await aggregatedResponse.json();

      if (aggregatedResult.trending_data) {
        setAggregatedData(aggregatedResult.trending_data);
      }

      // Load latest report for specific analysis
      const archiveResponse = await fetch('/api/reports/archive?limit=1');
      const archiveResult = await archiveResponse.json();

      if (archiveResult.reports && archiveResult.reports.length > 0) {
        const latestReport = archiveResult.reports[0];
        const specificResponse = await fetch(`/api/reports/trending-simple?reportId=${latestReport.id}`);
        const specificResult = await specificResponse.json();

        if (specificResult.analysis) {
          setSpecificAnalysis(specificResult.analysis);
          setSelectedReport(latestReport.id);
        }
      }

    } catch (error) {
      console.error('Error loading trending data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-yellow-400';
    if (score >= 70) return 'text-orange-400';
    return 'text-red-400';
  };

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment >= 0.8) return '😊';
    if (sentiment >= 0.6) return '🙂';
    if (sentiment >= 0.4) return '😐';
    return '😕';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-[#D4A574] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#D4A574] text-sm uppercase tracking-wider">Loading Trending Analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-light text-white mb-2 tracking-wide">
              📊 Trending Analysis Dashboard
            </h1>
            <p className="text-gray-400">
              Real-time insights into Korean beauty trends and market dynamics
            </p>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
              className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg px-4 py-2 text-white"
            >
              <option value={1}>Last 24 Hours</option>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {aggregatedData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="text-[#D4A574]" size={24} />
              <span className="text-xs text-gray-400 uppercase tracking-wider">Reports</span>
            </div>
            <div className="text-2xl font-light text-white">
              {aggregatedData.summary.total_reports_analyzed}
            </div>
            <div className="text-sm text-gray-400">Reports Analyzed</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <Activity className="text-[#D4A574]" size={24} />
              <span className="text-xs text-gray-400 uppercase tracking-wider">Engagement</span>
            </div>
            <div className="text-2xl font-light text-white">
              {aggregatedData.summary.average_engagement.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Avg Views</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="text-[#D4A574]" size={24} />
              <span className="text-xs text-gray-400 uppercase tracking-wider">Score</span>
            </div>
            <div className="text-2xl font-light text-white">
              {aggregatedData.summary.trending_score_average}
            </div>
            <div className="text-sm text-gray-400">Trending Score</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <Target className="text-[#D4A574]" size={24} />
              <span className="text-xs text-gray-400 uppercase tracking-wider">Sentiment</span>
            </div>
            <div className="text-2xl font-light text-white capitalize">
              {aggregatedData.summary.market_sentiment}
            </div>
            <div className="text-sm text-gray-400">Market Mood</div>
          </motion.div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Trending Products */}
        {specificAnalysis && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="text-[#D4A574]" size={20} />
              <h2 className="text-xl font-light">Top Trending Products</h2>
            </div>

            <div className="space-y-4">
              {specificAnalysis.top_trending_products.map((product, index) => (
                <div key={index} className="border border-[#D4A574]/10 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-white">{product.name}</h3>
                    <div className={`text-lg font-light ${getScoreColor(product.score)}`}>
                      {product.score}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                    <div>
                      <span className="text-gray-400">Growth:</span>
                      <span className="text-green-400 ml-1">+{product.growth_rate}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Mentions:</span>
                      <span className="text-white ml-1">{product.mentions.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Sentiment:</span>
                      <span className="ml-1">{getSentimentIcon(product.sentiment)}</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-400">{product.reason}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Top Trending Ingredients */}
        {specificAnalysis && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[#D4A574] text-lg">🧪</span>
              <h2 className="text-xl font-light">Top Trending Ingredients</h2>
            </div>

            <div className="space-y-4">
              {specificAnalysis.top_trending_ingredients.map((ingredient, index) => (
                <div key={index} className="border border-[#D4A574]/10 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-white">{ingredient.name}</h3>
                    <div className={`text-lg font-light ${getScoreColor(ingredient.score)}`}>
                      {ingredient.score}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                      <span className="text-gray-400">Growth:</span>
                      <span className="text-green-400 ml-1">+{ingredient.growth_rate}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Mentions:</span>
                      <span className="text-white ml-1">{ingredient.mentions.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {ingredient.benefits.map((benefit, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-[#D4A574]/10 text-[#D4A574] text-xs rounded"
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Emerging Trends */}
        {specificAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[#D4A574] text-lg">🔮</span>
              <h2 className="text-xl font-light">Emerging Trends</h2>
            </div>

            <div className="space-y-4">
              {specificAnalysis.emerging_trends.map((trend, index) => (
                <div key={index} className="border border-[#D4A574]/10 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-white">{trend.name}</h3>
                    <div className={`text-lg font-light ${getScoreColor(trend.score)}`}>
                      {trend.score}
                    </div>
                  </div>

                  <p className="text-sm text-gray-400 mb-3">{trend.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-gray-400">Growth:</span>
                      <span className="text-green-400 ml-1">+{trend.growth_rate}%</span>
                    </div>
                    <div className="flex gap-1">
                      {trend.regions.slice(0, 3).map((region, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-[#D4A574]/10 text-[#D4A574] text-xs rounded"
                        >
                          {region}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Viral Social Content */}
        {specificAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[#D4A574] text-lg">📱</span>
              <h2 className="text-xl font-light">Viral Social Content</h2>
            </div>

            <div className="space-y-4">
              {specificAnalysis.viral_social_content.map((content, index) => (
                <div key={index} className="border border-[#D4A574]/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#D4A574]">{content.platform}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-white">{content.content_type}</span>
                    </div>
                    <span className="text-sm text-gray-400">{content.views}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-gray-400">Engagement:</span>
                      <span className="text-green-400 ml-1">{content.engagement_rate}</span>
                    </div>
                    <span className="text-xs text-gray-500">{content.viral_factor}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* AI Insights */}
      {specificAnalysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#D4A574] text-lg">🤖</span>
            <h2 className="text-xl font-light">AI Insights</h2>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-gray-400">Confidence:</span>
              <span className="text-[#D4A574] font-medium">
                {Math.round(specificAnalysis.confidence_score * 100)}%
              </span>
            </div>
          </div>

          <p className="text-gray-300 leading-relaxed">
            {specificAnalysis.ai_insights}
          </p>
        </motion.div>
      )}
    </div>
  );
}