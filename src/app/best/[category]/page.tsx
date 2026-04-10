import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Star, TrendingUp, FlaskConical, Shield, ArrowRight } from 'lucide-react'
import PublicNav from '@/components/layout/PublicNav'
import { notFound } from 'next/navigation'
import { toSlug } from '@/lib/utils/slug'
import LazyImage from '@/components/ui/LazyImage'

export const revalidate = 3600

interface Props {
  params: Promise<{ category: string }>
}

interface CategoryMeta {
  slug: string
  dbCategory: string
  title: string
  h1: string
  description: string
  skinTip: string
  keyIngredients: string[]
}

const CATEGORIES: CategoryMeta[] = [
  {
    slug: 'serums',
    dbCategory: 'serum',
    title: 'Best Korean Serums',
    h1: 'Best Korean Serums in 2026',
    description:
      'Find the best Korean serums ranked by real Olive Young ratings. Vitamin C, niacinamide, hyaluronic acid, retinol, and more — with full ingredient analysis and price comparison.',
    skinTip:
      'Apply serums after toner and before moisturizer. Wait 1-2 minutes between active serums (vitamin C, retinol, AHAs) to let each absorb.',
    keyIngredients: ['Niacinamide', 'Hyaluronic Acid', 'Vitamin C', 'Retinol', 'Centella Asiatica'],
  },
  {
    slug: 'sunscreens',
    dbCategory: 'sunscreen',
    title: 'Best Korean Sunscreens',
    h1: 'Best Korean Sunscreens in 2026',
    description:
      'The highest-rated Korean sunscreens with PA++++, minimal white cast, and lightweight textures. Compared across Olive Young, YesStyle, and Soko Glam.',
    skinTip:
      'Korean sunscreens lead the world in elegance. Look for PA++++ (highest UVA protection) and reapply every 2 hours during sun exposure.',
    keyIngredients: ['Zinc Oxide', 'Tinosorb S', 'Niacinamide', 'Centella Asiatica', 'Hyaluronic Acid'],
  },
  {
    slug: 'moisturizers',
    dbCategory: 'moisturizer',
    title: 'Best Korean Moisturizers',
    h1: 'Best Korean Moisturizers in 2026',
    description:
      'Top-rated Korean moisturizers for every skin type — gel creams for oily skin, rich creams for dry skin, and barrier-repair formulas for sensitive skin.',
    skinTip:
      'Layer moisturizer as the last step before sunscreen (AM) or sleeping mask (PM). For oily skin, gel-cream textures absorb faster without clogging pores.',
    keyIngredients: ['Ceramide NP', 'Squalane', 'Shea Butter', 'Panthenol', 'Centella Asiatica'],
  },
  {
    slug: 'cleansers',
    dbCategory: 'cleanser',
    title: 'Best Korean Cleansers',
    h1: 'Best Korean Cleansers in 2026',
    description:
      'From oil cleansers to gentle foam washes — the best Korean cleansers for double cleansing, acne-prone skin, and sensitive skin types.',
    skinTip:
      'Double cleansing is the foundation of K-beauty. Use an oil cleanser first to remove sunscreen and makeup, then a water-based cleanser for a deep clean.',
    keyIngredients: ['Green Tea Extract', 'Centella Asiatica', 'Salicylic Acid', 'Rice Bran', 'Tea Tree Oil'],
  },
  {
    slug: 'toners',
    dbCategory: 'toner',
    title: 'Best Korean Toners',
    h1: 'Best Korean Toners in 2026',
    description:
      'The best Korean toners for hydration, pH balancing, and prepping skin for the rest of your routine. Includes essence toners, exfoliating toners, and more.',
    skinTip:
      'Korean toners are about hydration, not astringency. Apply by pressing into skin with palms (not cotton pads) to maximize absorption.',
    keyIngredients: ['Hyaluronic Acid', 'Niacinamide', 'Centella Asiatica', 'Glycerin', 'Beta-Glucan'],
  },
  {
    slug: 'masks',
    dbCategory: 'mask',
    title: 'Best Korean Face Masks',
    h1: 'Best Korean Face Masks in 2026',
    description:
      'Sheet masks, sleeping masks, wash-off masks, and clay masks — the best Korean face masks ranked by thousands of reviews on Olive Young.',
    skinTip:
      'Sheet masks deliver concentrated ingredients in 15-20 minutes. Use 2-3 times per week after toner. Pat remaining essence into skin — never rinse.',
    keyIngredients: ['Centella Asiatica', 'Hyaluronic Acid', 'Tea Tree Oil', 'Snail Mucin', 'Vitamin C'],
  },
  {
    slug: 'essences',
    dbCategory: 'essence',
    title: 'Best Korean Essences',
    h1: 'Best Korean Essences in 2026',
    description:
      'The signature K-beauty step. Best Korean essences for hydration, brightening, and anti-aging — lightweight formulas that transform your routine.',
    skinTip:
      'Essence goes after toner and before serum. It is the most uniquely Korean step in K-beauty — a lightweight, hydrating layer that preps skin to absorb everything that follows.',
    keyIngredients: ['Galactomyces', 'Bifida Ferment Lysate', 'Snail Secretion Filtrate', 'Niacinamide', 'Propolis'],
  },
  {
    slug: 'ampoules',
    dbCategory: 'ampoule',
    title: 'Best Korean Ampoules',
    h1: 'Best Korean Ampoules in 2026',
    description:
      'Concentrated treatment ampoules with higher active ingredient percentages than serums. The best Korean ampoules for acne, dark spots, and aging.',
    skinTip:
      'Ampoules are more concentrated than serums — use them as intensive treatments for specific concerns. Apply after essence, before moisturizer.',
    keyIngredients: ['Peptides', 'Retinol', 'Vitamin C', 'Centella Asiatica', 'PDRN'],
  },
  {
    slug: 'exfoliators',
    dbCategory: 'exfoliator',
    title: 'Best Korean Exfoliators',
    h1: 'Best Korean Exfoliators in 2026',
    description:
      'Chemical and physical exfoliators from Korea — AHA, BHA, PHA peeling pads, gels, and scrubs for smoother, brighter skin.',
    skinTip:
      'Korean exfoliators favor chemical exfoliation (AHA/BHA/PHA) over physical scrubs. Start with 1-2 times per week and increase gradually.',
    keyIngredients: ['Glycolic Acid', 'Salicylic Acid', 'Lactic Acid', 'PHA', 'Green Tea Extract'],
  },
  {
    slug: 'eye-care',
    dbCategory: 'eye_care',
    title: 'Best Korean Eye Creams',
    h1: 'Best Korean Eye Creams in 2026',
    description:
      'Top-rated Korean eye creams and patches for dark circles, fine lines, and puffiness. Lightweight formulas that absorb fast without milia.',
    skinTip:
      'Apply eye cream with your ring finger using gentle tapping motions. The skin around the eye is the thinnest on the body — never rub or pull.',
    keyIngredients: ['Peptides', 'Retinol', 'Caffeine', 'Niacinamide', 'Collagen'],
  },
  {
    slug: 'lip-care',
    dbCategory: 'lip_care',
    title: 'Best Korean Lip Care',
    h1: 'Best Korean Lip Care in 2026',
    description:
      'Korean lip balms, lip masks, lip oils, and lip treatments. Repair dry, cracked lips with ceramides, honey, and propolis.',
    skinTip:
      'Apply a lip sleeping mask as your last step at night. Korean lip masks with lanolin and ceramides repair overnight while you sleep.',
    keyIngredients: ['Ceramide NP', 'Shea Butter', 'Lanolin', 'Propolis', 'Honey Extract'],
  },
  {
    slug: 'spot-treatments',
    dbCategory: 'spot_treatment',
    title: 'Best Korean Spot Treatments',
    h1: 'Best Korean Spot Treatments in 2026',
    description:
      'Pimple patches, acne treatments, and dark spot correctors from Korea. The most effective spot treatments ranked by real user reviews.',
    skinTip:
      'Hydrocolloid pimple patches work best on whiteheads — they absorb pus overnight. For cystic acne, look for microneedle patches that deliver actives deeper.',
    keyIngredients: ['Salicylic Acid', 'Centella Asiatica', 'Tea Tree Oil', 'Niacinamide', 'Tranexamic Acid'],
  },
]

