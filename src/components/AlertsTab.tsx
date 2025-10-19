'use client'

import { useState, useEffect } from 'react'
import { Globe, Bell, Plus, Trash2, ToggleLeft, AlertTriangle, Check, X } from 'lucide-react'

interface ProcessedContent {
  id: string
  authorHandle: string
  hashtags?: string[]
}

interface AlertConfig {
  id: string
  alertType: 'new_content' | 'hashtag_trend' | 'engagement_threshold' | 'korean_beauty_term'
  targetValue: string
  threshold?: number
  isActive: boolean
  email: string
  createdAt: string
  lastTriggered?: string
}

interface AlertTrigger {
  id: string
  triggerReason: string
  triggerValue: string
  triggeredAt: string
  intelligence_alerts: {
    alert_type: string
    target_value: string
  }
}

interface AlertsTabProps {
  latestContent: ProcessedContent[]
  userEmail?: string
}

export default function AlertsTab({ latestContent, userEmail }: AlertsTabProps) {
  const [alerts, setAlerts] = useState<AlertConfig[]>([])
  const [recentTriggers, setRecentTriggers] = useState<AlertTrigger[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [newAlert, setNewAlert] = useState({
    alertType: 'new_content' as string,
    targetValue: '',
    threshold: ''
  })

  const fetchAlerts = async () => {
    if (!userEmail) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/intelligence/alerts?email=${encodeURIComponent(userEmail)}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        setAlerts(result.alerts || [])
        setRecentTriggers(result.recentTriggers || [])
      } else {
        throw new Error(result.error || 'Failed to fetch alerts')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [userEmail])

  const createAlert = async () => {
    if (!userEmail || !newAlert.targetValue) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        email: userEmail,
        alertType: newAlert.alertType,
        targetValue: newAlert.targetValue,
        threshold: newAlert.threshold ? parseInt(newAlert.threshold) : undefined,
        isActive: true
      }

      const response = await fetch('/api/intelligence/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (result.success) {
        setSuccess('Alert created successfully!')
        setNewAlert({ alertType: 'new_content', targetValue: '', threshold: '' })
        setShowCreateForm(false)
        fetchAlerts()
      } else {
        throw new Error(result.error || 'Failed to create alert')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleAlert = async (alertId: string, currentStatus: boolean) => {
    if (!userEmail) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/intelligence/alerts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: alertId,
          email: userEmail,
          isActive: !currentStatus
        })
      })

      const result = await response.json()

      if (result.success) {
        fetchAlerts()
        setSuccess(`Alert ${!currentStatus ? 'activated' : 'deactivated'}`)
      } else {
        throw new Error(result.error || 'Failed to update alert')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update alert')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteAlert = async (alertId: string) => {
    if (!userEmail || !confirm('Are you sure you want to delete this alert?')) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/intelligence/alerts?id=${alertId}&email=${encodeURIComponent(userEmail)}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setSuccess('Alert deleted successfully')
        fetchAlerts()
      } else {
        throw new Error(result.error || 'Failed to delete alert')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete alert')
    } finally {
      setIsLoading(false)
    }
  }

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'new_content': return 'New Content'
      case 'hashtag_trend': return 'Hashtag Monitoring'
      case 'engagement_threshold': return 'High Engagement'
      case 'korean_beauty_term': return 'K-Beauty Terms'
      default: return type
    }
  }

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'new_content': return '👤'
      case 'hashtag_trend': return '#️⃣'
      case 'engagement_threshold': return '📈'
      case 'korean_beauty_term': return '🇰🇷'
      default: return '🔔'
    }
  }

  if (!userEmail) {
    return (
      <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm text-center">
        <Globe className="text-luxury-gold mx-auto mb-4" size={48} />
        <h3 className="text-2xl font-semibold text-white mb-2 tracking-wide">
          Alert Configuration
        </h3>
        <p className="text-gray-300 font-light mb-6">
          Please log in to configure custom alerts for Korean beauty intelligence
        </p>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
          <div className="text-orange-400">⚠️ Authentication Required</div>
          <div className="text-gray-300 text-sm mt-2">
            Log in to access personalized alert configuration for Korean beauty trends and influencer content
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm">
      <div className="text-center mb-6">
        <Globe className="text-luxury-gold mx-auto mb-4" size={48} />
        <h3 className="text-2xl font-semibold text-white mb-2 tracking-wide">
          Intelligence Alerts
        </h3>
        <p className="text-gray-300 font-light">
          Get notified about Korean beauty trends, new content, and high-engagement posts
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <X className="text-red-400" size={16} />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Check className="text-green-400" size={16} />
            <span className="text-green-400 text-sm">{success}</span>
          </div>
        </div>
      )}

      {/* Create Alert Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-luxury-gold/20 hover:bg-luxury-gold/30 text-luxury-gold rounded-lg font-medium transition-all"
        >
          <Plus size={16} />
          Create New Alert
        </button>
      </div>

      {/* Create Alert Form */}
      {showCreateForm && (
        <div className="mb-6 p-6 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg">
          <h4 className="text-white font-medium mb-4">Create New Alert</h4>

          <div className="grid gap-4">
            <div>
              <label className="block text-gray-300 text-sm mb-2">Alert Type</label>
              <select
                value={newAlert.alertType}
                onChange={(e) => setNewAlert({ ...newAlert, alertType: e.target.value as any })}
                className="w-full px-3 py-2 bg-luxury-charcoal border border-luxury-gold/30 rounded text-white focus:outline-none focus:border-luxury-gold"
              >
                <option value="new_content">New Content from Influencer</option>
                <option value="hashtag_trend">Hashtag Monitoring</option>
                <option value="engagement_threshold">High Engagement Threshold</option>
                <option value="korean_beauty_term">Korean Beauty Terms</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-300 text-sm mb-2">
                {newAlert.alertType === 'new_content' ? 'Influencer Handle (without @)' :
                 newAlert.alertType === 'hashtag_trend' ? 'Hashtag (without #)' :
                 newAlert.alertType === 'engagement_threshold' ? 'Minimum Engagement Count' :
                 newAlert.alertType === 'korean_beauty_term' ? 'Korean Beauty Term' : ''}
              </label>
              <input
                type={newAlert.alertType === 'engagement_threshold' ? 'number' : 'text'}
                value={newAlert.alertType === 'engagement_threshold' ? newAlert.threshold : newAlert.targetValue}
                onChange={(e) => {
                  if (newAlert.alertType === 'engagement_threshold') {
                    setNewAlert({ ...newAlert, threshold: e.target.value, targetValue: e.target.value })
                  } else {
                    setNewAlert({ ...newAlert, targetValue: e.target.value })
                  }
                }}
                placeholder={
                  newAlert.alertType === 'new_content' ? 'ponysmakeup' :
                  newAlert.alertType === 'hashtag_trend' ? 'kbeauty' :
                  newAlert.alertType === 'engagement_threshold' ? '10000' :
                  newAlert.alertType === 'korean_beauty_term' ? 'glass skin' : ''
                }
                className="w-full px-3 py-2 bg-luxury-charcoal border border-luxury-gold/30 rounded text-white focus:outline-none focus:border-luxury-gold"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={createAlert}
                disabled={isLoading || !newAlert.targetValue}
                className="px-4 py-2 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded font-medium transition-all disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Alert'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Alerts */}
      {alerts.length > 0 ? (
        <div className="mb-6">
          <h4 className="text-white font-medium mb-4">Your Alert Configurations</h4>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-4 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getAlertTypeIcon(alert.alertType)}</span>
                    <div>
                      <div className="text-white font-medium">
                        {getAlertTypeLabel(alert.alertType)}: {alert.targetValue}
                        {alert.threshold && ` (${alert.threshold.toLocaleString()}+ engagement)`}
                      </div>
                      <div className="text-gray-400 text-sm">
                        Created: {new Date(alert.createdAt).toLocaleDateString()}
                        {alert.lastTriggered && ` • Last triggered: ${new Date(alert.lastTriggered).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAlert(alert.id, alert.isActive)}
                      className={`p-2 rounded transition-all ${
                        alert.isActive
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                      }`}
                    >
                      <ToggleLeft size={16} />
                    </button>
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 p-6 bg-luxury-gold/5 border border-luxury-gold/20 rounded-lg text-center">
          <Bell className="text-luxury-gold mx-auto mb-3" size={32} />
          <div className="text-white font-medium mb-2">No Alerts Configured</div>
          <div className="text-gray-300 text-sm">
            Create your first alert to get notified about Korean beauty trends and new content
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recentTriggers.length > 0 && (
        <div className="mb-6">
          <h4 className="text-white font-medium mb-4">Recent Alert Activity</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recentTriggers.slice(0, 10).map((trigger) => (
              <div key={trigger.id} className="p-3 bg-luxury-charcoal/20 border border-luxury-gold/10 rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm">{trigger.triggerReason}</div>
                    <div className="text-gray-400 text-xs">
                      {getAlertTypeLabel(trigger.intelligence_alerts.alert_type)} • {trigger.intelligence_alerts.target_value}
                    </div>
                  </div>
                  <div className="text-gray-400 text-xs">
                    {new Date(trigger.triggeredAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Data for Alerts */}
      <div className="bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg p-4">
        <div className="text-white font-medium mb-3">💡 Available Alert Options</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-300 font-medium mb-2">Active Influencers</div>
            <div className="text-gray-400">
              {latestContent.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {[...new Set(latestContent.map(c => c.authorHandle))].slice(0, 6).map((handle, i) => (
                    <span key={i} className="bg-luxury-gold/10 text-luxury-gold px-2 py-1 rounded text-xs">
                      @{handle}
                    </span>
                  ))}
                  {new Set(latestContent.map(c => c.authorHandle)).size > 6 && (
                    <span className="text-gray-500 text-xs">+{new Set(latestContent.map(c => c.authorHandle)).size - 6} more</span>
                  )}
                </div>
              ) : (
                'Will be available after daily collection'
              )}
            </div>
          </div>

          <div>
            <div className="text-gray-300 font-medium mb-2">Trending Hashtags</div>
            <div className="text-gray-400">
              {latestContent.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {Array.from(new Set(latestContent.flatMap(c => c.hashtags || []))).slice(0, 6).map((tag, i) => (
                    <span key={i} className="bg-purple-500/10 text-purple-400 px-2 py-1 rounded text-xs">
                      #{tag}
                    </span>
                  ))}
                  {Array.from(new Set(latestContent.flatMap(c => c.hashtags || []))).length > 6 && (
                    <span className="text-gray-500 text-xs">+{Array.from(new Set(latestContent.flatMap(c => c.hashtags || []))).length - 6} more</span>
                  )}
                </div>
              ) : (
                'Will be available after daily collection'
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-600 text-xs text-gray-400">
          💡 Alerts will be checked automatically when new content is collected during the daily 9 AM Pacific cycle
        </div>
      </div>
    </div>
  )
}