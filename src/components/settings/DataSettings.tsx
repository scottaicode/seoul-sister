'use client'

import { useState } from 'react'
import { BaileyUserProfile } from '@/types/bailey-profile'
import { Database, Download, Trash2, Shield, Eye, AlertTriangle } from 'lucide-react'

interface DataSettingsProps {
  profile: Partial<BaileyUserProfile> | null
  onUpdate: (data: Partial<BaileyUserProfile>) => void
  userEmail?: string
}

export default function DataSettings({ profile, userEmail }: DataSettingsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleExportData = async () => {
    setExportLoading(true)
    try {
      // Create comprehensive data export
      const exportData = {
        profile,
        metadata: {
          exportDate: new Date().toISOString(),
          userEmail,
          dataVersion: '1.0'
        },
        privacy: {
          dataRetentionPolicy: '2 years from last activity',
          sharingPolicy: 'No data shared with third parties',
          analyticsUsage: 'Anonymized usage analytics only'
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bailey-profile-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExportLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    try {
      const response = await fetch('/api/bailey-profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail })
      })

      if (response.ok) {
        // Redirect to home page or show success message
        window.location.href = '/'
      } else {
        throw new Error('Failed to delete account')
      }
    } catch (error) {
      console.error('Delete failed:', error)
    } finally {
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-light text-white mb-2">Data & Privacy</h2>
        <p className="text-gray-400">
          Manage your personal data, privacy settings, and account preferences
        </p>
      </div>

      {/* Privacy Overview */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Shield className="w-5 h-5 mr-2" />
          Privacy Commitment
        </h3>
        <div className="space-y-4 text-sm">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
            <p className="text-gray-300">
              <span className="text-green-400 font-medium">Data Encryption:</span>
              All your personal information is encrypted both in transit and at rest
            </p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
            <p className="text-gray-300">
              <span className="text-green-400 font-medium">No Third-Party Sharing:</span>
              Your skin analysis and preferences are never shared with external companies
            </p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
            <p className="text-gray-300">
              <span className="text-green-400 font-medium">AI Processing:</span>
              Bailey's recommendations are generated using your data locally and securely
            </p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
            <p className="text-gray-300">
              <span className="text-blue-400 font-medium">Analytics:</span>
              Only anonymized usage patterns are collected to improve the platform
            </p>
          </div>
        </div>
      </div>

      {/* Data Visibility */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Eye className="w-5 h-5 mr-2" />
          Your Data Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-300">Profile Information</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Personal details (name, age, location)</li>
              <li>• Skin type and concerns analysis</li>
              <li>• Lifestyle and medical information</li>
              <li>• Product preferences and goals</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-gray-300">Usage Data</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Bailey interaction history</li>
              <li>• Product recommendation engagement</li>
              <li>• Settings and preference changes</li>
              <li>• Account activity timestamps</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Data Export */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Download className="w-5 h-5 mr-2" />
          Export Your Data
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Download a complete copy of your profile data, preferences, and interaction history.
          This includes all information Bailey uses to create your personalized recommendations.
        </p>
        <button
          onClick={handleExportData}
          disabled={exportLoading}
          className="flex items-center space-x-2 px-6 py-3 bg-[#d4a574] text-black rounded-lg hover:bg-[#d4a574]/90 transition-colors disabled:opacity-50"
        >
          <Download className="w-5 h-5" />
          <span>{exportLoading ? 'Preparing Export...' : 'Export My Data'}</span>
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Downloads as JSON file containing all your profile information
        </p>
      </div>

      {/* Data Retention */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Database className="w-5 h-5 mr-2" />
          Data Retention Policy
        </h3>
        <div className="space-y-4 text-sm">
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h4 className="font-medium text-gray-300 mb-2">Active Account</h4>
            <p className="text-gray-400">
              Your data is retained to provide personalized recommendations and track your skincare journey progress.
              Profile data is continuously updated to reflect your evolving skin needs.
            </p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h4 className="font-medium text-gray-300 mb-2">Inactive Account</h4>
            <p className="text-gray-400">
              If your account remains inactive for 2 years, your personal data will be automatically deleted.
              You'll receive email notifications before this occurs.
            </p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h4 className="font-medium text-gray-300 mb-2">Account Deletion</h4>
            <p className="text-gray-400">
              When you delete your account, all personal data is immediately removed from our systems.
              Only anonymized analytics data may be retained for platform improvement.
            </p>
          </div>
        </div>
      </div>

      {/* Delete Account */}
      <div className="bg-red-900/20 border border-red-400/30 rounded-lg p-6">
        <h3 className="text-lg font-medium text-red-400 mb-4 flex items-center">
          <Trash2 className="w-5 h-5 mr-2" />
          Delete Account
        </h3>

        {!showDeleteConfirm ? (
          <>
            <p className="text-gray-400 text-sm mb-4">
              Permanently delete your Seoul Sister account and all associated data. This action cannot be undone.
            </p>
            <div className="space-y-2 text-sm text-gray-400 mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span>All profile data and recommendations will be lost</span>
              </div>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span>Your skincare journey history cannot be recovered</span>
              </div>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span>Active subscriptions will be cancelled</span>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete My Account
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-red-300 font-medium">
              Are you absolutely sure you want to delete your account?
            </p>
            <p className="text-gray-400 text-sm">
              This will permanently delete your profile, skincare analysis, and all recommendations.
              Consider exporting your data first if you might want it later.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete Everything'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legal Links */}
      <div className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-400 mb-4">Legal & Compliance</h3>
        <div className="flex flex-wrap gap-6 text-sm">
          <a href="/privacy" className="text-[#d4a574] hover:text-[#d4a574]/80 transition-colors">
            Privacy Policy
          </a>
          <a href="/terms" className="text-[#d4a574] hover:text-[#d4a574]/80 transition-colors">
            Terms of Service
          </a>
          <a href="/gdpr" className="text-[#d4a574] hover:text-[#d4a574]/80 transition-colors">
            GDPR Rights
          </a>
          <a href="/contact" className="text-[#d4a574] hover:text-[#d4a574]/80 transition-colors">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  )
}