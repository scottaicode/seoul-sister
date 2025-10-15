'use client';

interface RedditCommunityInsight {
  trendTerm: string;
  trendType: string;
  mentionCount: number;
  velocityScore: number;
  trendStatus: string;
  aiConfidence: number;
  koreanOrigin: boolean;
  subreddits: string[];
  sampleDiscussions: string[];
  communityRecommendations: string[];
}

interface CommunityTrend {
  term: string;
  type: 'emerging' | 'viral' | 'declining';
  redditMentions: number;
  confidenceScore: number;
  timeToMainstream: string;
  businessOpportunity: string;
}

interface RedditCommunityInsightsProps {
  insights: RedditCommunityInsight[];
  communityTrends: CommunityTrend[];
}

export default function RedditCommunityInsights({ insights, communityTrends }: RedditCommunityInsightsProps) {
  const getTrendStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'trending': return 'bg-red-100 text-red-800 border-red-200';
      case 'emerging': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'stable': return 'bg-green-100 text-green-800 border-green-200';
      case 'declining': return 'bg-gray-100 text-gray-600 border-gray-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getTrendTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'brand': return '🏪';
      case 'ingredient': return '🧪';
      case 'product': return '🧴';
      case 'technique': return '✨';
      default: return '💡';
    }
  };

  const getCommunityTrendIcon = (type: string) => {
    switch (type) {
      case 'viral': return '✨';
      case 'emerging': return '📈';
      case 'declining': return '⚠️';
      default: return '💬';
    }
  };

  if (!insights?.length && !communityTrends?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            👥 Reddit Community Intelligence
          </h2>
        </div>
        <div className="p-4">
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-lg font-medium">Building Community Intelligence</p>
            <p className="text-sm">Reddit data will appear here as the system learns from Korean beauty communities</p>
            <div className="mt-4 text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg inline-block">
              🤖 AI-powered trend discovery running every 4 hours
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Community Trends Overview */}
      {communityTrends?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              📈 Viral Community Trends
            </h3>
            <p className="text-sm text-gray-600">High-velocity trends from Korean beauty communities</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {communityTrends.map((trend, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{getCommunityTrendIcon(trend.type)}</span>
                    <h4 className="font-semibold capitalize">{trend.term}</h4>
                    <span className="text-xs border border-gray-300 px-2 py-1 rounded">
                      {trend.type}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Reddit Mentions:</span>
                      <span className="font-medium">{trend.redditMentions.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Confidence:</span>
                      <span className="font-medium">{Math.round(trend.confidenceScore * 100)}%</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Time to Mainstream:</span>
                      <span className="font-medium text-blue-600">{trend.timeToMainstream}</span>
                    </div>

                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                      <strong>Business Opportunity:</strong>
                      <p className="mt-1">{trend.businessOpportunity}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Reddit Insights */}
      {insights?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              👥 Reddit Community Insights
            </h3>
            <p className="text-sm text-gray-600">AI-analyzed trends from Korean beauty discussions</p>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {getTrendTypeIcon(insight.trendType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg capitalize">
                            {insight.trendTerm}
                          </h3>
                          {insight.koreanOrigin && (
                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded">
                              🇰🇷 Korean Origin
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {insight.trendType}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${getTrendStatusColor(insight.trendStatus)}`}>
                            {insight.trendStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {insight.velocityScore}
                      </div>
                      <div className="text-xs text-gray-500">
                        Velocity Score
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Community Stats</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Mentions:</span>
                          <span className="font-medium">{insight.mentionCount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AI Confidence:</span>
                          <span className="font-medium">{Math.round(insight.aiConfidence * 100)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Subreddits:</span>
                          <span className="font-medium">r/{insight.subreddits.slice(0, 2).join(', r/')}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Sample Discussions</h4>
                      <div className="space-y-2">
                        {insight.sampleDiscussions.slice(0, 2).map((discussion, idx) => (
                          <div key={idx} className="text-xs italic text-gray-600 border-l-2 border-gray-200 pl-2">
                            {discussion}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Community Recommendations</h4>
                    <div className="flex flex-wrap gap-2">
                      {insight.communityRecommendations.map((rec, idx) => (
                        <span key={idx} className="text-xs border border-gray-300 px-2 py-1 rounded">
                          {rec}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}