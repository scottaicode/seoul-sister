'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { BlogPost } from './page'

// Category badge colors matching Seoul Sister's amber/gold palette
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  sunscreen: { bg: 'bg-amber-500/20', text: 'text-amber-300' },
  ingredients: { bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
  routines: { bg: 'bg-violet-500/20', text: 'text-violet-300' },
  trends: { bg: 'bg-rose-500/20', text: 'text-rose-300' },
  reviews: { bg: 'bg-sky-500/20', text: 'text-sky-300' },
  guides: { bg: 'bg-teal-500/20', text: 'text-teal-300' },
  comparison: { bg: 'bg-yellow-500/20', text: 'text-yellow-300' },
  skincare: { bg: 'bg-pink-500/20', text: 'text-pink-300' },
}

const DEFAULT_CATEGORY = { bg: 'bg-white/10', text: 'text-white/70' }

function getCategoryStyle(category: string) {
  return CATEGORY_COLORS[category.toLowerCase()] || DEFAULT_CATEGORY
}

function formatCategory(category: string): string {
  return category
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function BlogListing({ posts }: { posts: BlogPost[] }) {
  const [activeCategory, setActiveCategory] = useState<string>('')
  const { user } = useAuth()

  // Extract unique categories
  const categories = Array.from(
    new Set(posts.map((p) => p.category || 'general').filter(Boolean))
  )

  const filteredPosts = activeCategory
    ? posts.filter((p) => (p.category || 'general') === activeCategory)
    : posts

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/icons/icon-512.svg"
              alt="Seoul Sister"
              className="h-8 w-8"
            />
            <span className="font-display font-semibold text-white text-sm hidden sm:inline">
              Seoul Sister
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href={user ? '/dashboard' : '/'}
              className="text-white/60 hover:text-gold transition-colors text-sm font-medium"
            >
              {user ? 'Dashboard' : 'Home'}
            </Link>
            <Link
              href="/blog"
              className="text-gold font-medium text-sm"
            >
              Blog
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-10 text-center px-4">
        <h1 className="font-display font-bold text-3xl md:text-4xl text-white mb-3">
          K-Beauty{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold to-gold-light">
            Intelligence
          </span>
        </h1>
        <p className="text-white/50 text-base md:text-lg max-w-xl mx-auto">
          Expert guides, ingredient deep-dives, and trend reports for K-beauty
          enthusiasts.
        </p>

        {/* Category Filters */}
        {categories.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            <button
              onClick={() => setActiveCategory('')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === ''
                  ? 'bg-gold text-[#0a0a0a]'
                  : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white'
              }`}
            >
              All Posts
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeCategory === cat
                    ? 'bg-gold text-[#0a0a0a]'
                    : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white'
                }`}
              >
                {formatCategory(cat)}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Posts Grid */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">
              {activeCategory ? '🔍' : '✍️'}
            </div>
            <h3 className="text-white font-display font-semibold text-lg mb-2">
              {activeCategory ? 'No posts in this category' : 'No posts yet'}
            </h3>
            <p className="text-white/40 text-sm">
              {activeCategory
                ? 'Try selecting a different category.'
                : 'Check back soon for K-beauty insights.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => {
              const catStyle = getCategoryStyle(post.category || 'general')
              return (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group bg-white/[0.04] rounded-2xl overflow-hidden border border-white/10
                    hover:border-gold/30 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(201,165,92,0.08)]
                    transition-all duration-300"
                >
                  {/* Hero Image */}
                  {post.featured_image_url ? (
                    <div className="aspect-[16/9] overflow-hidden">
                      <img
                        src={post.featured_image_url}
                        alt={post.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-gradient-to-br from-gold/10 to-rose-gold/10 flex items-center justify-center">
                      <span className="text-3xl opacity-40">✨</span>
                    </div>
                  )}

                  {/* Card Content */}
                  <div className="p-5">
                    {/* Category + Date row */}
                    <div className="flex items-center gap-3 mb-3">
                      {post.category && (
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${catStyle.bg} ${catStyle.text}`}
                        >
                          {formatCategory(post.category)}
                        </span>
                      )}
                      <span className="text-white/30 text-xs">
                        {new Date(post.published_at).toLocaleDateString(
                          'en-US',
                          { month: 'short', day: 'numeric', year: 'numeric' }
                        )}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="font-display font-semibold text-[1.05rem] leading-snug text-white mb-2 line-clamp-2 group-hover:text-gold transition-colors duration-200">
                      {post.title}
                    </h2>

                    {/* Excerpt */}
                    {post.excerpt && (
                      <p className="text-white/45 text-sm leading-relaxed line-clamp-3 mb-4">
                        {post.excerpt}
                      </p>
                    )}

                    {/* Footer: Read time + Read more */}
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-3 text-white/30 text-xs">
                        {post.read_time_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {post.read_time_minutes} min read
                          </span>
                        )}
                      </div>
                      <span className="text-gold/70 text-sm font-medium group-hover:text-gold transition-colors">
                        Read more &rarr;
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-gradient-to-r from-gold/10 to-rose-gold/10 rounded-2xl p-10 border border-gold/20">
            <h2 className="font-display font-semibold text-xl text-white mb-2">
              Want personalized K-beauty advice?
            </h2>
            <p className="text-white/50 mb-6 text-sm">
              {user
                ? 'Chat with Yuri, your AI beauty advisor, for recommendations tailored to your skin.'
                : 'Sign up to chat with Yuri, our AI beauty advisor, for recommendations tailored to your skin.'}
            </p>
            <Link
              href={user ? '/yuri' : '/register'}
              className="inline-flex items-center justify-center px-8 py-3 rounded-full
                bg-gradient-to-r from-gold to-gold-light text-[#0a0a0a] font-semibold text-sm
                hover:shadow-glow-gold hover:brightness-110 transition-all duration-300 active:scale-[0.98]"
            >
              {user ? 'Talk to Yuri' : 'Get Started Free'}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-white/30 text-xs">
            &copy; {new Date().getFullYear()} Seoul Sister. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
