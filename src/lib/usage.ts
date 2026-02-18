import { getServiceClient } from './supabase'
import { USAGE_CAPS } from './subscription'

export interface UsageStatus {
  yuri_messages_used: number
  yuri_messages_limit: number
  scans_used: number
  scans_limit: number
  yuri_messages_remaining: number
  scans_remaining: number
  yuri_at_limit: boolean
  scans_at_limit: boolean
  /** 0-100 percentage of Yuri message usage */
  yuri_usage_pct: number
  /** 0-100 percentage of scan usage */
  scans_usage_pct: number
}

/**
 * Get or create the current billing period usage record for a user.
 * Uses the subscription's billing period if available, otherwise monthly from first of month.
 */
async function getOrCreateUsageRecord(userId: string) {
  const supabase = getServiceClient()

  // Try to get subscription billing period
  const { data: sub } = await supabase
    .from('ss_subscriptions')
    .select('current_period_start, current_period_end')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  let periodStart: string
  let periodEnd: string

  if (sub?.current_period_start && sub?.current_period_end) {
    periodStart = sub.current_period_start
    periodEnd = sub.current_period_end
  } else {
    // Fallback: calendar month
    const now = new Date()
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
  }

  // Upsert the usage record for this period
  const { data, error } = await supabase
    .from('ss_usage_tracking')
    .upsert(
      {
        user_id: userId,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        yuri_messages_used: 0,
        scans_used: 0,
      },
      { onConflict: 'user_id,billing_period_start', ignoreDuplicates: true }
    )
    .select()
    .single()

  if (error) {
    // If upsert with ignoreDuplicates didn't return data, fetch it
    const { data: existing } = await supabase
      .from('ss_usage_tracking')
      .select()
      .eq('user_id', userId)
      .eq('billing_period_start', periodStart)
      .single()

    return existing
  }

  return data
}

/**
 * Get the current usage status for a user.
 */
export async function getUsageStatus(userId: string): Promise<UsageStatus> {
  const record = await getOrCreateUsageRecord(userId)

  const yuri_used = record?.yuri_messages_used ?? 0
  const scans_used = record?.scans_used ?? 0

  return {
    yuri_messages_used: yuri_used,
    yuri_messages_limit: USAGE_CAPS.yuri_messages_per_month,
    scans_used: scans_used,
    scans_limit: USAGE_CAPS.scans_per_month,
    yuri_messages_remaining: Math.max(0, USAGE_CAPS.yuri_messages_per_month - yuri_used),
    scans_remaining: Math.max(0, USAGE_CAPS.scans_per_month - scans_used),
    yuri_at_limit: yuri_used >= USAGE_CAPS.yuri_messages_per_month,
    scans_at_limit: scans_used >= USAGE_CAPS.scans_per_month,
    yuri_usage_pct: Math.min(100, Math.round((yuri_used / USAGE_CAPS.yuri_messages_per_month) * 100)),
    scans_usage_pct: Math.min(100, Math.round((scans_used / USAGE_CAPS.scans_per_month) * 100)),
  }
}

/**
 * Increment Yuri message count. Returns false if at limit.
 */
export async function incrementYuriMessageCount(userId: string): Promise<boolean> {
  const status = await getUsageStatus(userId)
  if (status.yuri_at_limit) return false

  const supabase = getServiceClient()

  // Get current period start
  const { data: sub } = await supabase
    .from('ss_subscriptions')
    .select('current_period_start')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  const periodStart = sub?.current_period_start
    ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  await supabase
    .from('ss_usage_tracking')
    .update({ yuri_messages_used: status.yuri_messages_used + 1 })
    .eq('user_id', userId)
    .eq('billing_period_start', periodStart)

  return true
}

/**
 * Increment scan count. Returns false if at limit.
 */
export async function incrementScanCount(userId: string): Promise<boolean> {
  const status = await getUsageStatus(userId)
  if (status.scans_at_limit) return false

  const supabase = getServiceClient()

  const { data: sub } = await supabase
    .from('ss_subscriptions')
    .select('current_period_start')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  const periodStart = sub?.current_period_start
    ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  await supabase
    .from('ss_usage_tracking')
    .update({ scans_used: status.scans_used + 1 })
    .eq('user_id', userId)
    .eq('billing_period_start', periodStart)

  return true
}
