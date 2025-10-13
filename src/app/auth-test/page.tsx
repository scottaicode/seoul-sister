'use client'

import { useAuth } from '@/contexts/AuthContext'

export default function AuthTestPage() {
  const { user, userProfile, loading } = useAuth()

  if (loading) {
    return <div className="p-8">Loading auth state...</div>
  }

  return (
    <div className="p-8 bg-black text-white min-h-screen">
      <h1 className="text-2xl mb-4">Authentication Debug</h1>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">User Status:</h2>
          <p>{user ? '✅ Logged In' : '❌ Not Logged In'}</p>
        </div>

        {user && (
          <div>
            <h2 className="text-lg font-semibold">User Info:</h2>
            <pre className="bg-gray-800 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        )}

        {userProfile && (
          <div>
            <h2 className="text-lg font-semibold">User Profile:</h2>
            <pre className="bg-gray-800 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(userProfile, null, 2)}
            </pre>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold">Browser Storage:</h2>
          <p>LocalStorage keys: {typeof window !== 'undefined' ? Object.keys(localStorage).join(', ') : 'N/A'}</p>
        </div>

        <div className="pt-4">
          <a href="/personalized-dashboard" className="bg-blue-500 text-white px-4 py-2 rounded mr-4">
            Go to Dashboard
          </a>
          <a href="/" className="bg-gray-500 text-white px-4 py-2 rounded">
            Go to Home
          </a>
        </div>
      </div>
    </div>
  )
}