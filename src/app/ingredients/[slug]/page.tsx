import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import {
  FlaskConical,
  Shield,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  Droplets,
  Star,
  BookOpen,
  Calendar,
} from 'lucide-react'
import { toSlug } from '@/lib/utils/slug'
import IngredientsNav from '../IngredientsNav'

export const revalidate = 3600

interface RichContent {
  overview: string
  how_it_works: string
  skin_types: {
    oily: string
    dry: string
    combination: string
    sensitive: string
    normal: string
  }
  usage_tips: string[]
  history_origin: string
  faq: Array<{ question: string; answer: string }>
  word_count: number
  model_used: string
}

interface IngredientRow {
  id: string
  name_inci: string
  name_en: string
  name_ko: string | null
  function: string | null
  description: string | null
  safety_rating: number | null
  comedogenic_rating: number | null
  is_fragrance: boolean
  is_active: boolean
  common_concerns: string[] | null
  rich_content: RichContent | null
}

interface EffectivenessRow {
  skin_type: string
  concern: string
  effectiveness_score: number
  sample_size: number
}

interface ConflictRow {
  severity: string
  description: string
  recommendation: string
  other_name: string
  other_slug: string
}

interface ProductRow {
  id: string
  name_en: string
  brand_en: string
  category: string
  rating_avg: number | null
  image_url: string | null
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function findIngredientBySlug(
  slug: string
): Promise<IngredientRow | null> {
  const supabase = getSupabase()

  // Try common fast matches first (exact lowercase match on name_inci)
  const { data: exact } = await supabase
    .from('ss_ingredients')
    .select(
      'id, name_inci, name_en, name_ko, function, description, safety_rating, comedogenic_rating, is_fragrance, is_active, common_concerns, rich_content'
    )
    .ilike('name_inci', slug.replace(/-/g, '_').replace(/_/g, '%'))
    .limit(50)

  if (exact && exact.length > 0) {
    const match = exact.find((i) => toSlug(i.name_inci) === slug)
    if (match) return match as IngredientRow
  }

  // Broader search: fetch ingredients where any word matches
  const words = slug.split('-').filter((w) => w.length > 2)
  if (words.length === 0) return null

  const { data: broad } = await supabase
    .from('ss_ingredients')
    .select(
      'id, name_inci, name_en, name_ko, function, description, safety_rating, comedogenic_rating, is_fragrance, is_active, common_concerns, rich_content'
    )
    .ilike('name_inci', `%${words[0]}%`)
    .limit(200)

  if (!broad) return null
  return (broad.find((i) => toSlug(i.name_inci) === slug) as IngredientRow) || null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const ingredient = await findIngredientBySlug(slug)

  if (!ingredient) {
    return { title: 'Ingredient Not Found' }
  }

  const displayName = ingredient.name_en || ingredient.name_inci
  const rc = ingredient.rich_content
  const description = rc?.overview
    ? rc.overview.slice(0, 155).replace(/\s+\S*$/, '') + '...'
    : ingredient.description ||
      `${displayName} in K-beauty: safety rating, comedogenic score, skin-type effectiveness, and which Korean skincare products contain it.`

  return {
    title: `${displayName} — K-Beauty Ingredient Guide`,
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `https://www.seoulsister.com/ingredients/${slug}`,
    },
    openGraph: {
      title: `${displayName} — K-Beauty Ingredient Guide | Seoul Sister`,
      description,
      type: 'article',
      url: `https://www.seoulsister.com/ingredients/${slug}`,
    },
    twitter: {
      card: 'summary',
      title: `${displayName} — K-Beauty Ingredient Guide`,
      description,
    },
  }
}

