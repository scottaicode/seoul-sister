import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Package, Star } from 'lucide-react'
import PublicNav from '@/components/layout/PublicNav'
import { proxyImageUrl } from '@/lib/utils/image-proxy'

export const metadata: Metadata = {
  title: 'K-Beauty Product Database | 5,800+ Korean Skincare Products',
  description:
    'Browse 5,800+ Korean skincare products with ingredient analysis, safety ratings, and price comparison. Find the perfect K-beauty products for your skin type.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.seoulsister.com/products' },
  openGraph: {
    title: 'K-Beauty Product Database | Seoul Sister',
    description:
      'Browse 5,800+ Korean skincare products with ingredient analysis, safety ratings, and price comparison.',
    type: 'website',
    url: 'https://www.seoulsister.com/products',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'K-Beauty Product Database | Seoul Sister',
    description:
      'Browse 5,800+ Korean skincare products with ingredient analysis, safety ratings, and price comparison.',
  },
}

export const revalidate = 3600

const CATEGORIES = [
  { slug: 'serum', label: 'Serums' },
  { slug: 'sunscreen', label: 'Sunscreens' },
  { slug: 'moisturizer', label: 'Moisturizers' },
  { slug: 'cleanser', label: 'Cleansers' },
  { slug: 'toner', label: 'Toners' },
  { slug: 'mask', label: 'Masks' },
  { slug: 'essence', label: 'Essences' },
  { slug: 'ampoule', label: 'Ampoules' },
  { slug: 'exfoliator', label: 'Exfoliators' },
  { slug: 'eye_care', label: 'Eye Care' },
  { slug: 'lip_care', label: 'Lip Care' },
  { slug: 'spot_treatment', label: 'Spot Treatments' },
]

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default async function ProductsPage() {
  const supabase = getSupabase()

  // Fetch total count, featured products, and per-category counts in parallel
  const [countRes, featuredRes, ...categoryCountResults] = await Promise.all([
    supabase.from('ss_products').select('id', { count: 'exact', head: true }),
    // Only show products with images from CDN domains that reliably serve
    // cross-origin. Brand-site Shopify storefronts (medicube.us, cosrx.com,
    // theisntree.com) strip CORS headers, triggering Firefox ORB. YesStyle
    // proxy URLs (image.yesstyle.com/api/image?path=...) redirect through
    // img.yesstyle.com which also triggers ORB. Olive Young CDN and Shopify
    // CDN (cdn.shopify.com) are the only reliable cross-origin sources.
    // Also exclude bundles/sets/deals — featured grid should show hero products.
    supabase
      .from('ss_products')
      .select('id, name_en, brand_en, category, rating_avg, review_count, price_usd, image_url, description_en')
      .not('rating_avg', 'is', null)
      .gte('rating_avg', 4.5)
      .not('description_en', 'is', null)
      .not('image_url', 'is', null)
      .or('image_url.ilike.%cdn-image.oliveyoung%,image_url.ilike.%cdn.shopify.com%')
      .not('name_en', 'ilike', '%set%')
      .not('name_en', 'ilike', '%deal%')
      .not('name_en', 'ilike', '%duo%')
      .not('name_en', 'ilike', '%bundle%')
      .not('name_en', 'ilike', '%kit%')
      .order('review_count', { ascending: false })
      .limit(12),
    ...CATEGORIES.map((cat) =>
      supabase
        .from('ss_products')
        .select('id', { count: 'exact', head: true })
        .eq('category', cat.slug)
    ),
  ])

  const totalCount = countRes.count || 5800
  const featured = featuredRes.data || []

  // Map category counts from parallel queries
  const catCounts: Record<string, number> = {}
  CATEGORIES.forEach((cat, idx) => {
    const count = categoryCountResults[idx]?.count
    if (count && count > 0) catCounts[cat.slug] = count
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://www.seoulsister.com/products#collection',
        name: 'K-Beauty Product Database',
        description:
          'Browse 5,800+ Korean skincare products with ingredient analysis, safety ratings, and price comparison.',
        url: 'https://www.seoulsister.com/products',
        isPartOf: {
          '@type': 'WebSite',
          '@id': 'https://www.seoulsister.com#website',
          name: 'Seoul Sister',
        },
        numberOfItems: totalCount,
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
            name: 'Products',
            item: 'https://www.seoulsister.com/products',
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
        <div className="border-b border-white/10 bg-gradient-to-b from-sky-500/5 to-transparent pt-16">
          <div className="max-w-6xl mx-auto px-4 py-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-sky-500/20 text-sky-300 mb-4">
              <Package className="w-3.5 h-3.5" />
              {totalCount.toLocaleString()} Products
            </div>
            <h1 className="font-display font-bold text-3xl md:text-4xl text-white mb-3">
              K-Beauty Product Database
            </h1>
            <p className="text-white/60 max-w-2xl mx-auto mb-8">
              Every Korean skincare product, analyzed. Ingredient breakdowns,
              safety ratings, price comparison across retailers, and AI-powered
              skin-type matching.
            </p>

            <div className="flex justify-center gap-8 text-sm">
              <div className="text-center">
                <div className="text-xl font-bold text-sky-400">
                  {totalCount.toLocaleString()}
                </div>
                <div className="text-white/50">Products</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-400">590+</div>
                <div className="text-white/50">Brands</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-400">14</div>
                <div className="text-white/50">Categories</div>
              </div>
            </div>
          </div>
        </div>

        {/* Category browse */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h2 className="font-display font-semibold text-lg text-white mb-4">
            Browse by Category
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/products?category=${cat.slug}`}
                className="group bg-white/5 rounded-xl border border-white/10 p-4 text-center hover:border-sky-500/30 hover:bg-white/[0.07] transition-all"
              >
                <div className="font-medium text-sm text-white group-hover:text-sky-400 transition-colors">
                  {cat.label}
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {catCounts[cat.slug]?.toLocaleString() || '—'}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top rated products */}
        <div className="max-w-6xl mx-auto px-4 pb-16">
          <h2 className="font-display font-semibold text-lg text-white mb-2">
            Top Rated Products
          </h2>
          <p className="text-white/50 text-sm mb-6">
            Highest rated K-beauty products based on real Olive Young reviews.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((product, idx) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group block bg-white/5 rounded-xl border border-white/10 p-4 hover:border-sky-500/30 hover:bg-white/[0.07] transition-all"
              >
                <div className="flex items-start gap-3">
                  {product.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={proxyImageUrl(product.image_url) || product.image_url}
                      alt={product.name_en}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      loading="eager"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-white/20" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm text-white group-hover:text-sky-400 transition-colors leading-tight line-clamp-2">
                      {product.name_en}
                    </h3>
                    <p className="text-xs text-white/40 mt-0.5">{product.brand_en}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {product.rating_avg && (
                        <span className="flex items-center gap-1 text-xs">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-white/70">{Number(product.rating_avg).toFixed(1)}</span>
                        </span>
                      )}
                      {product.price_usd && (
                        <span className="text-xs text-white/40">
                          ${Number(product.price_usd).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Subscribe CTA */}
        <div className="border-t border-white/10 bg-gradient-to-b from-sky-500/5 to-transparent">
          <div className="max-w-3xl mx-auto px-4 py-16 text-center">
            <h2 className="font-display font-bold text-2xl text-white mb-3">
              Unlock Full Product Intelligence
            </h2>
            <p className="text-white/60 mb-6 max-w-xl mx-auto">
              Seoul Sister Pro subscribers get personalized skin-type matching,
              AI-powered ingredient analysis, price alerts, counterfeit detection,
              and unlimited access to Yuri, your K-beauty AI advisor.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Start Your K-Beauty Journey — $39.99/mo
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
