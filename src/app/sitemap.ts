import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { toSlug } from '@/lib/utils/slug'
import { BEST_OF_SLUGS } from '@/lib/catalog/categories'
import {
  excludePollutedIngredientRows,
  isPollutedIngredientName,
} from '@/lib/pipeline/ingredient-parser'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Re-generate at most once per hour


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
  const bestOfPages: MetadataRoute.Sitemap = BEST_OF_SLUGS.map((cat) => ({
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

    /**
     * Page through a query. PostgREST caps an unpaginated select at 1,000 rows
     * by DEFAULT and reports no error — so the sitemap was silently truncated
     * mid-alphabet (it ended at "water"), publishing ~1,000 of 12,863 eligible
     * ingredient URLs and ~1,000 of 5,946 products. That predates the
     * is_active fix and is why simply dropping the filter recovered nothing:
     * the cap, not the filter, was the binding constraint.
     *
     * A silent row cap is the same class as a swallowed error — the result
     * looks complete and is not.
     */
    const fetchAll = async <T>(
      build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
    ): Promise<T[]> => {
      const PAGE = 1000
      const out: T[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await build(from, from + PAGE - 1)
        if (error) {
          console.error('[sitemap] page fetch failed', { from, error: error.message })
          break
        }
        if (!data?.length) break
        out.push(...data)
        if (data.length < PAGE) break
        // Backstop against an unbounded loop if a filter ever stops narrowing.
        if (out.length >= 50_000) break
      }
      return out
    }

    // Blog posts, active ingredients, and products in parallel
    const [blogRes, ingredientsRes, productsRes] = await Promise.all([
      supabase
        .from('ss_content_posts')
        .select('slug, published_at, updated_at')
        .not('published_at', 'is', null)
        .lte('published_at', now.toISOString())
        .order('published_at', { ascending: false }),
      // The sitemap is the AI-citation surface — a submitted URL for an unsplit
      // INCI dump is a page we are actively asking crawlers to index. This query
      // had NO pollution guard, so 15 dump rows were live in it (July 30 2026).
      //
      // `is_active` is NOT a publish flag. Per the schema comment it means
      // "active as in active INGREDIENT vs. inactive" — a functional
      // classification, so water and xanthan gum are legitimately false. Using
      // it as a gate withheld 5,222 real ingredient pages from the sitemap,
      // 198 of them with 100+ product links: Sodium Hyaluronate (2,824),
      // Panthenol (2,440), Allantoin (1,949), Ceramide NP (1,468), Squalane.
      // Every one of those pages already renders 200 with a full product list
      // (sampled and confirmed before this change) — we simply were not
      // telling crawlers they exist, on the one surface that is the moat.
      //
      // The pollution guard is the quality gate and is applied here. This
      // matches what ingredients/[slug]/page.tsx and api/ingredients/search
      // independently converged on: guard for quality, is_active for sort.
      fetchAll<{ name_inci: string; rich_content_generated_at: string | null }>((from, to) =>
        excludePollutedIngredientRows(
          supabase
            .from('ss_ingredients')
            .select('name_inci, rich_content_generated_at')
            .order('name_inci')
        ).range(from, to)
      ),
      fetchAll<{ id: string; updated_at: string | null; rating_avg: number | null; description_en: string | null }>((from, to) =>
        supabase
          .from('ss_products')
          .select('id, updated_at, rating_avg, description_en')
          .not('description_en', 'is', null)
          .order('rating_avg', { ascending: false })
          .range(from, to)
      ),
    ])

    if (blogRes.data) {
      blogPages = blogRes.data.map((p) => ({
        url: `${baseUrl}/blog/${p.slug}`,
        lastModified: new Date(p.updated_at || p.published_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))
    }

    {
      // Deduplicate slugs (some INCI names may produce the same slug)
      const seen = new Set<string>()
      ingredientPages = ingredientsRes
        .map((i) => {
          // The comma-outside-parentheses rule can't be a LIKE pattern, so the
          // SQL guard above cannot catch it — apply the full check in TS too.
          if (isPollutedIngredientName(i.name_inci)) return null
          const slug = toSlug(i.name_inci)
          if (!slug || seen.has(slug)) return null
          seen.add(slug)
          const isEnriched = !!i.rich_content_generated_at
          const changeFreq: 'monthly' | 'yearly' = isEnriched ? 'monthly' : 'yearly'
          return {
            url: `${baseUrl}/ingredients/${slug}`,
            lastModified: i.rich_content_generated_at
              ? new Date(i.rich_content_generated_at)
              : now,
            changeFrequency: changeFreq,
            priority: isEnriched ? 0.8 : 0.4,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    }

    {
      productPages = productsRes.map((p) => {
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
