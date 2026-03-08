import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { toSlug } from '@/lib/utils/slug'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Re-generate at most once per hour

const BEST_OF_CATEGORIES = [
  'serums',
  'sunscreens',
  'moisturizers',
  'cleansers',
  'toners',
  'masks',
  'essences',
  'ampoules',
  'exfoliators',
  'eye-care',
  'lip-care',
  'spot-treatments',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.seoulsister.com'
  const now = new Date()

  // Static pages (only publicly accessible — auth-gated pages excluded)
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/ingredients`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/best`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  // Best-of category pages
  const bestOfPages: MetadataRoute.Sitemap = BEST_OF_CATEGORIES.map((cat) => ({
    url: `${baseUrl}/best/${cat}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }))

  // Dynamic pages (publicly accessible content)
  let blogPages: MetadataRoute.Sitemap = []
  let ingredientPages: MetadataRoute.Sitemap = []
  let productPages: MetadataRoute.Sitemap = []

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Blog posts, active ingredients, and products in parallel
    const [blogRes, ingredientsRes, productsRes] = await Promise.all([
      supabase
        .from('ss_content_posts')
        .select('slug, published_at, updated_at')
        .not('published_at', 'is', null)
        .lte('published_at', now.toISOString())
        .order('published_at', { ascending: false }),
      supabase
        .from('ss_ingredients')
        .select('name_inci, rich_content_generated_at')
        .eq('is_active', true)
        .order('name_inci'),
      supabase
        .from('ss_products')
        .select('id, updated_at, rating_avg, description_en')
        .not('description_en', 'is', null)
        .order('rating_avg', { ascending: false }),
    ])

    if (blogRes.data) {
      blogPages = blogRes.data.map((p) => ({
        url: `${baseUrl}/blog/${p.slug}`,
        lastModified: new Date(p.updated_at || p.published_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))
    }

    if (ingredientsRes.data) {
      // Deduplicate slugs (some INCI names may produce the same slug)
      const seen = new Set<string>()
      ingredientPages = ingredientsRes.data
        .map((i) => {
          const slug = toSlug(i.name_inci)
          if (!slug || seen.has(slug)) return null
          seen.add(slug)
          const isEnriched = !!i.rich_content_generated_at
          const changeFreq: 'monthly' | 'yearly' = isEnriched ? 'monthly' : 'yearly'
          return {
            url: `${baseUrl}/ingredients/${slug}`,
            lastModified: isEnriched
              ? new Date(i.rich_content_generated_at)
              : now,
            changeFrequency: changeFreq,
            priority: isEnriched ? 0.8 : 0.4,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    }

    if (productsRes.data) {
      productPages = productsRes.data.map((p) => {
        const hasRichContent = !!p.description_en && !!p.rating_avg
        return {
          url: `${baseUrl}/products/${p.id}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : now,
          changeFrequency: 'weekly' as const,
          priority: hasRichContent ? 0.7 : 0.5,
        }
      })
    }
  } catch {
    // Sitemap generation should never fail the build
  }

  return [
    ...staticPages,
    ...bestOfPages,
    { url: `${baseUrl}/products`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 },
    ...blogPages,
    ...ingredientPages,
    ...productPages,
  ]
}
