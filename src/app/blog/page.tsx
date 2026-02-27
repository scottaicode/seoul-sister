import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import BlogListing from './BlogListing'

export const metadata: Metadata = {
  title: 'K-Beauty Blog',
  description:
    'Expert guides, ingredient deep-dives, and trend reports for K-beauty enthusiasts. Discover the latest in Korean skincare.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.seoulsister.com/blog' },
  openGraph: {
    title: 'K-Beauty Blog | Seoul Sister',
    description:
      'Expert guides, ingredient deep-dives, and trend reports for K-beauty enthusiasts.',
    type: 'website',
    url: 'https://www.seoulsister.com/blog',
    images: [{ url: 'https://www.seoulsister.com/icons/icon-512.svg', alt: 'Seoul Sister' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'K-Beauty Blog | Seoul Sister',
    description:
      'Expert guides, ingredient deep-dives, and trend reports for K-beauty enthusiasts.',
    images: ['https://www.seoulsister.com/icons/icon-512.svg'],
  },
}

export const revalidate = 600

export interface BlogPost {
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

  const blogListingSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://www.seoulsister.com/blog#collection',
        name: 'K-Beauty Blog',
        description:
          'Expert guides, ingredient deep-dives, and trend reports for K-beauty enthusiasts.',
        url: 'https://www.seoulsister.com/blog',
        isPartOf: {
          '@type': 'WebSite',
          '@id': 'https://www.seoulsister.com#website',
          name: 'Seoul Sister',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://www.seoulsister.com',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: 'https://www.seoulsister.com/blog',
          },
        ],
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListingSchema) }}
      />
      <BlogListing posts={blogPosts} />
    </>
  )
}
