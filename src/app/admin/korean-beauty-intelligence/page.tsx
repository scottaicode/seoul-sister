'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, BarChart3, Users, Globe, RefreshCw } from 'lucide-react';

interface PipelineStatus {
  success: boolean;
  pipeline_status: string;
  recent_discoveries: {
    products: any[];
    prices: any[];
    last_update: string;
  };
  errors: any;
}

interface TrendingIngredient {
  id: string;
  ingredient_name: string;
  trend_score: number;
  weekly_growth_percentage: number;
  data_source: string;
  last_updated: string;
}

interface SocialTrend {
  id: string;
  trend_name: string;
  platform: string;
  mention_count: number;
  growth_rate_percentage: number;
  hashtags: string[];
  last_updated: string;
}

export default function KoreanBeautyIntelligence() {
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [trendingIngredients, setTrendingIngredients] = useState<TrendingIngredient[]>([]);
  const [socialTrends, setSocialTrends] = useState<SocialTrend[]>([]);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [lastPipelineRun, setLastPipelineRun] = useState<string | null>(null);

  const fetchPipelineStatus = async () => {
    try {
      const response = await fetch('/api/data-pipeline/korean-beauty-discovery?source=status');
      const data = await response.json();
      setPipelineStatus(data);
    } catch (error) {
      console.error('Error fetching pipeline status:', error);
    }
  };

  const fetchTrendingData = async () => {
    try {
      // Fetch trending ingredients
      const ingredientsResponse = await fetch('/api/korean-trends/ingredients');
      if (ingredientsResponse.ok) {
        const ingredientsData = await ingredientsResponse.json();
        setTrendingIngredients(ingredientsData.ingredients || []);
      }

      // Fetch social trends
      const socialResponse = await fetch('/api/korean-trends/social');
      if (socialResponse.ok) {
        const socialData = await socialResponse.json();
        setSocialTrends(socialData.trends || []);
      }
    } catch (error) {
      console.error('Error fetching trending data:', error);
    }
  };

  const runDiscoveryPipeline = async () => {
    setIsRunningPipeline(true);
    try {
      const response = await fetch('/api/data-pipeline/korean-beauty-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'all', limit: 20 })
      });

      const result = await response.json();
      setLastPipelineRun(new Date().toISOString());

      // Refresh data after pipeline run
      await fetchPipelineStatus();
      await fetchTrendingData();

      console.log('Pipeline results:', result);
    } catch (error) {
      console.error('Error running discovery pipeline:', error);
    } finally {
      setIsRunningPipeline(false);
    }
  };

  useEffect(() => {
    fetchPipelineStatus();
    fetchTrendingData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchPipelineStatus();
      fetchTrendingData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const formatKoreanPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0
    }).format(price);
  };

  const formatUSPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 to-blue-500 bg-clip-text text-transparent">
              Korean Beauty Intelligence
            </h1>
            <p className="text-gray-400 mt-2">Live market analysis and trend discovery pipeline</p>
          </div>

          <button
            onClick={runDiscoveryPipeline}
            disabled={isRunningPipeline}
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-blue-600 px-6 py-3 rounded-lg font-semibold hover:from-red-700 hover:to-blue-700 transition-all disabled:opacity-50"
          >
            <RefreshCw size={20} className={isRunningPipeline ? 'animate-spin' : ''} />
            {isRunningPipeline ? 'Running Discovery...' : 'Run Discovery'}
          </button>
        </div>

        {/* Pipeline Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 size={24} className="text-green-500" />
              <h3 className="text-lg font-semibold">Pipeline Status</h3>
            </div>
            <p className="text-2xl font-bold text-green-400">
              {pipelineStatus?.pipeline_status === 'active' ? 'ACTIVE' : 'INACTIVE'}
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp size={24} className="text-blue-500" />
              <h3 className="text-lg font-semibold">Products Tracked</h3>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {pipelineStatus?.recent_discoveries.products.length || 0}
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Globe size={24} className="text-purple-500" />
              <h3 className="text-lg font-semibold">Price Points</h3>
            </div>
            <p className="text-2xl font-bold text-purple-400">
              {pipelineStatus?.recent_discoveries.prices.length || 0}
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users size={24} className="text-yellow-500" />
              <h3 className="text-lg font-semibold">Social Trends</h3>
            </div>
            <p className="text-2xl font-bold text-yellow-400">
              {socialTrends.length}
            </p>
          </div>
        </div>

        {/* Recent Price Discoveries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-green-500" />
              Recent Price Discoveries
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {pipelineStatus?.recent_discoveries.prices.slice(0, 10).map((price: any) => (
                <div key={price.id} className="border border-gray-600 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-sm">{price.retailer_product_name}</h4>
                    <span className={`text-xs px-2 py-1 rounded ${
                      price.in_stock ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                    }`}>
                      {price.in_stock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Current Price</p>
                      <p className="font-bold text-green-400">{formatUSPrice(price.current_price)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Total Cost</p>
                      <p className="font-bold">{formatUSPrice(price.total_cost)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Updated: {new Date(price.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Ingredients */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-red-500" />
              Trending Ingredients
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {trendingIngredients.slice(0, 8).map((ingredient) => (
                <div key={ingredient.id} className="border border-gray-600 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold">{ingredient.ingredient_name}</h4>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-400">
                        {ingredient.trend_score}/100
                      </div>
                      <div className="text-sm text-green-400">
                        +{ingredient.weekly_growth_percentage}% this week
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Source: {ingredient.data_source}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Social Media Trends */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users size={20} className="text-blue-500" />
            Korean Social Media Trends
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {socialTrends.map((trend) => (
              <div key={trend.id} className="border border-gray-600 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold">{trend.trend_name}</h4>
                  <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">
                    {trend.platform}
                  </span>
                </div>
                <div className="mb-3">
                  <p className="text-sm text-gray-400">Mentions</p>
                  <p className="text-lg font-bold text-blue-400">
                    {trend.mention_count.toLocaleString()}
                  </p>
                </div>
                <div className="mb-3">
                  <p className="text-sm text-gray-400">Growth Rate</p>
                  <p className="text-lg font-bold text-green-400">
                    +{trend.growth_rate_percentage}%
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {trend.hashtags.slice(0, 3).map((hashtag, index) => (
                    <span key={index} className="text-xs bg-gray-700 px-2 py-1 rounded">
                      {hashtag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-gray-500">
          <p>Live Korean beauty intelligence powered by Seoul Sister AI</p>
          {lastPipelineRun && (
            <p className="text-sm">Last pipeline run: {new Date(lastPipelineRun).toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}