function getCategoryMeta(slug: string): CategoryMeta | undefined {
  return CATEGORIES.find((c) => c.slug === slug)
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  const meta = getCategoryMeta(category)
  if (!meta) return { title: 'Category Not Found' }

  return {
    title: `${meta.title} (2026) | Ranked by Real Reviews`,
    description: meta.description,
    robots: { index: true, follow: true },
    alternates: { canonical: `https://www.seoulsister.com/best/${meta.slug}` },
    openGraph: {
      title: `${meta.title} | Seoul Sister`,
      description: meta.description,
      type: 'website',
      url: `https://www.seoulsister.com/best/${meta.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${meta.title} | Seoul Sister`,
      description: meta.description,
    },
  }
}

interface ProductRow {
  id: string
  name_en: string
  brand_en: string
  rating_avg: string | null
  review_count: number | null
  price_usd: string | null
  image_url: string | null
  description_en: string | null
}

export default async function BestOfCategoryPage({ params }: Props) {
  const { category } = await params
  const meta = getCategoryMeta(category)
  if (!meta) notFound()

  const supabase = getSupabase()

  const [productsRes, countRes, brandsRes] = await Promise.all([
    supabase
      .from('ss_products')
      .select('id, name_en, brand_en, rating_avg, review_count, price_usd, image_url, description_en')
      .eq('category', meta.dbCategory)
      .not('rating_avg', 'is', null)
      .order('rating_avg', { ascending: false })
      .order('review_count', { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from('ss_products')
      .select('id', { count: 'exact', head: true })
      .eq('category', meta.dbCategory),
    supabase
      .from('ss_products')
      .select('brand_en')
      .eq('category', meta.dbCategory)
      .not('brand_en', 'is', null),
  ])

  const products = (productsRes.data || []) as ProductRow[]
  const totalCount = countRes.count || 0
  const uniqueBrands = new Set((brandsRes.data || []).map((b) => b.brand_en)).size

  // Build FAQ from data
  const faqQuestions = [
    {
      '@type': 'Question' as const,
      name: `What are the best Korean ${meta.slug}?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: products.length > 0
          ? `The top-rated Korean ${meta.slug} based on Olive Young reviews include ${products
              .slice(0, 3)
              .map((p) => `${p.name_en} by ${p.brand_en} (${Number(p.rating_avg).toFixed(1)} stars)`)
              .join(', ')}. Seoul Sister tracks ${totalCount}+ ${meta.slug} across ${uniqueBrands}+ brands with full ingredient analysis.`
          : `Seoul Sister tracks ${totalCount}+ Korean ${meta.slug} with ingredient analysis and safety ratings.`,
      },
    },
    {
      '@type': 'Question' as const,
      name: `How do I choose a Korean ${meta.slug.replace(/s$/, '')} for my skin type?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: `${meta.skinTip} Seoul Sister's AI advisor Yuri can analyze your skin profile and recommend the best ${meta.slug.replace(/s$/, '')} for your specific skin type, concerns, and climate.`,
      },
    },
    {
      '@type': 'Question' as const,
      name: `What ingredients should I look for in Korean ${meta.slug}?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: `Key ingredients to look for in Korean ${meta.slug} include ${meta.keyIngredients.join(', ')}. Seoul Sister provides ingredient-level analysis for every product, including safety ratings, comedogenic scores, and effectiveness data by skin type.`,
      },
    },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.seoulsister.com' },
          { '@type': 'ListItem', position: 2, name: 'Products', item: 'https://www.seoulsister.com/products' },
          {
            '@type': 'ListItem',
            position: 3,
            name: meta.title,
            item: `https://www.seoulsister.com/best/${meta.slug}`,
          },
        ],
      },
      {
        '@type': 'CollectionPage',
        '@id': `https://www.seoulsister.com/best/${meta.slug}#collection`,
        name: meta.h1,
        description: meta.description,
        url: `https://www.seoulsister.com/best/${meta.slug}`,
        numberOfItems: totalCount,
        isPartOf: {
          '@type': 'WebSite',
          '@id': 'https://www.seoulsister.com#website',
          name: 'Seoul Sister',
        },
      },
      {
        '@type': 'ItemList',
        '@id': `https://www.seoulsister.com/best/${meta.slug}#list`,
        name: meta.h1,
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        numberOfItems: Math.min(products.length, 20),
        itemListElement: products.slice(0, 20).map((p, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          item: {
            '@type': 'Product',
            name: p.name_en,
            brand: { '@type': 'Brand', name: p.brand_en },
            url: `https://www.seoulsister.com/products/${p.id}`,
            ...(p.image_url && { image: p.image_url }),
            ...(p.description_en && { description: p.description_en }),
            ...(p.price_usd && {
              offers: {
                '@type': 'Offer',
                price: Number(p.price_usd).toFixed(2),
                priceCurrency: 'USD',
                availability: 'https://schema.org/InStock',
              },
            }),
            ...(p.rating_avg && {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: Number(p.rating_avg).toFixed(1),
                reviewCount: p.review_count || 1,
                bestRating: 5,
                worstRating: 1,
              },
            }),
          },
        })),
      },
      {
        '@type': 'FAQPage',
        '@id': `https://www.seoulsister.com/best/${meta.slug}#faq`,
        mainEntity: faqQuestions,
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
          <div className="max-w-6xl mx-auto px-4 py-12">
            <nav className="text-xs text-white/40 mb-4 flex items-center gap-1.5">
              <Link href="/" className="hover:text-white/60">Home</Link>
              <span>/</span>
              <Link href="/products" className="hover:text-white/60">Products</Link>
              <span>/</span>
              <span className="text-white/60">{meta.title}</span>
            </nav>

            <div className="flex items-center gap-3 mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300">
                <TrendingUp className="w-3.5 h-3.5" />
                {totalCount.toLocaleString()} Products Tracked
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/60">
                {uniqueBrands} Brands
              </div>
            </div>

            <h1 className="font-display font-bold text-3xl md:text-4xl text-white mb-3">
              {meta.h1}
            </h1>
            <p className="text-white/60 max-w-2xl text-lg leading-relaxed">
              {meta.description}
            </p>
          </div>
        </div>

        {/* Skin Tip */}
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <FlaskConical className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-medium text-amber-300 mb-1">Pro Tip</h2>
                <p className="text-sm text-white/60 leading-relaxed">{meta.skinTip}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Key Ingredients */}
        <div className="max-w-6xl mx-auto px-4 pb-4">
          <h2 className="text-sm font-medium text-white/50 mb-2">Key Ingredients to Look For</h2>
          <div className="flex flex-wrap gap-2">
            {meta.keyIngredients.map((ing) => (
              <Link
                key={ing}
                href={`/ingredients/${toSlug(ing)}`}
                className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-colors"
              >
                {ing}
              </Link>
            ))}
          </div>
        </div>

        {/* Product Rankings */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h2 className="font-display font-semibold text-xl text-white mb-6">
            Top 20 Highest-Rated
          </h2>
          <div className="space-y-4">
            {products.map((product, idx) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group flex items-center gap-4 bg-white/5 rounded-xl border border-white/10 p-4 hover:border-amber-500/30 hover:bg-white/[0.07] transition-all"
              >
                {/* Rank Badge */}
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  idx === 0 ? 'bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/30' :
                  idx === 1 ? 'bg-gray-400/20 text-gray-300 ring-2 ring-gray-400/30' :
                  idx === 2 ? 'bg-orange-600/20 text-orange-400 ring-2 ring-orange-500/30' :
                  'bg-white/10 text-white/50'
                }`}>
                  {idx + 1}
                </div>

                {/* Product Image */}
                {product.image_url && (
                  <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {idx < 5 ? (
                      <img
                        src={product.image_url}
                        alt={product.name_en}
                        className="w-full h-full object-cover"
                        loading="eager"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <LazyImage
                        src={product.image_url}
                        alt={product.name_en}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                )}

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white group-hover:text-amber-400 transition-colors truncate">
                    {product.name_en}
                  </h3>
                  <p className="text-sm text-white/50">{product.brand_en}</p>
                  {product.description_en && (
                    <p className="text-xs text-white/40 mt-1 line-clamp-1 hidden sm:block">
                      {product.description_en}
                    </p>
                  )}
                </div>

                {/* Rating + Price */}
                <div className="shrink-0 text-right">
                  {product.rating_avg && (
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-medium text-white">
                        {Number(product.rating_avg).toFixed(1)}
                      </span>
                      {product.review_count && (
                        <span className="text-xs text-white/40">
                          ({product.review_count.toLocaleString()})
                        </span>
                      )}
                    </div>
                  )}
                  {product.price_usd && (
                    <p className="text-sm text-emerald-400 mt-0.5">
                      ${Number(product.price_usd).toFixed(2)}
                    </p>
                  )}
                </div>

                <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-amber-400/50 shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Browse All CTA */}
        <div className="max-w-6xl mx-auto px-4 pb-8">
          <Link
            href={`/products?category=${meta.dbCategory}`}
            className="block text-center py-4 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/30 hover:bg-white/[0.07] transition-all text-white/60 hover:text-amber-400"
          >
            Browse all {totalCount.toLocaleString()} {meta.slug} with ingredient analysis
            <ArrowRight className="inline w-4 h-4 ml-2" />
          </Link>
        </div>

        {/* FAQ Section (visible for users + crawlers) */}
        <div className="max-w-6xl mx-auto px-4 pb-16">
          <h2 className="font-display font-semibold text-xl text-white mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqQuestions.map((faq, idx) => (
              <details
                key={idx}
                className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden"
                {...(idx === 0 ? { open: true } : {})}
              >
                <summary className="px-4 py-3 cursor-pointer text-white font-medium text-sm hover:bg-white/5 transition-colors list-none flex items-center justify-between">
                  {faq.name}
                  <span className="text-white/30 group-open:rotate-180 transition-transform">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <div className="px-4 pb-4 text-sm text-white/60 leading-relaxed">
                  {faq.acceptedAnswer.text}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Other Categories */}
        <div className="border-t border-white/10 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto px-4 py-12">
            <h2 className="font-display font-semibold text-lg text-white mb-6">
              Explore Other Categories
            </h2>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter((c) => c.slug !== meta.slug).map((c) => (
                <Link
                  key={c.slug}
                  href={`/best/${c.slug}`}
                  className="px-4 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white/60 hover:border-amber-500/30 hover:text-amber-400 transition-all"
                >
                  {c.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
