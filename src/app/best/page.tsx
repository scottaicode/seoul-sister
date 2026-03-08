import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Trophy, ArrowRight } from 'lucide-react'
import PublicNav from '@/components/layout/PublicNav'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Best Korean Skincare Products (2026) | Ranked by Real Reviews',
  description:
    'Find the best Korean skincare products across every category — serums, sunscreens, moisturizers, cleansers, and more. Ranked by real Olive Young reviews with full ingredient analysis.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.seoulsister.com/best' },
  openGraph: {
    title: 'Best Korean Skincare Products | Seoul Sister',
    description:
      'The best K-beauty products in every category, ranked by real reviews with ingredient analysis and price comparison.',
    type: 'website',
    url: 'https://www.seoulsister.com/best',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Korean Skincare Products | Seoul Sister',
    description:
      'The best K-beauty products in every category, ranked by real reviews with ingredient analysis and price comparison.',
  },
}

interface CategoryInfo {
  slug: string
  dbCategory: string
  title: string
  description: string
}

const CATEGORIES: CategoryInfo[] = [
  { slug: 'serums', dbCategory: 'serum', title: 'Best Korean Serums', description: 'Vitamin C, niacinamide, hyaluronic acid, retinol serums' },
  { slug: 'sunscreens', dbCategory: 'sunscreen', title: 'Best Korean Sunscreens', description: 'PA++++, minimal white cast, lightweight textures' },
  { slug: 'moisturizers', dbCategory: 'moisturizer', title: 'Best Korean Moisturizers', description: 'Gel creams, barrier repair, rich creams for every skin type' },
  { slug: 'cleansers', dbCategory: 'cleanser', title: 'Best Korean Cleansers', description: 'Oil cleansers, foam washes, double-cleansing essentials' },
  { slug: 'toners', dbCategory: 'toner', title: 'Best Korean Toners', description: 'Hydrating toners, essence toners, exfoliating toners' },
  { slug: 'masks', dbCategory: 'mask', title: 'Best Korean Face Masks', description: 'Sheet masks, sleeping masks, clay masks, wash-off masks' },
  { slug: 'essences', dbCategory: 'essence', title: 'Best Korean Essences', description: 'The signature K-beauty step for deep hydration' },
  { slug: 'ampoules', dbCategory: 'ampoule', title: 'Best Korean Ampoules', description: 'Concentrated treatments for targeted concerns' },
  { slug: 'exfoliators', dbCategory: 'exfoliator', title: 'Best Korean Exfoliators', description: 'AHA, BHA, PHA peeling pads and gels' },
  { slug: 'eye-care', dbCategory: 'eye_care', title: 'Best Korean Eye Creams', description: 'Dark circles, fine lines, puffiness solutions' },
  { slug: 'lip-care', dbCategory: 'lip_care', title: 'Best Korean Lip Care', description: 'Lip balms, lip masks, lip treatments' },
  { slug: 'spot-treatments', dbCategory: 'spot_treatment', title: 'Best Korean Spot Treatments', description: 'Pimple patches, acne treatments, dark spot correctors' },
]

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default async function BestOfIndexPage() {
  const supabase = getSupabase()

  // Fetch counts + top product per category in parallel
  const categoryData = await Promise.all(
    CATEGORIES.map(async (cat) => {
      const [countRes, topRes] = await Promise.all([
        supabase
          .from('ss_products')
          .select('id', { count: 'exact', head: true })
          .eq('category', cat.dbCategory),
        supabase
          .from('ss_products')
          .select('name_en, brand_en, rating_avg')
          .eq('category', cat.dbCategory)
          .not('rating_avg', 'is', null)
          .order('rating_avg', { ascending: false })
          .order('review_count', { ascending: false, nullsFirst: false })
          .limit(1),
      ])
      return {
        ...cat,
        count: countRes.count || 0,
        topProduct: topRes.data?.[0] || null,
      }
    })
  )

  const totalProducts = categoryData.reduce((sum, c) => sum + c.count, 0)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://www.seoulsister.com/best#collection',
        name: 'Best Korean Skincare Products',
        description:
          'The best K-beauty products in every category, ranked by real reviews with ingredient analysis and price comparison.',
        url: 'https://www.seoulsister.com/best',
        numberOfItems: totalProducts,
        isPartOf: {
          '@type': 'WebSite',
          '@id': 'https://www.seoulsister.com#website',
          name: 'Seoul Sister',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.seoulsister.com' },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Best Products',
            item: 'https://www.seoulsister.com/best',
          },
        ],
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-[#0a0a0a]">
        <PublicNav />

        {/* Hero */}
        <div className="border-b border-white/10 bg-gradient-to-b from-amber-500/5 to-transparent pt-16">
          <div className="max-w-6xl mx-auto px-4 py-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 mb-4">
              <Trophy className="w-3.5 h-3.5" />
              {totalProducts.toLocaleString()} Products Ranked
            </div>
            <h1 className="font-display font-bold text-3xl md:text-4xl text-white mb-3">
              Best Korean Skincare Products
            </h1>
            <p className="text-white/60 max-w-2xl mx-auto">
              Every category ranked by real Olive Young reviews. Full ingredient analysis,
              safety ratings, and price comparison across 6 retailers.
            </p>
          </div>
        </div>

        {/* Category Grid */}
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryData.map((cat) => (
              <Link
                key={cat.slug}
                href={`/best/${cat.slug}`}
                className="group block bg-white/5 rounded-xl border border-white/10 p-5 hover:border-amber-500/30 hover:bg-white/[0.07] transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-display font-semibold text-white group-hover:text-amber-400 transition-colors">
                    {cat.title}
                  </h2>
                  <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-amber-400/50 transition-colors mt-1" />
                </div>
                <p className="text-sm text-white/50 mb-3">{cat.description}</p>
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span>{cat.count.toLocaleString()} products</span>
                  {cat.topProduct && (
                    <span className="text-amber-400/60 truncate ml-2">
                      #1: {cat.topProduct.brand_en}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
