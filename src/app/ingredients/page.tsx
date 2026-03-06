import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { FlaskConical, Shield, Sparkles } from 'lucide-react'
import { toSlug } from '@/lib/utils/slug'
import IngredientSearch from './IngredientSearch'

export const metadata: Metadata = {
  title: 'K-Beauty Ingredient Encyclopedia | 14,000+ Ingredients',
  description:
    'The most comprehensive K-beauty ingredient database. Safety ratings, comedogenic scores, skin-type effectiveness, and which Korean products contain each ingredient.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.seoulsister.com/ingredients' },
  openGraph: {
    title: 'K-Beauty Ingredient Encyclopedia | Seoul Sister',
    description:
      'The most comprehensive K-beauty ingredient database. 14,000+ ingredients with safety ratings and effectiveness data.',
    type: 'website',
    url: 'https://www.seoulsister.com/ingredients',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'K-Beauty Ingredient Encyclopedia | Seoul Sister',
    description:
      'The most comprehensive K-beauty ingredient database. 14,000+ ingredients with safety ratings and effectiveness data.',
  },
}

export const revalidate = 3600

interface IngredientRow {
  id: string
  name_inci: string
  name_en: string
  function: string | null
  is_active: boolean
  safety_rating: number | null
  comedogenic_rating: number | null
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/** Featured active ingredients that users search for most */
const FEATURED_INCI = [
  'Niacinamide',
  'Sodium Hyaluronate',
  'Retinol',
  'Glycerin',
  'Centella Asiatica Extract',
  'Salicylic Acid',
  'Ascorbic Acid',
  'Panthenol',
  'Ceramide NP',
  'Adenosine',
  'Allantoin',
  'Snail Secretion Filtrate',
  'Tea Tree Oil',
  'Tranexamic Acid',
  'Arbutin',
  'Madecassoside',
  'Tocopherol',
  'Glycolic Acid',
  'Lactic Acid',
  'Squalane',
  'Beta-Glucan',
  'Azelaic Acid',
  'Propolis Extract',
  'Rice Bran Extract',
  'Mugwort Extract',
  'Green Tea Extract',
  'Bakuchiol',
  'Peptide Complex',
  'Collagen',
  'Bifida Ferment Lysate',
]

export default async function IngredientsPage() {
  const supabase = getSupabase()

  // Fetch featured ingredients
  const { data: featuredRaw } = await supabase
    .from('ss_ingredients')
    .select('id, name_inci, name_en, function, is_active, safety_rating, comedogenic_rating')
    .in('name_inci', FEATURED_INCI)
    .order('name_en')

  // Fetch counts
  const { count: totalCount } = await supabase
    .from('ss_ingredients')
    .select('id', { count: 'exact', head: true })

  const { count: activeCount } = await supabase
    .from('ss_ingredients')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  const featured = (featuredRaw || []) as IngredientRow[]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://www.seoulsister.com/ingredients#collection',
        name: 'K-Beauty Ingredient Encyclopedia',
        description:
          'Comprehensive database of Korean skincare ingredients with safety ratings, comedogenic scores, and skin-type effectiveness data.',
        url: 'https://www.seoulsister.com/ingredients',
        isPartOf: {
          '@type': 'WebSite',
          '@id': 'https://www.seoulsister.com#website',
          name: 'Seoul Sister',
        },
        numberOfItems: totalCount || 14000,
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
            name: 'Ingredients',
            item: 'https://www.seoulsister.com/ingredients',
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
        {/* Hero */}
        <div className="border-b border-white/10 bg-gradient-to-b from-amber-500/5 to-transparent">
          <div className="max-w-6xl mx-auto px-4 py-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 mb-4">
              <FlaskConical className="w-3.5 h-3.5" />
              {totalCount?.toLocaleString() || '14,000+'} Ingredients
            </div>
            <h1 className="font-display font-bold text-3xl md:text-4xl text-white mb-3">
              K-Beauty Ingredient Encyclopedia
            </h1>
            <p className="text-white/60 max-w-2xl mx-auto mb-8">
              Every ingredient in Korean skincare, decoded. Safety ratings,
              comedogenic scores, skin-type effectiveness, and which products
              contain each one.
            </p>

            <div className="flex justify-center gap-8 text-sm">
              <div className="text-center">
                <div className="text-xl font-bold text-amber-400">
                  {totalCount?.toLocaleString() || '14,000+'}
                </div>
                <div className="text-white/50">Total Ingredients</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-400">
                  {activeCount?.toLocaleString() || '8,000+'}
                </div>
                <div className="text-white/50">Active Ingredients</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-sky-400">207,000+</div>
                <div className="text-white/50">Product Links</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-6xl mx-auto px-4 py-6">
          <IngredientSearch />
        </div>

        {/* Featured Ingredients Grid */}
        <div className="max-w-6xl mx-auto px-4 pb-16">
          <h2 className="font-display font-semibold text-xl text-white mb-6">
            Key Active Ingredients in K-Beauty
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((ing) => (
              <Link
                key={ing.id}
                href={`/ingredients/${toSlug(ing.name_inci)}`}
                className="group block bg-white/5 rounded-xl border border-white/10 p-4 hover:border-amber-500/30 hover:bg-white/[0.07] transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-white group-hover:text-amber-400 transition-colors leading-tight">
                    {ing.name_en || ing.name_inci}
                  </h3>
                  {ing.is_active && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                      Active
                    </span>
                  )}
                </div>
                {ing.name_en !== ing.name_inci && (
                  <p className="text-xs text-white/40 mb-1.5 font-mono">
                    {ing.name_inci}
                  </p>
                )}
                {ing.function && (
                  <p className="text-sm text-white/60 mb-3 line-clamp-2">
                    {ing.function}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-white/40">
                  {ing.safety_rating != null && (
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Safety: {ing.safety_rating}/5
                    </span>
                  )}
                  {ing.comedogenic_rating != null &&
                    ing.comedogenic_rating > 0 && (
                      <span>Comedogenic: {ing.comedogenic_rating}/5</span>
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
