'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, Calendar, TrendingUp, Video, Share2, Download, Eye } from 'lucide-react';

interface ContentPipelineStatus {
  dailyReport: {
    status: 'generating' | 'ready' | 'published';
    lastGenerated: string;
    nextScheduled: string;
  };
  socialTeasers: {
    instagram: 'pending' | 'generated' | 'scheduled' | 'posted';
    tiktok: 'pending' | 'generated' | 'scheduled' | 'posted';
    twitter: 'pending' | 'generated' | 'scheduled' | 'posted';
    youtube: 'pending' | 'generated' | 'scheduled' | 'posted';
  };
  videoScript: {
    status: 'pending' | 'generated' | 'approved' | 'recorded';
    estimatedRecordingTime: string;
    lastGenerated: string;
  };
  aiVideo: {
    status: 'disabled' | 'generating' | 'ready' | 'published';
    platform: string[];
    nextGeneration: string;
  };
}

export default function ContentAutomationDashboard() {
  const [pipelineStatus, setPipelineStatus] = useState<ContentPipelineStatus | null>(null);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPipelineStatus();
  }, []);

  const loadPipelineStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/content-pipeline-status');

      if (response.ok) {
        const data = await response.json();
        setPipelineStatus(data.status);
        setAutomationEnabled(data.automationEnabled);
      } else {
        // Mock data for demo
        setPipelineStatus({
          dailyReport: {
            status: 'ready',
            lastGenerated: new Date().toISOString(),
            nextScheduled: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          },
          socialTeasers: {
            instagram: 'generated',
            tiktok: 'scheduled',
            twitter: 'posted',
            youtube: 'generated'
          },
          videoScript: {
            status: 'generated',
            estimatedRecordingTime: '45-60 minutes',
            lastGenerated: new Date().toISOString()
          },
          aiVideo: {
            status: 'disabled',
            platform: ['instagram', 'tiktok'],
            nextGeneration: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
          }
        });
        setAutomationEnabled(true);
      }
    } catch (error) {
      console.error('Error loading pipeline status:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSocialTeasers = async () => {
    try {
      const response = await fetch('/api/content/social-teasers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: 'latest',
          reportData: { /* current report data */ }
        })
      });

      if (response.ok) {
        await loadPipelineStatus();
      }
    } catch (error) {
      console.error('Error generating social teasers:', error);
    }
  };

  const generateVideoScript = async () => {
    try {
      const response = await fetch('/api/content/video-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: 'latest',
          reportData: { /* current report data */ },
          style: 'professional'
        })
      });

      if (response.ok) {
        await loadPipelineStatus();
      }
    } catch (error) {
      console.error('Error generating video script:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'generated':
      case 'posted':
      case 'published':
        return 'text-green-400 bg-green-900/20';
      case 'scheduled':
      case 'approved':
        return 'text-blue-400 bg-blue-900/20';
      case 'generating':
      case 'pending':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'disabled':
        return 'text-gray-400 bg-gray-900/20';
      default:
        return 'text-gray-400 bg-gray-900/20';
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-gray-800 rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-800 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Content Automation Pipeline</h2>
          <p className="text-gray-400">Automated daily content generation and distribution</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={automationEnabled}
              onChange={(e) => setAutomationEnabled(e.target.checked)}
              className="rounded"
            />
            <span className="text-white">Automation Enabled</span>
          </label>
          <button
            onClick={loadPipelineStatus}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh Status
          </button>
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="text-blue-400" size={20} />
          Daily Content Pipeline Status
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Daily Report */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-white">Daily Report</h4>
              <span className={`px-2 py-1 rounded text-xs ${getStatusColor(pipelineStatus?.dailyReport.status || 'pending')}`}>
                {pipelineStatus?.dailyReport.status || 'pending'}
              </span>
            </div>
            <p className="text-sm text-gray-400">
              Next: {new Date(pipelineStatus?.dailyReport.nextScheduled || Date.now()).toLocaleTimeString()}
            </p>
          </div>

          {/* Social Teasers */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-white">Social Teasers</h4>
              <button
                onClick={generateSocialTeasers}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                Generate
              </button>
            </div>
            <div className="space-y-1">
              {Object.entries(pipelineStatus?.socialTeasers || {}).map(([platform, status]) => (
                <div key={platform} className="flex justify-between text-xs">
                  <span className="text-gray-400 capitalize">{platform}</span>
                  <span className={`px-1 rounded ${getStatusColor(status)}`}>{status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Video Script */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-white">Video Script</h4>
              <button
                onClick={generateVideoScript}
                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
              >
                Generate
              </button>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Status</span>
                <span className={`px-1 rounded ${getStatusColor(pipelineStatus?.videoScript.status || 'pending')}`}>
                  {pipelineStatus?.videoScript.status || 'pending'}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                Recording: {pipelineStatus?.videoScript.estimatedRecordingTime || '45-60 min'}
              </div>
            </div>
          </div>

          {/* AI Video (Future) */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-white">AI Video</h4>
              <span className="px-2 py-1 rounded text-xs bg-purple-900/20 text-purple-400">
                Coming Soon
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Automated video generation with AI presenter
            </p>
          </div>
        </div>
      </div>

      {/* Social Media Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="text-green-400" size={20} />
            Content Performance
          </h3>

          <div className="space-y-4">
            {[
              { platform: 'Instagram', views: '15.2K', engagement: '8.4%', growth: '+12%' },
              { platform: 'TikTok', views: '45.8K', engagement: '12.1%', growth: '+28%' },
              { platform: 'Twitter', views: '8.7K', engagement: '6.2%', growth: '+5%' },
              { platform: 'YouTube', views: '22.1K', engagement: '9.8%', growth: '+18%' }
            ].map((metric) => (
              <div key={metric.platform} className="flex items-center justify-between">
                <span className="text-white">{metric.platform}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400">{metric.views} views</span>
                  <span className="text-blue-400">{metric.engagement}</span>
                  <span className="text-green-400">{metric.growth}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Video className="text-purple-400" size={20} />
            Video Production Queue
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div>
                <h4 className="font-medium text-white">Today's Intelligence Report</h4>
                <p className="text-sm text-gray-400">6-minute professional script ready</p>
              </div>
              <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                <Download size={16} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg opacity-60">
              <div>
                <h4 className="font-medium text-white">Tomorrow's Report</h4>
                <p className="text-sm text-gray-400">Auto-generating at 6 AM UTC</p>
              </div>
              <span className="text-xs text-gray-400">Scheduled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Strategy Insights */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Eye className="text-yellow-400" size={20} />
          Strategic Recommendations
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
            <h4 className="font-medium text-green-400 mb-2">✅ Platform Optimization</h4>
            <p className="text-sm text-gray-300">
              TikTok showing 28% growth - increase posting frequency to 2x daily
            </p>
          </div>

          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <h4 className="font-medium text-blue-400 mb-2">💡 Content Opportunity</h4>
            <p className="text-sm text-gray-300">
              Reddit trends suggest high interest in fermented ingredients - create dedicated series
            </p>
          </div>

          <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
            <h4 className="font-medium text-purple-400 mb-2">🚀 Growth Potential</h4>
            <p className="text-sm text-gray-300">
              YouTube long-form content could 3x subscriber growth based on current engagement
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}