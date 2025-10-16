'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black">
      <div className="container mx-auto px-4 pt-8 pb-8">
        {/* Back button */}
        <div className="mb-6">
          <Link
            href="/admin/ai-features"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-luxury-gold transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to AI Features Admin</span>
          </Link>
        </div>

        <div className="mb-8 text-center">
          <div className="mb-6">
            <p className="text-caption mb-4 text-gray-400 tracking-widest">EXECUTIVE DASHBOARD</p>
          </div>
          <h1 className="text-4xl font-light text-white mb-4 tracking-wide">
            🇰🇷 AI Lead Hunter Admin Portal
          </h1>
          <p className="text-lg font-light text-gray-300 max-w-3xl mx-auto">
            Manage and monitor Seoul Sister's autonomous lead generation system
          </p>
        </div>

        {message && (
          <div className="mb-6 p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg backdrop-blur-sm">
            <p className="text-luxury-gold">{message}</p>
          </div>
        )}

        {/* System Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* System Status Card */}
          <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-4 text-white tracking-wide">System Status</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 font-light">Status:</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${systemStatus.enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={`font-medium ${systemStatus.enabled ? 'text-green-400' : 'text-red-400'}`}>
                    {systemStatus.enabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-300 font-light">Health:</span>
                <span className={`font-medium capitalize ${systemStatus.system_health === 'good' ? 'text-luxury-gold' : 'text-gray-300'}`}>
                  {systemStatus.system_health}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-300 font-light">Last Run:</span>
                <span className="text-white font-light">{systemStatus.last_run}</span>
              </div>

              <div className="pt-4 border-t border-luxury-gold/20">
                <button
                  onClick={toggleSystem}
                  disabled={isLoading}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all tracking-wide ${
                    systemStatus.enabled
                      ? 'bg-red-600/80 hover:bg-red-600 text-white border border-red-500/30'
                      : 'bg-luxury-gold hover:bg-luxury-gold/90 text-black border border-luxury-gold/30'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? 'Processing...' : systemStatus.enabled ? 'DISABLE System' : 'ENABLE System'}
                </button>
              </div>

              <button
                onClick={runTestCycle}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-luxury-charcoal/50 hover:bg-luxury-charcoal/70 text-gray-300 border border-luxury-gold/30 rounded-lg font-medium transition-all tracking-wide disabled:opacity-50"
              >
                Run Test Cycle
              </button>
            </div>
          </div>

          {/* Performance Overview */}
          <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-4 text-white tracking-wide">Performance Overview</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-500/10 border border-blue-400/30 rounded-lg">
                <div className="text-2xl font-bold text-blue-400">{systemStatus.total_conversations_detected}</div>
                <div className="text-sm text-gray-300 font-light">Conversations Detected</div>
              </div>

              <div className="text-center p-4 bg-green-500/10 border border-green-400/30 rounded-lg">
                <div className="text-2xl font-bold text-green-400">{systemStatus.leads_generated}</div>
                <div className="text-sm text-gray-300 font-light">Leads Generated</div>
              </div>

              <div className="text-center p-4 bg-purple-500/10 border border-purple-400/30 rounded-lg">
                <div className="text-2xl font-bold text-purple-400">{systemStatus.conversion_rate}%</div>
                <div className="text-sm text-gray-300 font-light">Conversion Rate</div>
              </div>

              <div className="text-center p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
                <div className="text-2xl font-bold text-luxury-gold">$0</div>
                <div className="text-sm text-gray-300 font-light">Cost Per Lead</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Stats Dashboard */}
        <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white tracking-wide">Live System Statistics</h2>
            <div className="text-sm text-gray-400 font-light">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-400/30 text-white p-6 rounded-xl backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-blue-400">{liveStats.active_cycles}</div>
                  <div className="text-gray-300 font-light">Active Cycles</div>
                </div>
                <div className="text-4xl opacity-60">🔄</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-400/30 text-white p-6 rounded-xl backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-green-400">{liveStats.conversations_monitored}</div>
                  <div className="text-gray-300 font-light">Conversations Monitored</div>
                </div>
                <div className="text-4xl opacity-60">👥</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-400/30 text-white p-6 rounded-xl backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-purple-400">{liveStats.leads_in_pipeline}</div>
                  <div className="text-gray-300 font-light">Leads in Pipeline</div>
                </div>
                <div className="text-4xl opacity-60">📈</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-400/30 text-white p-6 rounded-xl backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-orange-400">{liveStats.response_rate}%</div>
                  <div className="text-gray-300 font-light">Response Rate</div>
                </div>
                <div className="text-4xl opacity-60">💬</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-pink-500/20 to-pink-600/20 border border-pink-400/30 text-white p-6 rounded-xl backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-pink-400">{liveStats.cultural_responses_generated}</div>
                  <div className="text-gray-300 font-light">Cultural Responses</div>
                </div>
                <div className="text-4xl opacity-60">🇰🇷</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-luxury-gold/20 to-yellow-500/20 border border-luxury-gold/30 text-white p-6 rounded-xl backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-luxury-gold">{liveStats.viral_content_pieces}</div>
                  <div className="text-gray-300 font-light">Viral Content Created</div>
                </div>
                <div className="text-4xl opacity-60">🔥</div>
              </div>
            </div>
          </div>
        </div>

        {/* Korean Cultural Intelligence Status */}
        <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm mb-8">
          <h2 className="text-xl font-semibold mb-4 text-white tracking-wide">🇰🇷 Korean Cultural Intelligence</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-medium text-luxury-gold tracking-wide">Cultural Knowledge Base</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300 font-light">Traditional Philosophy (양생)</span>
                  <span className="text-green-400 font-medium">✓ Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300 font-light">Pronunciation Guides</span>
                  <span className="text-green-400 font-medium">✓ Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300 font-light">Seoul Market Intelligence</span>
                  <span className="text-green-400 font-medium">✓ Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300 font-light">Authenticity Verification</span>
                  <span className="text-green-400 font-medium">✓ Active</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-luxury-gold tracking-wide">Competitive Advantages</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-luxury-gold">●</span>
                  <span className="text-gray-300 font-light">Zero acquisition cost ($0 vs $20-50)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-luxury-gold">●</span>
                  <span className="text-gray-300 font-light">Cultural authority impossible to replicate</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-luxury-gold">●</span>
                  <span className="text-gray-300 font-light">Unlimited scalability</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-luxury-gold">●</span>
                  <span className="text-gray-300 font-light">Pre-qualified warm leads</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Safety Notice */}
        <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-start space-x-3">
            <div className="text-yellow-400 mt-1">⚠️</div>
            <div>
              <h3 className="font-medium text-yellow-300 mb-1 tracking-wide">Safety Recommendation</h3>
              <p className="text-gray-300 text-sm font-light">
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