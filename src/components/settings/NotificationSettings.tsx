'use client'

import { useState, useEffect } from 'react'
import { BaileyUserProfile } from '@/types/bailey-profile'
import { Bell, Mail, Smartphone, Clock, Star } from 'lucide-react'

interface NotificationSettingsProps {
  profile: Partial<BaileyUserProfile> | null
  onUpdate: (data: Partial<BaileyUserProfile>) => void
}

export default function NotificationSettings({ profile, onUpdate }: NotificationSettingsProps) {
  const [formData, setFormData] = useState({
    notifications: {
      emailUpdates: profile?.notifications?.emailUpdates ?? true as boolean,
      productRecommendations: profile?.notifications?.productRecommendations ?? true as boolean,
      routineReminders: profile?.notifications?.routineReminders ?? false as boolean,
      progressCheckIns: profile?.notifications?.progressCheckIns ?? true as boolean,
      newProductAlerts: profile?.notifications?.newProductAlerts ?? false as boolean,
      saleNotifications: profile?.notifications?.saleNotifications ?? true as boolean,
      weeklyTips: profile?.notifications?.weeklyTips ?? true as boolean,
      frequency: profile?.notifications?.frequency || 'weekly' as 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'minimal'
    }
  })

  useEffect(() => {
    setFormData({
      notifications: {
        emailUpdates: profile?.notifications?.emailUpdates ?? true as boolean,
        productRecommendations: profile?.notifications?.productRecommendations ?? true as boolean,
        routineReminders: profile?.notifications?.routineReminders ?? false as boolean,
        progressCheckIns: profile?.notifications?.progressCheckIns ?? true as boolean,
        newProductAlerts: profile?.notifications?.newProductAlerts ?? false as boolean,
        saleNotifications: profile?.notifications?.saleNotifications ?? true as boolean,
        weeklyTips: profile?.notifications?.weeklyTips ?? true as boolean,
        frequency: profile?.notifications?.frequency || 'weekly' as 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'minimal'
      }
    })
  }, [profile])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev }
      const [parent, child] = field.split('.')

      if (parent === 'notifications') {
        updated.notifications = {
          ...updated.notifications,
          [child]: value
        }
      }
      return updated
    })
    onUpdate(formData)
  }

  const frequencies = [
    'daily', 'weekly', 'bi-weekly', 'monthly', 'minimal'
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-light text-white mb-2">Notification Preferences</h2>
        <p className="text-gray-400">
          Control how and when Bailey communicates with you about your skincare journey
        </p>
      </div>

      {/* Email Communication */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Mail className="w-5 h-5 mr-2" />
          Email Communications
        </h3>
        <div className="space-y-4">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notifications.emailUpdates}
              onChange={(e) => handleInputChange('notifications.emailUpdates', e.target.checked)}
              className="mt-1 rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
            />
            <div>
              <span className="text-gray-300 font-medium">Essential Updates</span>
              <p className="text-sm text-gray-500">
                Important account information, security updates, and service announcements
              </p>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notifications.productRecommendations}
              onChange={(e) => handleInputChange('notifications.productRecommendations', e.target.checked)}
              className="mt-1 rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
            />
            <div>
              <span className="text-gray-300 font-medium">Personalized Recommendations</span>
              <p className="text-sm text-gray-500">
                Bailey's curated product suggestions based on your skin profile and goals
              </p>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notifications.weeklyTips}
              onChange={(e) => handleInputChange('notifications.weeklyTips', e.target.checked)}
              className="mt-1 rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
            />
            <div>
              <span className="text-gray-300 font-medium">Skincare Education</span>
              <p className="text-sm text-gray-500">
                Weekly tips, ingredient spotlights, and Korean beauty insights from Bailey
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Progress & Journey */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Star className="w-5 h-5 mr-2" />
          Progress Tracking
        </h3>
        <div className="space-y-4">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notifications.progressCheckIns}
              onChange={(e) => handleInputChange('notifications.progressCheckIns', e.target.checked)}
              className="mt-1 rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
            />
            <div>
              <span className="text-gray-300 font-medium">Progress Check-ins</span>
              <p className="text-sm text-gray-500">
                Regular prompts to update your skin condition and routine effectiveness
              </p>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notifications.routineReminders}
              onChange={(e) => handleInputChange('notifications.routineReminders', e.target.checked)}
              className="mt-1 rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
            />
            <div>
              <span className="text-gray-300 font-medium">Routine Reminders</span>
              <p className="text-sm text-gray-500">
                Gentle reminders to maintain consistency with your skincare routine
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Product Alerts */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Bell className="w-5 h-5 mr-2" />
          Product Alerts
        </h3>
        <div className="space-y-4">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notifications.newProductAlerts}
              onChange={(e) => handleInputChange('notifications.newProductAlerts', e.target.checked)}
              className="mt-1 rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
            />
            <div>
              <span className="text-gray-300 font-medium">New Product Launches</span>
              <p className="text-sm text-gray-500">
                First access to new Korean beauty products that match your skin profile
              </p>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notifications.saleNotifications}
              onChange={(e) => handleInputChange('notifications.saleNotifications', e.target.checked)}
              className="mt-1 rounded border-gray-600 text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
            />
            <div>
              <span className="text-gray-300 font-medium">Exclusive Offers</span>
              <p className="text-sm text-gray-500">
                Member-only discounts and limited-time offers on recommended products
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Communication Frequency */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Communication Frequency
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            How often would you like to hear from Bailey?
          </label>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {frequencies.map(freq => (
              <label key={freq} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="frequency"
                  value={freq}
                  checked={formData.notifications.frequency === freq}
                  onChange={(e) => handleInputChange('notifications.frequency', e.target.value)}
                  className="text-[#d4a574] focus:ring-[#d4a574] focus:ring-offset-0"
                />
                <div>
                  <span className="text-gray-300 text-sm">
                    {freq.charAt(0).toUpperCase() + freq.slice(1).replace('-', ' ')}
                  </span>
                  <p className="text-xs text-gray-500">
                    {freq === 'daily' && 'Daily tips & reminders'}
                    {freq === 'weekly' && 'Weekly updates'}
                    {freq === 'bi-weekly' && 'Every 2 weeks'}
                    {freq === 'monthly' && 'Monthly summary'}
                    {freq === 'minimal' && 'Essential only'}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Preview of Communications */}
      <div className="bg-[#d4a574]/5 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4">Your Communication Preview</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-[#d4a574] rounded-full mt-2"></div>
            <p className="text-gray-300">
              <span className="text-[#d4a574] font-medium">Frequency:</span>
              {formData.notifications.frequency === 'daily' && ' You\'ll receive daily skincare tips and gentle routine reminders'}
              {formData.notifications.frequency === 'weekly' && ' Weekly skincare insights and progress check-ins'}
              {formData.notifications.frequency === 'bi-weekly' && ' Bi-weekly updates with curated recommendations'}
              {formData.notifications.frequency === 'monthly' && ' Monthly progress summaries and new product highlights'}
              {formData.notifications.frequency === 'minimal' && ' Only essential updates and important product matches'}
            </p>
          </div>

          {formData.notifications.productRecommendations && (
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
              <p className="text-gray-300">
                <span className="text-blue-400 font-medium">Recommendations:</span>
                Bailey will send personalized product suggestions based on your evolving skin needs
              </p>
            </div>
          )}

          {formData.notifications.weeklyTips && (
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
              <p className="text-gray-300">
                <span className="text-green-400 font-medium">Education:</span>
                Weekly Korean beauty insights and ingredient education to enhance your skincare knowledge
              </p>
            </div>
          )}

          {!formData.notifications.emailUpdates && (
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
              <p className="text-yellow-300">
                <span className="text-yellow-400 font-medium">Note:</span>
                You may miss important account and security updates with email notifications disabled
              </p>
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Integration (Future) */}
      <div className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-400 mb-4 flex items-center">
          <Smartphone className="w-5 h-5 mr-2" />
          WhatsApp Notifications (Coming Soon)
        </h3>
        <p className="text-gray-500 text-sm">
          Soon you'll be able to receive Bailey's recommendations and place orders directly through WhatsApp
          for a more personal shopping experience.
        </p>
      </div>
    </div>
  )
}