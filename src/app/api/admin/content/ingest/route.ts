import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

const ingestSchema = z.object({
  lgaas_post_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(200),
  meta_description: z.string().max(500).optional(),
  content: z.string().min(50),
  excerpt: z.string().max(1000).optional(),
  primary_keyword: z.string().max(100).optional(),
  secondary_keywords: z.array(z.string()).optional(),
  faq_schema: z.any().optional(),
  featured_image_url: z.string().url().optional().nullable(),
  word_count: z.number().int().positive().optional(),
  source_type: z.string().optional(),
  published_at: z.string().optional(),
})

/**
 * POST /api/admin/content/ingest
 *
 * Webhook endpoint for LGAAS to push approved blog content.
 * Auth via X-LGAAS-API-Key header (shared secret).
 * Upserts by lgaas_post_id for idempotent retries.
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-LGAAS-API-Key')
    const expectedKey = process.env.LGAAS_INGEST_API_KEY

    if (!apiKey || !expectedKey || apiKey !== expectedKey) {
      throw new AppError('Unauthorized: invalid or missing API key', 401)
    }

    const body = await request.json()
    const data = ingestSchema.parse(body)

    const supabase = getServiceClient()

    const wordCount = data.word_count || data.content.split(/\s+/).length
    const readTimeMinutes = Math.ceil(wordCount / 200)
    const category = inferCategory(data.primary_keyword, data.title)
    const tags = data.secondary_keywords?.slice(0, 10) || []

    const row = {
      lgaas_post_id: data.lgaas_post_id,
      title: data.title,
      slug: sanitizeSlug(data.slug),
      meta_description: data.meta_description || null,
      body: data.content,
      excerpt: data.excerpt || generateExcerpt(data.content),
      category,
      tags,
      primary_keyword: data.primary_keyword || null,
      secondary_keywords: data.secondary_keywords || null,
      faq_schema: data.faq_schema || null,
      featured_image_url: data.featured_image_url || null,
      read_time_minutes: readTimeMinutes,
      source: 'lgaas' as const,
      published_at: data.published_at || new Date().toISOString(),
      author: 'Seoul Sister Team',
    }

    // Manual upsert: check if lgaas_post_id already exists, then insert or update.
    // We avoid .upsert({ onConflict }) because the partial unique index on
    // lgaas_post_id (WHERE lgaas_post_id IS NOT NULL) isn't compatible with
    // PostgREST's ON CONFLICT resolution.
    const { data: existing } = await supabase
      .from('ss_content_posts')
      .select('id')
      .eq('lgaas_post_id', data.lgaas_post_id)
      .maybeSingle()

    let post: { id: string; slug: string } | null = null
    let error: { message: string } | null = null

    if (existing) {
      const result = await supabase
        .from('ss_content_posts')
        .update(row)
        .eq('id', existing.id)
        .select('id, slug')
        .single()
      post = result.data
      error = result.error
    } else {
      const result = await supabase
        .from('ss_content_posts')
        .insert(row)
        .select('id, slug')
        .single()
      post = result.data
      error = result.error
    }

    if (error || !post) {
      console.error('[content-ingest] Supabase error:', error)
      throw new AppError('Failed to save content', 500)
    }

    console.log(`[content-ingest] Saved: "${data.title}" -> /blog/${post.slug}`)

    return NextResponse.json({
      success: true,
      id: post.id,
      slug: post.slug,
      url: `https://seoulsister.com/blog/${post.slug}`,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function inferCategory(keyword?: string, title?: string): string {
  const text = `${keyword || ''} ${title || ''}`.toLowerCase()

  if (text.includes('routine') || text.includes('regimen')) return 'routines'
  if (text.includes('ingredient') || text.includes('niacinamide') || text.includes('retinol'))
    return 'ingredients'
  if (text.includes('trend') || text.includes('trending') || text.includes('viral'))
    return 'trends'
  if (text.includes('review') || text.includes('tested')) return 'reviews'
  if (text.includes('sunscreen') || text.includes('spf')) return 'sunscreen'
  if (text.includes('serum') || text.includes('essence') || text.includes('ampoule'))
    return 'serums'
  if (text.includes('moisturizer') || text.includes('cream')) return 'moisturizers'
  if (text.includes('cleanser') || text.includes('cleansing')) return 'cleansers'
  if (text.includes('acne') || text.includes('breakout')) return 'acne'
  if (text.includes('anti-aging') || text.includes('wrinkle')) return 'anti-aging'
  if (text.includes('beginner') || text.includes('guide') || text.includes('start'))
    return 'guides'

  return 'general'
}

function sanitizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
}

function generateExcerpt(content: string, maxLength = 300): string {
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  const truncated = text.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return truncated.slice(0, lastSpace > 0 ? lastSpace : maxLength) + '...'
}
