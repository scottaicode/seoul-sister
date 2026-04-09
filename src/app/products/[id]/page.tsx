import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import {
  Star,
  Package,
  Shield,
  FlaskConical,
  TrendingUp,
  BookOpen,
  Calendar,
} from 'lucide-react'
import { toSlug } from '@/lib/utils/slug'
import PublicNav from '@/components/layout/PublicNav'
import ProductIntelligenceSection from '@/components/products/ProductIntelligenceSection'

export const revalidate = 3600

const categoryLabels: Record<string, string> = {
  cleanser: 'Cleanser',
  toner: 'Toner',
  essence: 'Essence',
  serum: 'Serum',
  ampoule: 'Ampoule',
  moisturizer: 'Moisturizer',
  sunscreen: 'Sunscreen',
  mask: 'Mask',
  eye_care: 'Eye Care',
  lip_care: 'Lip Care',
  exfoliator: 'Exfoliator',
  oil: 'Oil',
  mist: 'Mist',
  spot_treatment: 'Spot Treatment',
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = getSupabase()

  const [productRes, ingredientCountRes] = await Promise.all([
    supabase
      .from('ss_products')
      .select('name_en, brand_en, description_en, category, price_usd, image_url, rating_avg')
      .eq('id', id)
      .single(),
    supabase
      .from('ss_product_ingredients')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id),
  ])

  const product = productRes.data
  if (!product) {
    return { title: 'Product Not Found | Seoul Sister' }
  }

  // Thin content gate: noindex products missing BOTH rating AND ingredient links
  const hasRating = product.rating_avg !== null
  const hasIngredients = (ingredientCountRes.count || 0) > 0
  const isThinContent = !hasRating && !hasIngredients

  const categoryLabel = categoryLabels[product.category] || product.category
  const title = `${product.name_en} by ${product.brand_en} — ${categoryLabel} Review & Ingredients`
  const description =
    product.description_en ||
    `${product.name_en} by ${product.brand_en}. Korean ${categoryLabel.toLowerCase()} with full ingredient analysis, safety ratings, price comparison, and skin-type compatibility on Seoul Sister.`

  return {
    title,
    description,
    robots: { index: !isThinContent, follow: true },
    alternates: {
      canonical: `https://www.seoulsister.com/products/${id}`,
    },
    openGraph: {
      title: `${product.name_en} by ${product.brand_en} | Seoul Sister`,
      description,
      type: 'website',
      images: product.image_url ? [product.image_url] : [],
      url: `https://www.seoulsister.com/products/${id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name_en} by ${product.brand_en} | Seoul Sister`,
      description,
      images: product.image_url ? [product.image_url] : [],
    },
  }
}

