import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dupeFinderSchema } from '@/lib/utils/validation'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { findDupes } from '@/lib/intelligence/dupe-finder'

// Dupe-finding core lives in @/lib/intelligence/dupe-finder so Yuri's
// find_product_dupes tool and this HTTP route share one implementation.
export type { DupeResult } from '@/lib/intelligence/dupe-finder'

// ---------------------------------------------------------------------------
// Soft auth: extract user ID from Bearer token if present (non-critical)
// ---------------------------------------------------------------------------
async function softAuth(request: NextRequest): Promise<string | null> {
  const authSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  try {
    const { data: { user } } = await authSupabase.auth.getUser(token)
    return user?.id ?? null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    // Soft auth — fall back to standard scoring if not authenticated
    const userId = await softAuth(request)

    const { searchParams } = new URL(request.url)
    const params = dupeFinderSchema.parse({
      product_id: searchParams.get('product_id') || undefined,
      max_dupes: searchParams.get('max_dupes') ? Number(searchParams.get('max_dupes')) : undefined,
      min_match_score: searchParams.get('min_match_score') ? Number(searchParams.get('min_match_score')) : undefined,
    })

    const result = await findDupes({
      productId: params.product_id,
      userId,
      maxDupes: params.max_dupes,
      minMatchScore: params.min_match_score,
    })

    if (result.error === 'Product not found') {
      throw new AppError('Product not found', 404)
    }

    return NextResponse.json({ original: result.original, dupes: result.dupes })
  } catch (error) {
    return handleApiError(error)
  }
}
