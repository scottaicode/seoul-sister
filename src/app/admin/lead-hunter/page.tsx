'use client';

import { useState, useEffect } from 'react';

interface SystemStatus {
  enabled: boolean;
  last_run: string;
  total_conversations_detected: number;
  leads_generated: number;
  conversion_rate: number;
  system_health: 'excellent' | 'good' | 'warning' | 'error';
}

interface LiveStats {
  active_cycles: number;
  conversations_monitored: number;
  leads_in_pipeline: number;
  response_rate: number;
  cultural_responses_generated: number;
  viral_content_pieces: number;
}

export default function AILeadHunterAdmin() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    enabled: false,
    last_run: 'Never',
    total_conversations_detected: 0,
    leads_generated: 0,
    conversion_rate: 0,
    system_health: 'good'
  });

  const [liveStats, setLiveStats] = useState<LiveStats>({
    active_cycles: 0,
    conversations_monitored: 0,
    leads_in_pipeline: 0,
    response_rate: 0,
    cultural_responses_generated: 0,
    viral_content_pieces: 0
  });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSystemStatus();
    fetchLiveStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(() => {
      fetchLiveStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/admin/lead-hunter-control');
      const data = await response.json();
      setSystemStatus(data.system_status);
    } catch (error) {
      console.error('Error fetching system status:', error);
    }
  };

  const fetchLiveStats = async () => {
    try {
      const response = await fetch('/api/admin/lead-hunter-stats');
      const data = await response.json();
      setLiveStats(data.live_stats);
    } catch (error) {
      console.error('Error fetching live stats:', error);
    }
  };

  const toggleSystem = async () => {
    setIsLoading(true);
    try {
      const action = systemStatus.enabled ? 'disable' : 'enable';
      const response = await fetch('/api/admin/lead-hunter-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const data = await response.json();
      if (data.success) {
        setSystemStatus(prev => ({ ...prev, enabled: !prev.enabled }));
        setMessage(`AI Lead Hunter ${action}d successfully`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Error toggling system');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const runTestCycle = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/lead-hunter/autonomous-engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_system' })
      });

      const data = await response.json();
      setMessage('Test cycle completed successfully');
      setTimeout(() => setMessage(''), 3000);
      fetchLiveStats();
    } catch (error) {
      setMessage('Error running test cycle');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🇰🇷 AI Lead Hunter Admin Portal
          </h1>
          <p className="text-gray-600">
            Manage and monitor Seoul Sister's autonomous lead generation system
          </p>
        </div>

        {message && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">{message}</p>
          </div>
        )}

        {/* System Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* System Status Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">System Status</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status:</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${systemStatus.enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={`font-medium ${systemStatus.enabled ? 'text-green-600' : 'text-red-600'}`}>
                    {systemStatus.enabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Health:</span>
                <span className={`font-medium capitalize ${getStatusColor(systemStatus.system_health)}`}>
                  {systemStatus.system_health}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Run:</span>
                <span className="text-gray-900">{systemStatus.last_run}</span>
              </div>

              <div className="pt-4 border-t">
                <button
                  onClick={toggleSystem}
                  disabled={isLoading}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    systemStatus.enabled
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? 'Processing...' : systemStatus.enabled ? 'DISABLE System' : 'ENABLE System'}
                </button>
              </div>

              <button
                onClick={runTestCycle}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Run Test Cycle
              </button>
            </div>
          </div>

          {/* Performance Overview */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Performance Overview</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{systemStatus.total_conversations_detected}</div>
                <div className="text-sm text-gray-600">Conversations Detected</div>
              </div>

              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{systemStatus.leads_generated}</div>
                <div className="text-sm text-gray-600">Leads Generated</div>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{systemStatus.conversion_rate}%</div>
                <div className="text-sm text-gray-600">Conversion Rate</div>
              </div>

              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">$0</div>
                <div className="text-sm text-gray-600">Cost Per Lead</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Stats Dashboard */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Live System Statistics</h2>
            <div className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{liveStats.active_cycles}</div>
                  <div className="text-blue-100">Active Cycles</div>
                </div>
                <div className="text-4xl opacity-80">🔄</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{liveStats.conversations_monitored}</div>
                  <div className="text-green-100">Conversations Monitored</div>
                </div>
                <div className="text-4xl opacity-80">👥</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{liveStats.leads_in_pipeline}</div>
                  <div className="text-purple-100">Leads in Pipeline</div>
                </div>
                <div className="text-4xl opacity-80">📈</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{liveStats.response_rate}%</div>
                  <div className="text-orange-100">Response Rate</div>
                </div>
                <div className="text-4xl opacity-80">💬</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-6 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{liveStats.cultural_responses_generated}</div>
                  <div className="text-pink-100">Cultural Responses</div>
                </div>
                <div className="text-4xl opacity-80">🇰🇷</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{liveStats.viral_content_pieces}</div>
                  <div className="text-indigo-100">Viral Content Created</div>
                </div>
                <div className="text-4xl opacity-80">🔥</div>
              </div>
            </div>
          </div>
        </div>

        {/* Korean Cultural Intelligence Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">🇰🇷 Korean Cultural Intelligence</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Cultural Knowledge Base</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Traditional Philosophy (양생)</span>
                  <span className="text-green-600">✓ Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Pronunciation Guides</span>
                  <span className="text-green-600">✓ Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Seoul Market Intelligence</span>
                  <span className="text-green-600">✓ Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Authenticity Verification</span>
                  <span className="text-green-600">✓ Active</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Competitive Advantages</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">●</span>
                  <span>Zero acquisition cost ($0 vs $20-50)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">●</span>
                  <span>Cultural authority impossible to replicate</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">●</span>
                  <span>Unlimited scalability</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">●</span>
                  <span>Pre-qualified warm leads</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Safety Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-yellow-500 mt-1">⚠️</div>
            <div>
              <h3 className="font-medium text-yellow-800 mb-1">Safety Recommendation</h3>
              <p className="text-yellow-700 text-sm">
                Consider keeping the AI Lead Hunter system disabled until seoulsister.com is fully completed and polished.
                This ensures you can properly handle and convert any leads generated by the system.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}