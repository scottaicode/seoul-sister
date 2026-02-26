import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: product } = await supabase
    .from('ss_products')
    .select('name_en, brand_en, description_en, category, price_usd, image_url')
    .eq('id', id)
    .single()

  if (!product) {
    return { title: 'Product Not Found' }
  }

  const title = `${product.name_en} by ${product.brand_en}`
  const description = product.description_en
    || `Shop ${product.name_en} by ${product.brand_en}. Authentic Korean beauty product with ingredient analysis and expert recommendations.`

  return {
    title,
    description,
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

export default function ProductLayout({ children }: Props) {
  return children
}
