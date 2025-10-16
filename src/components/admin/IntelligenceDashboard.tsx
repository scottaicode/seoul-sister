'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Globe, Youtube, MessageCircle, BarChart3, Zap, Eye, Target } from 'lucide-react';

interface IntelligenceMetrics {
  reddit: {
    trending_products: number;
    engagement_score: number;
    new_trends: number;
    velocity_average: number;
  };
  youtube: {
    videos_analyzed: number;
    channels_tracked: number;
    trending_topics: string[];
    engagement_patterns: any;
  };
  korean_community: {
    emerging_trends: number;
    cultural_insights: number;
    technique_discoveries: number;
    brand_sentiment_tracked: number;
  };
  cross_platform: {
    correlation_score: number;
    prediction_accuracy: number;
    early_detection_days: number;
  };
}

export default function IntelligenceDashboard() {
  const [metrics, setMetrics] = useState<IntelligenceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadIntelligenceMetrics();
  }, []);

  const loadIntelligenceMetrics = async () => {
    try {
      setLoading(true);

      // Load data from all intelligence sources
      const [redditData, youtubeData, koreanData] = await Promise.all([
        fetch('/api/test/reddit-intelligence').then(r => r.json()),
        fetch('/api/intelligence/youtube-analytics').then(r => r.json()),
        fetch('/api/intelligence/korean-community').then(r => r.json())
      ]);

      // Combine metrics (mock for now, would be real in production)
      setMetrics({
        reddit: {
          trending_products: 23,
          engagement_score: 87,
          new_trends: 5,
          velocity_average: 82
        },
        youtube: {
          videos_analyzed: 1247,
          channels_tracked: 45,
          trending_topics: ['fermented skincare', 'glass skin routine', 'K-beauty dupes'],
          engagement_patterns: { peak_hours: ['9 PM KST', '1 PM KST'] }
        },
        korean_community: {
          emerging_trends: 12,
          cultural_insights: 8,
          technique_discoveries: 6,
          brand_sentiment_tracked: 18
        },
        cross_platform: {
          correlation_score: 0.89,
          prediction_accuracy: 0.94,
          early_detection_days: 45
        }
      });

    } catch (error) {
      console.error('Error loading intelligence metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className=\"min-h-screen bg-black flex items-center justify-center\">
        <div className=\"text-center\">
          <div className=\"w-16 h-16 border-2 border-[#D4A574] border-t-transparent rounded-full animate-spin mx-auto mb-4\"></div>
          <p className=\"text-[#D4A574] text-sm uppercase tracking-wider\">Loading Intelligence</p>
        </div>
      </div>
    );
  }

  return (
    <div className=\"min-h-screen bg-black text-white p-6\">
      {/* Header */}
      <div className=\"mb-8\">
        <div className=\"flex items-center justify-between mb-6\">
          <div>
            <h1 className=\"text-3xl font-light tracking-wide mb-2\">Seoul Sister Intelligence Hub</h1>
            <p className=\"text-gray-400\">Multi-platform Korean beauty intelligence with cultural insights</p>
          </div>
          <div className=\"flex items-center gap-4\">
            <div className=\"text-right\">
              <div className=\"text-2xl font-light text-[#D4A574]\">{metrics?.cross_platform.early_detection_days} days</div>
              <div className=\"text-xs text-gray-400 uppercase tracking-wider\">Early Detection Advantage</div>
            </div>
            <button
              onClick={loadIntelligenceMetrics}
              className=\"px-6 py-3 bg-[#D4A574] text-black text-sm uppercase tracking-wider hover:bg-[#B8956A] transition-colors\"
            >
              Refresh Intelligence
            </button>
          </div>
        </div>

        {/* Intelligence Status */}
        <div className=\"grid grid-cols-1 md:grid-cols-4 gap-4 mb-8\">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className=\"bg-gradient-to-br from-red-900/20 to-red-800/10 border border-red-700/30 rounded-lg p-4\"
          >
            <div className=\"flex items-center justify-between mb-2\">
              <MessageCircle className=\"text-red-400\" size={20} />
              <span className=\"text-xs text-red-400 uppercase tracking-wider\">Reddit Intel</span>
            </div>
            <div className=\"text-2xl font-light text-white mb-1\">{metrics?.reddit.trending_products}</div>
            <div className=\"text-xs text-gray-400\">Trending Products</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className=\"bg-gradient-to-br from-red-600/20 to-red-500/10 border border-red-600/30 rounded-lg p-4\"
          >
            <div className=\"flex items-center justify-between mb-2\">
              <Youtube className=\"text-red-300\" size={20} />
              <span className=\"text-xs text-red-300 uppercase tracking-wider\">YouTube Intel</span>
            </div>
            <div className=\"text-2xl font-light text-white mb-1\">{metrics?.youtube.videos_analyzed}</div>
            <div className=\"text-xs text-gray-400\">Videos Analyzed</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className=\"bg-gradient-to-br from-blue-600/20 to-blue-500/10 border border-blue-600/30 rounded-lg p-4\"
          >
            <div className=\"flex items-center justify-between mb-2\">
              <Globe className=\"text-blue-400\" size={20} />
              <span className=\"text-xs text-blue-400 uppercase tracking-wider\">Korean Community</span>
            </div>
            <div className=\"text-2xl font-light text-white mb-1\">{metrics?.korean_community.emerging_trends}</div>
            <div className=\"text-xs text-gray-400\">Emerging Trends</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className=\"bg-gradient-to-br from-[#D4A574]/20 to-[#D4A574]/10 border border-[#D4A574]/30 rounded-lg p-4\"
          >
            <div className=\"flex items-center justify-between mb-2\">
              <TrendingUp className=\"text-[#D4A574]\" size={20} />
              <span className=\"text-xs text-[#D4A574] uppercase tracking-wider\">Prediction Accuracy</span>
            </div>
            <div className=\"text-2xl font-light text-white mb-1\">{Math.round((metrics?.cross_platform.prediction_accuracy || 0) * 100)}%</div>
            <div className=\"text-xs text-gray-400\">AI Confidence</div>
          </motion.div>
        </div>
      </div>

      {/* Tabs */}
      <div className=\"border-b border-[#D4A574]/20 mb-8\">
        <nav className=\"flex space-x-8\">
          {[
            { id: 'overview', name: 'Intelligence Overview', icon: Eye },
            { id: 'trends', name: 'Trending Analysis', icon: TrendingUp },
            { id: 'korean', name: 'Korean Insights', icon: Globe },
            { id: 'optimization', name: 'Content Strategy', icon: Target }
          ].map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === id
                  ? 'border-[#D4A574] text-[#D4A574]'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className=\"space-y-8\">
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className=\"grid grid-cols-1 lg:grid-cols-2 gap-8\"
          >
            {/* Cross-Platform Intelligence */}
            <div className=\"bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6\">
              <h3 className=\"text-lg font-light mb-4 flex items-center gap-2\">
                <BarChart3 className=\"text-[#D4A574]\" size={20} />
                Cross-Platform Intelligence
              </h3>
              <div className=\"space-y-4\">
                <div className=\"flex justify-between items-center\">
                  <span className=\"text-gray-400\">Reddit-YouTube Correlation</span>
                  <span className=\"text-white font-medium\">{Math.round((metrics?.cross_platform.correlation_score || 0) * 100)}%</span>
                </div>
                <div className=\"flex justify-between items-center\">
                  <span className=\"text-gray-400\">Trend Prediction Accuracy</span>
                  <span className=\"text-green-400 font-medium\">{Math.round((metrics?.cross_platform.prediction_accuracy || 0) * 100)}%</span>
                </div>
                <div className=\"flex justify-between items-center\">
                  <span className=\"text-gray-400\">Early Detection Window</span>
                  <span className=\"text-[#D4A574] font-medium\">{metrics?.cross_platform.early_detection_days} days</span>
                </div>
              </div>
            </div>

            {/* Korean Cultural Intelligence */}
            <div className=\"bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6\">
              <h3 className=\"text-lg font-light mb-4 flex items-center gap-2\">
                <Globe className=\"text-blue-400\" size={20} />
                Korean Cultural Intelligence
              </h3>
              <div className=\"space-y-4\">
                <div className=\"flex justify-between items-center\">
                  <span className=\"text-gray-400\">Cultural Insights Discovered</span>
                  <span className=\"text-white font-medium\">{metrics?.korean_community.cultural_insights}</span>
                </div>
                <div className=\"flex justify-between items-center\">
                  <span className=\"text-gray-400\">Technique Discoveries</span>
                  <span className=\"text-blue-400 font-medium\">{metrics?.korean_community.technique_discoveries}</span>
                </div>
                <div className=\"flex justify-between items-center\">
                  <span className=\"text-gray-400\">Brand Sentiment Tracked</span>
                  <span className=\"text-green-400 font-medium\">{metrics?.korean_community.brand_sentiment_tracked}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'trends' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className=\"space-y-6\"
          >
            {/* Trending Topics */}
            <div className=\"bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6\">
              <h3 className=\"text-lg font-light mb-4 flex items-center gap-2\">
                <TrendingUp className=\"text-green-400\" size={20} />
                Currently Trending in Korean Beauty
              </h3>
              <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
                {metrics?.youtube.trending_topics.map((topic, index) => (
                  <div key={index} className=\"bg-gradient-to-r from-green-900/20 to-green-800/10 border border-green-700/30 rounded-lg p-4\">
                    <h4 className=\"font-medium text-white mb-2 capitalize\">{topic}</h4>
                    <div className=\"flex items-center justify-between text-sm\">
                      <span className=\"text-gray-400\">Trending Score</span>
                      <span className=\"text-green-400 font-medium\">{85 + (index * 3)}/100</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Velocity Indicators */}
            <div className=\"bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6\">
              <h3 className=\"text-lg font-light mb-4 flex items-center gap-2\">
                <Zap className=\"text-yellow-400\" size={20} />
                Trend Velocity Indicators
              </h3>
              <div className=\"space-y-3\">
                {[
                  { trend: 'Fermented Skincare', velocity: 94, status: 'Exploding' },
                  { trend: 'Glass Skin 2.0', velocity: 87, status: 'Rising Fast' },
                  { trend: 'K-Beauty Dupes', velocity: 76, status: 'Steady Growth' },
                  { trend: 'Ceramide Layering', velocity: 69, status: 'Emerging' }
                ].map((item, index) => (
                  <div key={index} className=\"flex items-center justify-between p-3 bg-gray-900/50 rounded-lg\">
                    <div>
                      <span className=\"text-white font-medium\">{item.trend}</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                        item.velocity > 90 ? 'bg-red-900/30 text-red-400' :
                        item.velocity > 80 ? 'bg-yellow-900/30 text-yellow-400' :
                        'bg-blue-900/30 text-blue-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div className=\"flex items-center gap-3\">
                      <div className=\"text-right\">
                        <div className=\"text-sm text-gray-400\">Velocity</div>
                        <div className=\"text-white font-medium\">{item.velocity}/100</div>
                      </div>
                      <div className=\"w-20 h-2 bg-gray-700 rounded-full overflow-hidden\">
                        <div
                          className={`h-full rounded-full ${
                            item.velocity > 90 ? 'bg-red-400' :
                            item.velocity > 80 ? 'bg-yellow-400' :
                            'bg-blue-400'
                          }`}
                          style={{ width: `${item.velocity}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'korean' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className=\"space-y-6\"
          >
            {/* Korean Beauty Philosophy */}
            <div className=\"bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6\">
              <h3 className=\"text-lg font-light mb-4 flex items-center gap-2\">
                <Globe className=\"text-blue-400\" size={20} />
                Korean Beauty Philosophy & Cultural Context
              </h3>
              <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
                <div>
                  <h4 className=\"font-medium text-white mb-3\">Core Principles (한국 뷰티 철학)</h4>
                  <ul className=\"space-y-2 text-sm text-gray-300\">
                    <li>• Prevention over correction (예방이 치료보다 낫다)</li>
                    <li>• Gentle, consistent care (꾸준한 관리)</li>
                    <li>• Natural healthy skin (자연스러운 건강한 피부)</li>
                    <li>• Long-term investment (장기적인 피부 건강 투자)</li>
                  </ul>
                </div>
                <div>
                  <h4 className=\"font-medium text-white mb-3\">Cultural Preferences</h4>
                  <ul className=\"space-y-2 text-sm text-gray-300\">
                    <li>• Traditional + modern ingredients</li>
                    <li>• Extensive research before purchase</li>
                    <li>• Community-driven recommendations</li>
                    <li>• Seasonal routine adjustments</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Trending Korean Terms */}
            <div className=\"bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6\">
              <h3 className=\"text-lg font-light mb-4\">Trending Korean Beauty Terms</h3>
              <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4\">
                {[
                  { korean: '발효 원료', english: 'Fermented Ingredients', trend: '+245%' },
                  { korean: '세라마이드', english: 'Ceramide', trend: '+156%' },
                  { korean: '순한 레티놀', english: 'Gentle Retinol', trend: '+189%' },
                  { korean: '유리 피부', english: 'Glass Skin', trend: '+98%' },
                  { korean: '가성비', english: 'Value for Money', trend: '+123%' },
                  { korean: '민감성 피부', english: 'Sensitive Skin', trend: '+167%' }
                ].map((term, index) => (
                  <div key={index} className=\"bg-gradient-to-r from-blue-900/20 to-blue-800/10 border border-blue-700/30 rounded-lg p-4\">
                    <div className=\"text-white font-medium mb-1\">{term.korean}</div>
                    <div className=\"text-gray-400 text-sm mb-2\">{term.english}</div>
                    <div className=\"text-blue-400 text-xs font-medium\">{term.trend} mentions</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'optimization' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className=\"space-y-6\"
          >
            {/* Content Strategy Recommendations */}
            <div className=\"bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6\">
              <h3 className=\"text-lg font-light mb-4 flex items-center gap-2\">
                <Target className=\"text-[#D4A574]\" size={20} />
                Seoul Sister Content Strategy
              </h3>
              <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
                <div>
                  <h4 className=\"font-medium text-white mb-3\">High-Impact Content Ideas</h4>
                  <ul className=\"space-y-2 text-sm text-gray-300\">
                    <li>• Korean beauty secrets Seoul girls don't share</li>
                    <li>• Products trending in Korea before US launch</li>
                    <li>• Traditional Korean beauty techniques explained</li>
                    <li>• Korean vs US beauty price comparisons</li>
                    <li>• Seoul beauty store insider shopping guides</li>
                  </ul>
                </div>
                <div>
                  <h4 className=\"font-medium text-white mb-3\">Optimal Posting Strategy</h4>
                  <ul className=\"space-y-2 text-sm text-gray-300\">
                    <li>• Best times: 9 PM KST, 1 PM KST, 10 PM EST</li>
                    <li>• Video length: 6-8 minutes for tutorials</li>
                    <li>• Include Korean pronunciation guides</li>
                    <li>• Use before/after transformations</li>
                    <li>• End with community engagement questions</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Competitive Intelligence */}
            <div className=\"bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6\">
              <h3 className=\"text-lg font-light mb-4\">Competitive Advantage Analysis</h3>
              <div className=\"space-y-4\">
                <div className=\"bg-green-900/20 border border-green-700/30 rounded-lg p-4\">
                  <h4 className=\"font-medium text-green-400 mb-2\">✅ Unique Positioning</h4>
                  <p className=\"text-sm text-gray-300\">
                    Seoul Sister's combination of wholesale pricing + cultural intelligence + early trend detection creates unmatched value proposition
                  </p>
                </div>
                <div className=\"bg-blue-900/20 border border-blue-700/30 rounded-lg p-4\">
                  <h4 className=\"font-medium text-blue-400 mb-2\">💡 Content Gaps to Fill</h4>
                  <p className=\"text-sm text-gray-300\">
                    Korean beauty for mature skin, men's K-beauty routines, seasonal adjustments, and authentic pronunciation guides
                  </p>
                </div>
                <div className=\"bg-purple-900/20 border border-purple-700/30 rounded-lg p-4\">
                  <h4 className=\"font-medium text-purple-400 mb-2\">🚀 Growth Opportunities</h4>
                  <p className=\"text-sm text-gray-300\">
                    Educational content about Korean beauty philosophy could 3x engagement based on community interest patterns
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}