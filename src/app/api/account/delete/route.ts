import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'

/**
 * DELETE /api/account/delete — GDPR right-to-erasure
 * Deletes all user data: reviews, conversations, routines, scans, profile, and auth account.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const db = getServiceClient()

    // Delete in dependency order (children first)
    const tables = [
      'ss_review_helpfulness',
      'ss_reviews',
      'ss_yuri_messages',
      'ss_yuri_conversations',
      'ss_specialist_insights',
      'ss_onboarding_progress',
      'ss_routine_products',
      'ss_user_routines',
      'ss_user_scans',
      'ss_user_wishlists',
      'ss_user_product_reactions',
      'ss_counterfeit_reports',
      'ss_counterfeit_scans',
      'ss_user_dismissed_alerts',
      'ss_routine_outcomes',
      'ss_affiliate_clicks',
      'ss_subscriptions',
      'ss_user_profiles',
    ]

    for (const table of tables) {
      await db.from(table).delete().eq('user_id', user.id)
    }

    // Delete the auth user (requires service role)
    await db.auth.admin.deleteUser(user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
