'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ApifyResult {
  id: string
  shortCode: string
  url: string
  displayUrl: string
  caption: string
  hashtags: string[]
  likesCount: number
  commentsCount: number
  timestamp: string
  ownerUsername: string
  videoUrl?: string
  isVideo: boolean
}

export default function TestApifyPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<ApifyResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [testUsername, setTestUsername] = useState('ponysmakeup')

  const testInstagramScraping = async () => {
    setIsLoading(true)
    setError(null)
    setResults([])

    try {
      console.log(`🔍 Testing Instagram scraping for @${testUsername}`)

      const response = await fetch('/api/test-apify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: testUsername,
          maxPosts: 10
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape Instagram')
      }

      if (data.success) {
        setResults(data.posts || [])
        console.log(`✅ Successfully scraped ${data.posts?.length || 0} posts`)
      } else {
        throw new Error(data.error || 'Scraping failed')
      }

    } catch (err) {
      console.error('❌ Instagram scraping test failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center space-x-4">
          <Link href="/intelligence/enhanced" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-semibold">Apify Instagram Scraping Test</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Test Controls */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Instagram Scraping Test</h2>

          <div className="flex items-center space-x-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Instagram Username (without @)
              </label>
              <input
                type="text"
                value={testUsername}
                onChange={(e) => setTestUsername(e.target.value)}
                placeholder="ponysmakeup"
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white w-64"
              />
            </div>

            <div className="pt-6">
              <button
                onClick={testInstagramScraping}
                disabled={isLoading || !testUsername}
                className="bg-luxury-gold text-black px-6 py-2 rounded font-medium hover:bg-luxury-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Scraping...' : 'Test Instagram Scraping'}
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="text-sm text-gray-400">
            <p>• Using Apify Instagram Scraper (shu8hvrXbJbY3Eb9W)</p>
            <p>• API Key: {process.env.NEXT_PUBLIC_APIFY_API_KEY ? 'Configured ✅' : 'Missing ❌'}</p>
            <p>• Target: Recent posts from @{testUsername}</p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 mb-6">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
              <span className="text-blue-400">Scraping Instagram posts for @{testUsername}...</span>
            </div>
            <p className="text-sm text-gray-400 mt-2">This may take 30-60 seconds depending on account privacy settings</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-6">
            <h3 className="text-red-400 font-medium mb-2">❌ Scraping Failed</h3>
            <p className="text-red-300 text-sm">{error}</p>
            <details className="mt-3">
              <summary className="text-red-400 cursor-pointer text-sm">Debug Information</summary>
              <div className="mt-2 text-xs text-gray-400 bg-black/50 p-3 rounded">
                <p>Common issues:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Instagram account is private</li>
                  <li>Rate limiting or IP blocking</li>
                  <li>Invalid username</li>
                  <li>Apify API key issues</li>
                </ul>
              </div>
            </details>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
            <h3 className="text-green-400 font-medium mb-4">
              ✅ Successfully Scraped {results.length} Posts from @{testUsername}
            </h3>

            <div className="grid gap-4">
              {results.map((post, index) => (
                <div key={post.id || index} className="bg-black/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-white">Post {index + 1}</h4>
                      <p className="text-sm text-gray-400">ID: {post.shortCode}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">
                        {post.isVideo ? '🎬 Video' : '📸 Photo'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(post.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Caption */}
                  {post.caption && (
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-300 mb-1">Caption:</div>
                      <p className="text-sm text-gray-400 line-clamp-3">
                        {post.caption.length > 200
                          ? post.caption.substring(0, 200) + '...'
                          : post.caption
                        }
                      </p>
                    </div>
                  )}

                  {/* Hashtags */}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-300 mb-1">Hashtags:</div>
                      <div className="flex flex-wrap gap-1">
                        {post.hashtags.map((tag, i) => (
                          <span key={i} className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metrics */}
                  <div className="mb-3">
                    <div className="text-sm font-medium text-gray-300 mb-1">Engagement:</div>
                    <div className="flex space-x-4 text-sm text-gray-400">
                      <span>❤️ {post.likesCount?.toLocaleString() || 0}</span>
                      <span>💬 {post.commentsCount?.toLocaleString() || 0}</span>
                    </div>
                  </div>

                  {/* URLs */}
                  <div className="flex space-x-4 text-sm">
                    {post.url && (
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-luxury-gold hover:text-luxury-gold/80 transition-colors"
                      >
                        View Post →
                      </a>
                    )}
                    {post.videoUrl && (
                      <a
                        href={post.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Video URL →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <h4 className="font-medium text-green-400 mb-2">Scraping Summary:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Total Posts</div>
                  <div className="text-white font-medium">{results.length}</div>
                </div>
                <div>
                  <div className="text-gray-400">Videos</div>
                  <div className="text-white font-medium">
                    {results.filter(p => p.isVideo).length}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Total Likes</div>
                  <div className="text-white font-medium">
                    {results.reduce((sum, p) => sum + (p.likesCount || 0), 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Unique Hashtags</div>
                  <div className="text-white font-medium">
                    {new Set(results.flatMap(p => p.hashtags || [])).size}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Results */}
        {!isLoading && !error && results.length === 0 && (
          <div className="bg-gray-900 rounded-lg p-6 text-center">
            <p className="text-gray-400">Click "Test Instagram Scraping" to begin</p>
          </div>
        )}
      </div>
    </div>
  )
}