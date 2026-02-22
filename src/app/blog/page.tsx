import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Calendar, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'K-Beauty Blog',
  description:
    'Expert guides, ingredient deep-dives, and trend reports for K-beauty enthusiasts. Discover the latest in Korean skincare.',
  openGraph: {
    title: 'K-Beauty Blog | Seoul Sister',
    description:
      'Expert guides, ingredient deep-dives, and trend reports for K-beauty enthusiasts.',
    type: 'website',
    url: 'https://seoulsister.com/blog',
  },
}

export const revalidate = 3600

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string | null
  featured_image_url: string | null
  read_time_minutes: number | null
  published_at: string
}

export default async function BlogPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: posts } = await supabase
    .from('ss_content_posts')
    .select(
      'id, title, slug, excerpt, category, featured_image_url, read_time_minutes, published_at'
    )
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(50)

  const blogPosts = (posts || []) as BlogPost[]

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Link
            href="/"
            className="text-amber-400 hover:text-amber-300 transition-colors text-sm mb-4 inline-block"
          >
            Seoul Sister
          </Link>
          <h1 className="font-display font-bold text-4xl text-white mb-3">
            K-Beauty Intelligence
          </h1>
          <p className="text-white/60 text-lg">
            Expert guides, ingredient deep-dives, and trend reports for K-beauty
            enthusiasts.
          </p>
        </div>
      </div>

      {/* Post Grid */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {blogPosts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white/40 text-lg mb-2">No posts yet.</p>
            <p className="text-white/30 text-sm">Check back soon for K-beauty insights.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {blogPosts.map((post) => (
              <article
                key={post.id}
                className="group bg-white/5 rounded-2xl overflow-hidden border border-white/10 hover:border-amber-500/30 transition-colors"
              >
                <Link href={`/blog/${post.slug}`} className="block">
                  {post.featured_image_url && (
                    <div className="aspect-[2/1] overflow-hidden">
                      <img
                        src={post.featured_image_url}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    {post.category && (
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 mb-3">
                        {post.category}
                      </span>
                    )}
                    <h2 className="font-display font-semibold text-xl text-white mb-2 group-hover:text-amber-400 transition-colors">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-white/60 text-sm line-clamp-2 mb-4">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-white/40 text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(post.published_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      {post.read_time_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {post.read_time_minutes} min read
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