export default async function IngredientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ingredient = await findIngredientBySlug(slug)

  if (!ingredient) notFound()

  const supabase = getSupabase()

  // Parallel data fetches
  const [effectivenessRes, productsRes, conflictsARes, conflictsBRes, productCountRes] =
    await Promise.all([
      // Effectiveness by skin type
      supabase
        .from('ss_ingredient_effectiveness')
        .select('skin_type, concern, effectiveness_score, sample_size')
        .eq('ingredient_id', ingredient.id)
        .gte('sample_size', 5)
        .order('effectiveness_score', { ascending: false }),

      // Top products containing this ingredient
      supabase
        .from('ss_product_ingredients')
        .select(
          'product:ss_products(id, name_en, brand_en, category, rating_avg, image_url)'
        )
        .eq('ingredient_id', ingredient.id)
        .limit(12),

      // Conflicts where this ingredient is ingredient_a
      supabase
        .from('ss_ingredient_conflicts')
        .select(
          'severity, description, recommendation, other:ingredient_b_id(name_inci, name_en)'
        )
        .eq('ingredient_a_id', ingredient.id),

      // Conflicts where this ingredient is ingredient_b
      supabase
        .from('ss_ingredient_conflicts')
        .select(
          'severity, description, recommendation, other:ingredient_a_id(name_inci, name_en)'
        )
        .eq('ingredient_b_id', ingredient.id),

      // Total product count
      supabase
        .from('ss_product_ingredients')
        .select('id', { count: 'exact', head: true })
        .eq('ingredient_id', ingredient.id),
    ])

  const effectiveness = (effectivenessRes.data || []) as EffectivenessRow[]

  // Flatten products from the join
  const products = (productsRes.data || [])
    .map((row) => {
      const p = row.product as unknown as ProductRow | null
      return p
    })
    .filter((p): p is ProductRow => p !== null)
    .sort(
      (a, b) =>
        (b.rating_avg || 0) - (a.rating_avg || 0)
    )
    .slice(0, 12)

  // Merge conflicts from both directions
  const conflicts: ConflictRow[] = [
    ...(conflictsARes.data || []).map((c) => {
      const other = c.other as unknown as { name_inci: string; name_en: string } | null
      return {
        severity: c.severity,
        description: c.description,
        recommendation: c.recommendation,
        other_name: other?.name_en || other?.name_inci || 'Unknown',
        other_slug: other ? toSlug(other.name_inci) : '',
      }
    }),
    ...(conflictsBRes.data || []).map((c) => {
      const other = c.other as unknown as { name_inci: string; name_en: string } | null
      return {
        severity: c.severity,
        description: c.description,
        recommendation: c.recommendation,
        other_name: other?.name_en || other?.name_inci || 'Unknown',
        other_slug: other ? toSlug(other.name_inci) : '',
      }
    }),
  ]

  const productCount = productCountRes.count || products.length
  const displayName = ingredient.name_en || ingredient.name_inci

  // Fetch related blog articles that mention this ingredient
  const searchTerms = [ingredient.name_inci, ingredient.name_en].filter(Boolean)
  const orConditions = searchTerms.map((t) => `body.ilike.%${t}%`).join(',')
  const { data: relatedArticles } = orConditions
    ? await supabase
        .from('ss_content_posts')
        .select('slug, title, excerpt, published_at')
        .or(orConditions)
        .not('published_at', 'is', null)
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false })
        .limit(3)
    : { data: null }

  // Safety label
  function safetyLabel(rating: number | null): {
    text: string
    color: string
  } {
    if (rating == null) return { text: 'Not Rated', color: 'text-white/40' }
    if (rating >= 4) return { text: 'Very Safe', color: 'text-emerald-400' }
    if (rating >= 3) return { text: 'Generally Safe', color: 'text-sky-400' }
    if (rating >= 2) return { text: 'Use with Caution', color: 'text-amber-400' }
    return { text: 'Avoid / Irritant Risk', color: 'text-rose-400' }
  }

  const safety = safetyLabel(ingredient.safety_rating)
  const richContent = ingredient.rich_content

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
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
            name: 'Ingredients',
            item: 'https://www.seoulsister.com/ingredients',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: displayName,
            item: `https://www.seoulsister.com/ingredients/${slug}`,
          },
        ],
      },
      {
        '@type': 'Article',
        '@id': `https://www.seoulsister.com/ingredients/${slug}#article`,
        headline: `${displayName} in K-Beauty: Safety, Effectiveness & Products`,
        description:
          richContent?.overview?.slice(0, 300) ||
          ingredient.description ||
          `Complete guide to ${displayName} in Korean skincare. Safety rating, comedogenic score, effectiveness by skin type, and products containing this ingredient.`,
        url: `https://www.seoulsister.com/ingredients/${slug}`,
        author: {
          '@type': 'Organization',
          name: 'Seoul Sister',
          url: 'https://www.seoulsister.com',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Seoul Sister',
          url: 'https://www.seoulsister.com',
          logo: 'https://www.seoulsister.com/icons/icon-512.svg',
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `https://www.seoulsister.com/ingredients/${slug}`,
        },
        keywords: [
          ingredient.name_inci,
          ingredient.name_en,
          ingredient.name_ko,
          'K-beauty',
          'Korean skincare',
          'ingredient analysis',
          ...(ingredient.common_concerns || []),
        ]
          .filter(Boolean)
          .join(', '),
      },
      // FAQ schema — use AI-generated FAQ when available, fall back to template
      ...((richContent?.faq?.length || effectiveness.length > 0)
        ? [
            {
              '@type': 'FAQPage',
              '@id': `https://www.seoulsister.com/ingredients/${slug}#faq`,
              mainEntity: richContent?.faq?.length
                ? richContent.faq.map((f) => ({
                    '@type': 'Question',
                    name: f.question,
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: f.answer,
                    },
                  }))
                : [
                    {
                      '@type': 'Question',
                      name: `Is ${displayName} safe for skin?`,
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text:
                          ingredient.safety_rating != null
                            ? `${displayName} has a safety rating of ${ingredient.safety_rating}/5. ${
                                ingredient.safety_rating >= 4
                                  ? 'It is considered very safe for most skin types.'
                                  : ingredient.safety_rating >= 3
                                    ? 'It is generally safe but some individuals may experience sensitivity.'
                                    : 'Use with caution and patch test first.'
                              }${
                                ingredient.comedogenic_rating != null && ingredient.comedogenic_rating > 0
                                  ? ` It has a comedogenic rating of ${ingredient.comedogenic_rating}/5.`
                                  : ' It is non-comedogenic.'
                              }`
                            : `Safety data for ${displayName} is still being compiled.`,
                      },
                    },
                    {
                      '@type': 'Question',
                      name: `What does ${displayName} do in skincare?`,
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text:
                          ingredient.description ||
                          ingredient.function ||
                          `${displayName} is used in Korean skincare products for its beneficial properties.`,
                      },
                    },
                    ...(effectiveness.length > 0
                      ? [
                          {
                            '@type': 'Question',
                            name: `What skin type is ${displayName} best for?`,
                            acceptedAnswer: {
                              '@type': 'Answer',
                              text: `Based on effectiveness data, ${displayName} works best for ${effectiveness
                                .slice(0, 3)
                                .map(
                                  (e) =>
                                    `${e.skin_type} skin (${Math.round(e.effectiveness_score * 100)}% effective for ${e.concern})`
                                )
                                .join(', ')}.`,
                            },
                          },
                        ]
                      : []),
                    {
                      '@type': 'Question',
                      name: `Which K-beauty products contain ${displayName}?`,
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: `${productCount.toLocaleString()} Korean skincare products in our database contain ${displayName}${
                          products.length > 0
                            ? `, including ${products
                                .slice(0, 3)
                                .map((p) => `${p.name_en} by ${p.brand_en}`)
                                .join(', ')}.`
                            : '.'
                        }`,
                      },
                    },
                  ],
            },
          ]
        : []),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-[#0a0a0a]">
        <IngredientsNav />

        {/* Back link */}
        <div className="border-b border-white/10 pt-16">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Link
              href="/ingredients"
              className="inline-flex items-center gap-2 text-white/60 hover:text-amber-400 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              All Ingredients
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="border-b border-white/10 bg-gradient-to-b from-amber-500/5 to-transparent">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {ingredient.is_active && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                  Active Ingredient
                </span>
              )}
              {ingredient.is_fragrance && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/20 text-rose-300">
                  Fragrance
                </span>
              )}
            </div>

            <h1 className="font-display font-bold text-3xl md:text-4xl text-white mb-2">
              {displayName}
            </h1>

            {ingredient.name_en !== ingredient.name_inci && (
              <p className="text-white/50 font-mono text-sm mb-1">
                INCI: {ingredient.name_inci}
              </p>
            )}
            {ingredient.name_ko && (
              <p className="text-white/40 text-sm">
                Korean: {ingredient.name_ko}
              </p>
            )}

            {ingredient.function && (
              <p className="text-amber-300/80 text-sm mt-3 capitalize">
                {ingredient.function}
              </p>
            )}

            {ingredient.description && (
              <p className="text-white/70 mt-4 max-w-2xl leading-relaxed">
                {ingredient.description}
              </p>
            )}

            {/* Quick stats */}
            <div className="flex flex-wrap gap-6 mt-6 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-white/40" />
                <span className="text-white/50">Safety:</span>
                <span className={safety.color}>
                  {ingredient.safety_rating != null
                    ? `${ingredient.safety_rating}/5 — ${safety.text}`
                    : safety.text}
                </span>
              </div>
              {ingredient.comedogenic_rating != null && (
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-white/40" />
                  <span className="text-white/50">Comedogenic:</span>
                  <span
                    className={
                      ingredient.comedogenic_rating === 0
                        ? 'text-emerald-400'
                        : ingredient.comedogenic_rating <= 2
                          ? 'text-sky-400'
                          : 'text-amber-400'
                    }
                  >
                    {ingredient.comedogenic_rating}/5
                    {ingredient.comedogenic_rating === 0 && ' — Non-comedogenic'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-white/40" />
                <span className="text-white/50">Found in:</span>
                <span className="text-white">
                  {productCount.toLocaleString()} products
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
          {/* Rich Content: Overview */}
          {richContent?.overview && (
            <section>
              <h2 className="font-display font-semibold text-lg text-white mb-3">
                About {displayName}
              </h2>
              <div className="text-white/70 leading-relaxed space-y-4">
                {richContent.overview.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )}

          {/* Rich Content: How It Works */}
          {richContent?.how_it_works && (
            <section>
              <h2 className="font-display font-semibold text-lg text-white mb-3">
                How {displayName} Works
              </h2>
              <div className="text-white/70 leading-relaxed space-y-4">
                {richContent.how_it_works.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )}

          {/* Rich Content: Best For Your Skin Type */}
          {richContent?.skin_types && (
            <section>
              <h2 className="font-display font-semibold text-lg text-white mb-4">
                {displayName} by Skin Type
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(['oily', 'dry', 'combination', 'sensitive', 'normal'] as const).map((type) => {
                  const text = richContent.skin_types[type]
                  if (!text) return null
                  const icons: Record<string, string> = {
                    oily: 'Oily',
                    dry: 'Dry',
                    combination: 'Combo',
                    sensitive: 'Sensitive',
                    normal: 'Normal',
                  }
                  return (
                    <div
                      key={type}
                      className="bg-white/5 rounded-xl border border-white/10 p-4"
                    >
                      <h3 className="text-amber-400 font-medium text-sm mb-2 capitalize">
                        {icons[type]} Skin
                      </h3>
                      <p className="text-white/60 text-sm leading-relaxed">{text}</p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Rich Content: Usage Tips */}
          {richContent?.usage_tips && richContent.usage_tips.length > 0 && (
            <section>
              <h2 className="font-display font-semibold text-lg text-white mb-3">
                How to Use {displayName}
              </h2>
              <ol className="space-y-3">
                {richContent.usage_tips.map((tip, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-white/70 text-sm leading-relaxed"
                  >
                    <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Rich Content: History & Origin */}
          {richContent?.history_origin && (
            <section>
              <h2 className="font-display font-semibold text-lg text-white mb-3">
                Background
              </h2>
              <p className="text-white/70 leading-relaxed">
                {richContent.history_origin}
              </p>
            </section>
          )}

          {/* Concerns */}
          {ingredient.common_concerns &&
            ingredient.common_concerns.length > 0 && (
              <section>
                <h2 className="font-display font-semibold text-lg text-white mb-3">
                  Addresses These Concerns
                </h2>
                <div className="flex flex-wrap gap-2">
                  {ingredient.common_concerns.map((concern) => (
                    <span
                      key={concern}
                      className="px-3 py-1 rounded-full text-xs bg-amber-500/15 text-amber-300 border border-amber-500/20"
                    >
                      {concern}
                    </span>
                  ))}
                </div>
              </section>
            )}

          {/* Effectiveness by skin type */}
          {effectiveness.length > 0 && (
            <section>
              <h2 className="font-display font-semibold text-lg text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Effectiveness by Skin Type
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {effectiveness.map((e) => (
                  <div
                    key={`${e.skin_type}-${e.concern}`}
                    className="bg-white/5 rounded-xl border border-white/10 p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium capitalize text-sm">
                        {e.skin_type} skin
                      </span>
                      <span className="text-amber-400 font-semibold text-sm">
                        {Math.round(e.effectiveness_score * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-amber-400 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.round(e.effectiveness_score * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-white/50 capitalize">
                      For {e.concern} · {e.sample_size} reports
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ingredient conflicts */}
          {conflicts.length > 0 && (
            <section>
              <h2 className="font-display font-semibold text-lg text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Known Interactions
              </h2>
              <div className="space-y-3">
                {conflicts.map((c, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 ${
                      c.severity === 'high'
                        ? 'bg-rose-500/5 border-rose-500/20'
                        : c.severity === 'medium'
                          ? 'bg-amber-500/5 border-amber-500/20'
                          : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-medium uppercase ${
                          c.severity === 'high'
                            ? 'text-rose-400'
                            : c.severity === 'medium'
                              ? 'text-amber-400'
                              : 'text-white/50'
                        }`}
                      >
                        {c.severity} conflict
                      </span>
                      <span className="text-white/30">with</span>
                      {c.other_slug ? (
                        <Link
                          href={`/ingredients/${c.other_slug}`}
                          className="text-amber-400 hover:underline text-sm font-medium"
                        >
                          {c.other_name}
                        </Link>
                      ) : (
                        <span className="text-white text-sm font-medium">
                          {c.other_name}
                        </span>
                      )}
                    </div>
                    <p className="text-white/60 text-sm mb-2">
                      {c.description}
                    </p>
                    <p className="text-emerald-300/80 text-sm">
                      <strong>Recommendation:</strong> {c.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Products containing this ingredient */}
          {products.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-lg text-white">
                  K-Beauty Products with {displayName}
                </h2>
                {productCount > 12 && (
                  <Link
                    href={`/products?include_ingredients=${encodeURIComponent(ingredient.name_inci)}`}
                    className="text-amber-400 text-sm hover:underline"
                  >
                    View all {productCount.toLocaleString()} →
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {products.map((p) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.id}`}
                    className="group block bg-white/5 rounded-xl border border-white/10 p-3 hover:border-amber-500/30 hover:bg-white/[0.07] transition-all"
                  >
                    <div className="flex items-start gap-3">
                      {p.image_url && (
                        <img
                          src={p.image_url}
                          alt={p.name_en}
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-white font-medium text-sm group-hover:text-amber-400 transition-colors line-clamp-2">
                          {p.name_en}
                        </p>
                        <p className="text-white/50 text-xs">{p.brand_en}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-white/50 capitalize">
                            {p.category.replace(/_/g, ' ')}
                          </span>
                          {p.rating_avg != null && (
                            <span className="flex items-center gap-0.5 text-[10px] text-white/40">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              {Number(p.rating_avg).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Rich Content: FAQ Accordion */}
          {richContent?.faq && richContent.faq.length > 0 && (
            <section>
              <h2 className="font-display font-semibold text-lg text-white mb-4">
                Frequently Asked Questions
              </h2>
              <div className="space-y-2">
                {richContent.faq.map((item, i) => (
                  <details
                    key={i}
                    className="group bg-white/5 rounded-xl border border-white/10"
                  >
                    <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-sm font-medium text-white hover:text-amber-400 transition-colors list-none">
                      <span>{item.question}</span>
                      <span className="shrink-0 ml-2 text-white/30 group-open:rotate-180 transition-transform">
                        &#9660;
                      </span>
                    </summary>
                    <div className="px-4 pb-4 text-white/60 text-sm leading-relaxed">
                      {item.answer}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Related Articles */}
          {relatedArticles && relatedArticles.length > 0 && (
            <section>
              <h2 className="font-display font-semibold text-lg text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                Articles About {displayName}
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
                      <p className="text-white/50 text-xs mt-1 line-clamp-2">
                        {article.excerpt}
                      </p>
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
            </section>
          )}

          {/* CTA */}
          <section className="bg-gradient-to-r from-amber-500/10 to-rose-500/10 rounded-2xl border border-amber-500/20 p-6 text-center">
            <h2 className="font-display font-semibold text-lg text-white mb-2">
              Want personalized ingredient advice?
            </h2>
            <p className="text-white/60 text-sm mb-4 max-w-lg mx-auto">
              Yuri, our AI beauty advisor, can analyze how {displayName}{' '}
              works with your specific skin type, routine, and concerns.
            </p>
            <Link
              href="/subscribe"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors"
            >
              Try Seoul Sister Pro
            </Link>
          </section>
        </div>
      </div>
    </>
  )
}
