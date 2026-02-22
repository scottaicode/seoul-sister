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
  // Use maybeSingle() — many users have no Stripe subscription row (pre-Stripe manual plans)
  const { data: sub } = await supabase
    .from('ss_subscriptions')
    .select('current_period_start, current_period_end')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

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

  // Try to fetch existing record first (avoids upsert 406 when ignoreDuplicates skips insert)
  const { data: existing } = await supabase
    .from('ss_usage_tracking')
    .select()
    .eq('user_id', userId)
    .eq('billing_period_start', periodStart)
    .maybeSingle()

  if (existing) return existing

  // No record exists — insert a new one
  const { data, error } = await supabase
    .from('ss_usage_tracking')
    .insert({
      user_id: userId,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      yuri_messages_used: 0,
      scans_used: 0,
    })
    .select()
    .single()

  if (error) {
    // Race condition: another request created it between our check and insert
    const { data: raceResult } = await supabase
      .from('ss_usage_tracking')
      .select()
      .eq('user_id', userId)
      .eq('billing_period_start', periodStart)
      .maybeSingle()

    return raceResult
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

  // Get current period start (maybeSingle — user may not have Stripe subscription)
  const { data: sub } = await supabase
    .from('ss_subscriptions')
    .select('current_period_start')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

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
    .maybeSingle()

  const periodStart = sub?.current_period_start
    ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  await supabase
    .from('ss_usage_tracking')
    .update({ scans_used: status.scans_used + 1 })
    .eq('user_id', userId)
    .eq('billing_period_start', periodStart)

  return true
}
