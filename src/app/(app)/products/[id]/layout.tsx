import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = getSupabase()

  const { data: product } = await supabase
    .from('ss_products')
    .select('name_en, brand_en, description_en, category, price_usd, image_url')
    .eq('id', id)
    .single()

  if (!product) {
    return { title: 'Product Not Found' }
  }

  const title = `${product.name_en} by ${product.brand_en}`
  const description =
    product.description_en ||
    `${product.name_en} by ${product.brand_en}. Authentic Korean beauty product with ingredient analysis, safety ratings, and expert recommendations.`

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `https://www.seoulsister.com/products/${id}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      images: product.image_url ? [product.image_url] : [],
      url: `https://www.seoulsister.com/products/${id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: product.image_url ? [product.image_url] : [],
    },
  }
}

export default async function ProductLayout({ params, children }: Props) {
  const { id } = await params
  const supabase = getSupabase()

  // Fetch product + top ingredients + review stats in parallel for JSON-LD
  const [productRes, ingredientsRes, reviewRes] = await Promise.all([
    supabase
      .from('ss_products')
      .select(
        'name_en, name_ko, brand_en, description_en, category, price_usd, price_krw, image_url, rating_avg, review_count, volume_display'
      )
      .eq('id', id)
      .single(),
    supabase
      .from('ss_product_ingredients')
      .select('ingredient:ss_ingredients(name_inci, name_en, function, is_active)')
      .eq('product_id', id)
      .order('position')
      .limit(10),
    supabase
      .from('ss_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id),
  ])

  const product = productRes.data
  if (!product) return <>{children}</>

  const categoryLabel = categoryLabels[product.category] || product.category
  const reviewCount = reviewRes.count || product.review_count || 0
  const activeIngredients = (ingredientsRes.data || [])
    .map((row) => row.ingredient as unknown as { name_inci: string; name_en: string | null; function: string | null; is_active: boolean } | null)
    .filter((i): i is NonNullable<typeof i> => i !== null && i.is_active)

  // Build FAQ questions from ingredient data
  const faqQuestions = [
    {
      '@type': 'Question' as const,
      name: `What are the key ingredients in ${product.name_en}?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: activeIngredients.length > 0
          ? `The key active ingredients in ${product.name_en} by ${product.brand_en} include ${activeIngredients
              .slice(0, 5)
              .map((i) => `${i.name_en || i.name_inci}${i.function ? ` (${i.function})` : ''}`)
              .join(', ')}.`
          : `${product.name_en} is a ${categoryLabel.toLowerCase()} by ${product.brand_en}. See the full ingredient list on the product page.`,
      },
    },
    {
      '@type': 'Question' as const,
      name: `Is ${product.name_en} good for sensitive skin?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: `${product.name_en} is a ${categoryLabel.toLowerCase()} by ${product.brand_en}. Check the full ingredient list and safety ratings on Seoul Sister for personalized skin-type compatibility. Our AI advisor Yuri can analyze how this product works with your specific skin profile.`,
      },
    },
    ...(product.price_usd
      ? [
          {
            '@type': 'Question' as const,
            name: `How much does ${product.name_en} cost?`,
            acceptedAnswer: {
              '@type': 'Answer' as const,
              text: `${product.name_en} by ${product.brand_en} is available from $${Number(product.price_usd).toFixed(2)} USD${product.volume_display ? ` for ${product.volume_display}` : ''}. Compare prices across multiple retailers on Seoul Sister.`,
            },
          },
        ]
      : []),
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
        ...(product.image_url && { image: product.image_url }),
        ...(product.price_usd && {
          offers: {
            '@type': 'Offer',
            price: Number(product.price_usd).toFixed(2),
            priceCurrency: 'USD',
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
      {children}
    </>
  )
}
