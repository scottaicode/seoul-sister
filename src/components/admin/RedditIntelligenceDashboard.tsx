'use client';

import { useState, useEffect } from 'react';

interface RedditTrend {
  id: string;
  trend_term: string;
  trend_type: string;
  mention_count: number;
  velocity_score: number;
  growth_rate: number;
  trend_status: string;
  ai_confidence: number;
  korean_origin: boolean;
  sample_posts: string[];
  subreddits: string[];
  last_seen: string;
}

interface RedditStats {
  total: number;
  by_type: { [key: string]: number };
  by_status: { [key: string]: number };
  timeframe: string;
  last_updated: string;
}

export default function RedditIntelligenceDashboard() {
  const [trends, setTrends] = useState<RedditTrend[]>([]);
  const [stats, setStats] = useState<RedditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState('7d');

  const fetchRedditTrends = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reddit-intelligence/trends?timeframe=${timeframe}&limit=50`);
      const data = await response.json();

      if (data.success) {
        setTrends(data.trends);
        setStats(data.statistics);
      }
    } catch (error) {
      console.error('Failed to fetch Reddit trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const runManualUpdate = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/reddit-intelligence/run-pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`
        }
      });

      if (response.ok) {
        await fetchRedditTrends();
      }
    } catch (error) {
      console.error('Failed to run manual update:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRedditTrends();
  }, [timeframe]);

  const getTrendStatusColor = (status: string) => {
    switch (status) {
      case 'trending': return 'bg-red-100 text-red-800 border border-red-200';
      case 'emerging': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'stable': return 'bg-green-100 text-green-800 border border-green-200';
      case 'declining': return 'bg-gray-100 text-gray-600 border border-gray-200';
      default: return 'bg-blue-100 text-blue-800 border border-blue-200';
    }
  };

  const getTrendTypeIcon = (type: string) => {
    switch (type) {
      case 'brand': return '🏪';
      case 'ingredient': return '🧪';
      case 'product': return '🧴';
      case 'technique': return '✨';
      default: return '💡';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
        <div className="h-96 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reddit K-Beauty Intelligence</h2>
          <p className="text-gray-600">Live trends from Korean beauty communities</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runManualUpdate}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Active Trends</span>
              <span className="text-gray-400">📈</span>
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-500">{timeframe} timeframe</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Trending Status</span>
              <span className="text-gray-400">⚡</span>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {stats.by_status.trending || 0}
            </div>
            <p className="text-xs text-gray-500">Hot trends right now</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Korean Origin</span>
              <span className="text-lg">🇰🇷</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {trends.filter(t => t.korean_origin).length}
            </div>
            <p className="text-xs text-gray-500">Verified K-beauty terms</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">AI Confidence</span>
              <span className="text-gray-400">👁</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {trends.length > 0 ? Math.round((trends.reduce((acc, t) => acc + t.ai_confidence, 0) / trends.length) * 100) : 0}%
            </div>
            <p className="text-xs text-gray-500">Average accuracy</p>
          </div>
        </div>
      )}

      {/* Timeframe Selector */}
      <div className="flex gap-2">
        {['24h', '7d', '30d', '90d'].map((period) => (
          <button
            key={period}
            onClick={() => setTimeframe(period)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              timeframe === period
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {period}
          </button>
        ))}
      </div>

      {/* Trends List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Live Reddit Trends</h3>
        </div>
        <div className="p-4">
          <div className="space-y-4">
            {trends.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-4">💬</div>
                <p>No trends found for the selected timeframe</p>
                <p className="text-sm">Try running a manual refresh or check a different timeframe</p>
              </div>
            ) : (
              trends.map((trend) => (
                <div
                  key={trend.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">
                      {getTrendTypeIcon(trend.trend_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold capitalize">
                          {trend.trend_term}
                        </h3>
                        {trend.korean_origin && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            🇰🇷 Korean
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          {trend.trend_type}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${getTrendStatusColor(trend.trend_status)}`}>
                          {trend.trend_status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {trend.mention_count} mentions
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-green-600">
                        ↗ {trend.velocity_score}
                      </div>
                      <div className="text-xs text-gray-500">
                        {Math.round(trend.ai_confidence * 100)}% conf
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      r/{trend.subreddits[0]} {trend.subreddits.length > 1 && `+${trend.subreddits.length - 1}`}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}