export default async function PublicProductPage({ params }: Props) {
  const { id } = await params
  const supabase = getSupabase()

  // Fetch product + top ingredients + review stats + trending + blog articles + related products in parallel
  const [productRes, ingredientsRes, reviewRes, trendingRes, priceRangeRes, relatedArticlesRes] = await Promise.all([
    supabase
      .from('ss_products')
      .select(
        'id, name_en, name_ko, brand_en, description_en, category, price_usd, price_krw, image_url, rating_avg, review_count, volume_display, is_verified, last_reformulated_at, updated_at'
      )
      .eq('id', id)
      .single(),
    supabase
      .from('ss_product_ingredients')
      .select('position, ingredient:ss_ingredients(id, name_inci, name_en, function, is_active, safety_rating)')
      .eq('product_id', id)
      .order('position')
      .limit(20),
    supabase
      .from('ss_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id),
    supabase
      .from('ss_trending_products')
      .select('trend_score, source, rank_position')
      .eq('product_id', id)
      .order('trend_score', { ascending: false })
      .limit(1),
    supabase
      .from('ss_product_prices')
      .select('price_usd')
      .eq('product_id', id)
      .order('price_usd', { ascending: true }),
    // Related blog articles mentioning this product's brand or category
    supabase
      .from('ss_content_posts')
      .select('slug, title, excerpt, published_at')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(50),
  ])

  const product = productRes.data
  if (!product) notFound()

  const categoryLabel = categoryLabels[product.category] || product.category
  const reviewCount = reviewRes.count || product.review_count || 0

  // Second wave: queries that depend on product data (category, ingredient IDs)
  const ingredientRows = ingredientsRes.data || []
  const ingredientIds = ingredientRows
    .map((r) => (r.ingredient as unknown as { id: string } | null)?.id)
    .filter(Boolean) as string[]

  const [relatedProductsRes, effectivenessRes] = await Promise.all([
    // Related products in the same category (for internal linking + richer content)
    supabase
      .from('ss_products')
      .select('id, name_en, brand_en, rating_avg, price_usd, image_url')
      .eq('category', product.category)
      .neq('id', id)
      .not('rating_avg', 'is', null)
      .order('rating_avg', { ascending: false })
      .limit(6),
    // Ingredient effectiveness data (enriches page with stats)
    ingredientIds.length > 0
      ? supabase
          .from('ss_ingredient_effectiveness')
          .select('ingredient_id, skin_type, concern, effectiveness_score, sample_size')
          .in('ingredient_id', ingredientIds.slice(0, 10))
          .gte('sample_size', 5)
          .order('effectiveness_score', { ascending: false })
          .limit(15)
      : Promise.resolve({ data: [] }),
  ])

  const relatedProducts = relatedProductsRes.data || []
  const effectivenessData = (effectivenessRes.data || []) as Array<{
    ingredient_id: string
    skin_type: string
    concern: string
    effectiveness_score: number
    sample_size: number
  }>

  const ingredients = (ingredientRows).map((row) => ({
    position: row.position,
    ingredient: row.ingredient as unknown as {
      id: string
      name_inci: string
      name_en: string | null
      function: string | null
      is_active: boolean
      safety_rating: number | null
    } | null,
  })).filter((r) => r.ingredient !== null)

  const activeIngredients = ingredients.filter((r) => r.ingredient?.is_active)
  const topIngredients = ingredients.slice(0, 5)

  const trending = trendingRes.data?.[0] || null

  // Filter related articles: match brand name or category keyword in title/excerpt
  const brandLower = product.brand_en.toLowerCase()
  const categoryLower = categoryLabel.toLowerCase()
  const relatedArticles = (relatedArticlesRes.data || [])
    .filter((a) => {
      const title = (a.title || '').toLowerCase()
      const excerpt = (a.excerpt || '').toLowerCase()
      return (
        title.includes(brandLower) ||
        excerpt.includes(brandLower) ||
        title.includes(categoryLower) ||
        title.includes(product.category.replace(/_/g, ' '))
      )
    })
    .slice(0, 3)

  // Price range from all retailers
  const prices = (priceRangeRes.data || [])
    .map((p) => Number((p as { price_usd: number }).price_usd))
    .filter((p) => p > 0)
  const priceMin = prices.length > 0 ? Math.min(...prices) : product.price_usd ? Number(product.price_usd) : null
  const priceMax = prices.length > 1 ? Math.max(...prices) : null

  // Map ingredient effectiveness by ingredient_id for easy lookup
  const effectivenessMap = new Map<string, Array<{ skin_type: string; concern: string; score: number; sample_size: number }>>()
  for (const row of effectivenessData) {
    const existing = effectivenessMap.get(row.ingredient_id) || []
    existing.push({ skin_type: row.skin_type, concern: row.concern, score: row.effectiveness_score, sample_size: row.sample_size })
    effectivenessMap.set(row.ingredient_id, existing)
  }

  // Build ingredient effectiveness summary for FAQ answers (stats boost AI citation 30-40%)
  const topEffective = effectivenessData.slice(0, 3)
  const effectivenessSummary = topEffective.length > 0
    ? ` Based on Seoul Sister's analysis of ${topEffective[0].sample_size}+ user reports, key ingredients show ${Math.round(topEffective[0].effectiveness_score * 100)}% effectiveness for ${topEffective[0].concern} in ${topEffective[0].skin_type} skin types.`
    : ''

  // Build FAQ questions — expanded with skin-type-specific questions and statistics
  const faqQuestions = [
    {
      '@type': 'Question' as const,
      name: `What are the key ingredients in ${product.name_en}?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: activeIngredients.length > 0
          ? `The key active ingredients in ${product.name_en} by ${product.brand_en} include ${activeIngredients
              .slice(0, 5)
              .map((i) => `${i.ingredient?.name_en || i.ingredient?.name_inci}${i.ingredient?.function ? ` (${i.ingredient.function})` : ''}`)
              .join(', ')}.${effectivenessSummary} Seoul Sister tracks ingredient effectiveness across 5,800+ K-beauty products to provide data-backed recommendations.`
          : `${product.name_en} is a ${categoryLabel.toLowerCase()} by ${product.brand_en}. Subscribe to Seoul Sister for full ingredient analysis across our database of 5,800+ K-beauty products.`,
      },
    },
    {
      '@type': 'Question' as const,
      name: `Is ${product.name_en} good for sensitive skin?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: `${product.name_en} is a Korean ${categoryLabel.toLowerCase()} by ${product.brand_en}. Sensitive skin compatibility depends on individual triggers and allergies. Seoul Sister's AI advisor Yuri analyzes all ${ingredients.length || 'N/A'} ingredients against your specific skin type, concerns, and known allergens to provide a personalized compatibility score. Common irritant ingredients like fragrance, alcohol denat, and essential oils are flagged automatically.`,
      },
    },
    {
      '@type': 'Question' as const,
      name: `Is ${product.name_en} good for oily skin?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: `For oily skin, the key factors in evaluating ${product.name_en} are comedogenic ingredient ratings, oil content, and finish type. ${activeIngredients.length > 0 ? `This ${categoryLabel.toLowerCase()} contains ${activeIngredients.length} active ingredients.` : ''} Seoul Sister's database cross-references each ingredient's comedogenic rating (0-5 scale) against your skin type to identify potential pore-clogging risks. Subscribe for a personalized oily skin compatibility analysis.`,
      },
    },
    ...(priceMin
      ? [
          {
            '@type': 'Question' as const,
            name: `How much does ${product.name_en} cost?`,
            acceptedAnswer: {
              '@type': 'Answer' as const,
              text: `${product.name_en} by ${product.brand_en} starts from $${priceMin.toFixed(2)} USD${product.volume_display ? ` for ${product.volume_display}` : ''}${priceMax && priceMax > priceMin ? `, with prices ranging up to $${priceMax.toFixed(2)} across retailers` : ''}. Seoul Sister Pro members compare prices across 6+ authorized retailers including Olive Young, Soko Glam, and YesStyle to find the best deal, with automatic price drop alerts.`,
            },
          },
        ]
      : []),
    {
      '@type': 'Question' as const,
      name: `Where to buy ${product.name_en}?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: `${product.name_en} by ${product.brand_en} is available from authorized K-beauty retailers including Olive Young Global, Soko Glam, YesStyle, and Amazon.${priceMin ? ` Prices start from $${priceMin.toFixed(2)} USD.` : ''} Seoul Sister verifies retailer authenticity and tracks counterfeit indicators to help you buy genuine Korean skincare products.`,
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
            name: product.name_en,
            item: `https://www.seoulsister.com/products/${id}`,
          },
        ],
      },
      {
        '@type': 'Product',
        '@id': `https://www.seoulsister.com/products/${id}#product`,
        name: product.name_en,
        description:
          product.description_en ||
          `${product.brand_en} ${product.name_en} — Korean ${categoryLabel.toLowerCase()} with ingredient analysis and expert recommendations.`,
        brand: { '@type': 'Brand', name: product.brand_en },
        category: categoryLabel,
        url: `https://www.seoulsister.com/products/${id}`,
        dateModified: product.updated_at
          ? new Date(product.updated_at as string).toISOString()
          : new Date().toISOString(),
        isAccessibleForFree: 'True',
        ...(product.image_url && { image: product.image_url }),
        ...(priceMin && {
          offers: {
            '@type': 'AggregateOffer',
            lowPrice: priceMin.toFixed(2),
            highPrice: (priceMax || priceMin).toFixed(2),
            priceCurrency: 'USD',
            offerCount: prices.length || 1,
            availability: 'https://schema.org/InStock',
          },
        }),
        ...(reviewCount > 0 &&
          product.rating_avg && {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Number(product.rating_avg).toFixed(1),
              reviewCount,
              bestRating: 5,
              worstRating: 1,
            },
          }),
      },
      {
        '@type': 'WebPage',
        '@id': `https://www.seoulsister.com/products/${id}`,
        url: `https://www.seoulsister.com/products/${id}`,
        name: `${product.name_en} by ${product.brand_en}`,
        isAccessibleForFree: 'False',
        hasPart: [
          {
            '@type': 'WebPageElement',
            isAccessibleForFree: 'True',
            cssSelector: '.product-free-content',
          },
          {
            '@type': 'WebPageElement',
            isAccessibleForFree: 'False',
            cssSelector: '.product-gated-content',
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `https://www.seoulsister.com/products/${id}#faq`,
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

        <div className="max-w-4xl mx-auto px-4 pt-20 pb-16">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-white/40 mb-6">
            <Link href="/" className="hover:text-white/60 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/products" className="hover:text-white/60 transition-colors">Products</Link>
            <span>/</span>
            <span className="text-white/60 truncate max-w-[200px]">{product.name_en}</span>
          </nav>

          {/* Product header — FREE */}
          <div className="product-free-content bg-white/5 rounded-2xl border border-white/10 p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-5">
              {/* Image */}
              <div className="flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden mx-auto sm:mx-0">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name_en}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <Package className="w-10 h-10 text-white/20" strokeWidth={1.25} />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/20 text-sky-300 mb-2">
                  {categoryLabel}
                </span>
                <h1 className="font-display font-bold text-2xl md:text-3xl text-white leading-tight mb-1">
                  {product.name_en}
                </h1>
                {product.name_ko && (
                  <p className="text-sm text-white/40 mb-1">{product.name_ko}</p>
                )}
                <p className="text-sm text-white/50 mb-3">{product.brand_en}</p>

                <div className="flex items-center gap-3 justify-center sm:justify-start flex-wrap">
                  {product.rating_avg && (
                    <span className="flex items-center gap-1 text-sm">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-white">
                        {Number(product.rating_avg).toFixed(1)}
                      </span>
                      {reviewCount > 0 && (
                        <span className="text-white/40 text-xs">
                          ({reviewCount.toLocaleString()} reviews)
                        </span>
                      )}
                    </span>
                  )}
                  {product.is_verified && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <Shield className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  )}
                  {trending && (
                    <span className="flex items-center gap-1 text-xs text-rose-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Trending{trending.source === 'olive_young' ? ' in Korea' : ''}
                    </span>
                  )}
                </div>

                {/* Price range */}
                <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start">
                  {priceMin && (
                    <span className="font-display font-bold text-2xl text-white">
                      {priceMax && priceMax > priceMin
                        ? `$${priceMin.toFixed(0)} – $${priceMax.toFixed(0)}`
                        : `$${priceMin.toFixed(2)}`
                      }
                    </span>
                  )}
                  {product.volume_display && (
                    <span className="text-sm text-white/40">{product.volume_display}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description — FREE */}
          {product.description_en && (
            <div className="bg-white/5 rounded-xl border border-white/10 p-5 mb-6">
              <p className="text-sm text-white/70 leading-relaxed">
                {product.description_en}
              </p>
            </div>
          )}

          {/* Key Ingredients Preview — FREE (top 5 names only) */}
          {topIngredients.length > 0 && (
            <div className="bg-white/5 rounded-xl border border-white/10 p-5 mb-6">
              <h2 className="font-display font-semibold text-lg text-white mb-3 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-amber-400" />
                Key Ingredients
              </h2>
              <div className="space-y-2">
                {topIngredients.map((item) => {
                  const ing = item.ingredient!
                  return (
                    <div
                      key={ing.id}
                      className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0"
                    >
                      <div>
                        <Link
                          href={`/ingredients/${toSlug(ing.name_inci)}`}
                          className="text-sm text-white font-medium hover:text-amber-400 transition-colors"
                        >
                          {ing.name_en || ing.name_inci}
                        </Link>
                        {ing.name_en && ing.name_en !== ing.name_inci && (
                          <span className="text-xs text-white/30 font-mono ml-2">
                            {ing.name_inci}
                          </span>
                        )}
                        {ing.function && (
                          <p className="text-xs text-white/50 mt-0.5">{ing.function}</p>
                        )}
                      </div>
                      {ing.is_active && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                          Active
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              {ingredients.length > 5 && (
                <p className="text-xs text-white/40 mt-3">
                  + {ingredients.length - 5} more ingredients
                </p>
              )}
            </div>
          )}

          {/* Ingredient Effectiveness Stats — FREE (data-rich content for AI citation) */}
          {effectivenessData.length > 0 && (
            <div className="bg-white/5 rounded-xl border border-white/10 p-5 mb-6">
              <h2 className="font-display font-semibold text-lg text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Ingredient Effectiveness Data
              </h2>
              <p className="text-xs text-white/40 mb-3">
                Based on aggregated user reports across Seoul Sister&apos;s community
              </p>
              <div className="space-y-2">
                {Array.from(effectivenessMap.entries()).slice(0, 5).map(([ingId, entries]) => {
                  const ing = ingredients.find((i) => i.ingredient?.id === ingId)?.ingredient
                  if (!ing) return null
                  const topEntry = entries[0]
                  return (
                    <div key={ingId} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                      <div className="min-w-0">
                        <span className="text-sm text-white font-medium">
                          {ing.name_en || ing.name_inci}
                        </span>
                        <span className="text-xs text-white/40 ml-2">
                          for {topEntry.concern} ({topEntry.skin_type} skin)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${Math.round(topEntry.score * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-emerald-400 w-8 text-right">
                          {Math.round(topEntry.score * 100)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Personalized Intelligence — shows enrichment for subscribers, gate for anonymous */}
          <ProductIntelligenceSection
            productId={product.id}
            ingredientCount={ingredients.length}
          />

          {/* Related Products in Same Category — FREE (internal linking + richer content) */}
          {relatedProducts.length > 0 && (
            <div className="mt-8 mb-8">
              <h2 className="font-display font-semibold text-lg text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-sky-400" />
                More Korean {categoryLabel}s
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {relatedProducts.map((rp) => (
                  <Link
                    key={rp.id}
                    href={`/products/${rp.id}`}
                    className="group bg-white/5 rounded-xl border border-white/10 hover:border-amber-500/20 p-3 transition-colors"
                  >
                    <div className="w-full h-16 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden mb-2">
                      {rp.image_url ? (
                        <img src={rp.image_url} alt={rp.name_en} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Package className="w-5 h-5 text-white/20" strokeWidth={1.25} />
                      )}
                    </div>
                    <p className="text-xs font-medium text-white truncate group-hover:text-amber-400 transition-colors">
                      {rp.name_en}
                    </p>
                    <p className="text-[10px] text-white/40 truncate">{rp.brand_en}</p>
                    <div className="flex items-center justify-between mt-1">
                      {rp.rating_avg && (
                        <span className="flex items-center gap-0.5 text-[10px] text-white/50">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          {Number(rp.rating_avg).toFixed(1)}
                        </span>
                      )}
                      {rp.price_usd && (
                        <span className="text-[10px] text-white/50">${Number(rp.price_usd).toFixed(0)}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* FAQ Section for SEO */}
          <div className="mt-12">
            <h2 className="font-display font-semibold text-lg text-white mb-4">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {faqQuestions.map((faq, idx) => (
                <div key={idx} className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <h3 className="font-medium text-sm text-white mb-2">{faq.name}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">
                    {faq.acceptedAnswer.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="mt-12">
              <h2 className="font-display font-semibold text-lg text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                Related Articles
              </h2>
              <div className="space-y-3">
                {relatedArticles.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/blog/${article.slug}`}
                    className="block group bg-white/5 rounded-xl border border-white/10 hover:border-amber-500/30 p-4 transition-colors"
                  >
                    <h3 className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="text-white/50 text-xs mt-1 line-clamp-2">{article.excerpt}</p>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-white/30 text-xs">
                      <Calendar className="w-3 h-3" />
                      {new Date(article.published_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Internal linking: Category browse + best-of */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
            <Link
              href="/products"
              className="text-white/50 hover:text-white/70 transition-colors"
            >
              ← Browse all products
            </Link>
            <span className="text-white/20 hidden sm:inline">·</span>
            <Link
              href={`/products?category=${product.category}`}
              className="text-white/50 hover:text-white/70 transition-colors"
            >
              All {categoryLabel}s
            </Link>
            <span className="text-white/20 hidden sm:inline">·</span>
            <Link
              href={`/best/${categoryLabel.toLowerCase()}s`}
              className="text-amber-400/70 hover:text-amber-400 transition-colors"
            >
              Best Korean {categoryLabel}s →
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

/** Gated intelligence section — shows lock + description + subscribe CTA */
