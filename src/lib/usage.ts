import { getServiceClient } from './supabase'
import { usageCapsForPlan } from './pricing'

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
/** The current usage period: this calendar month in UTC. */
export function currentUsagePeriod(now = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { start: start.toISOString(), end: end.toISOString() }
}

async function planCaps(userId: string) {
  const { data: profile, error } = await getServiceClient()
    .from('ss_user_profiles')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) console.error('[usage] plan lookup failed:', error.message)
  return usageCapsForPlan(profile?.plan)
}

async function getOrCreateUsageRecord(userId: string) {
  const supabase = getServiceClient()

  // Usage is counted per CALENDAR MONTH (UTC) for every plan. The billing
  // period was used before, which would have counted an annual plan's
  // allowance per year and reset a trial's counter mid-month at conversion.
  const { start: periodStart, end: periodEnd } = currentUsagePeriod()

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
  const [record, caps] = await Promise.all([getOrCreateUsageRecord(userId), planCaps(userId)])

  const yuri_used = record?.yuri_messages_used ?? 0
  const scans_used = record?.scans_used ?? 0
  const yuriLimit = caps.yuri_messages_per_month
  const scanLimit = caps.scans_per_month

  return {
    yuri_messages_used: yuri_used,
    yuri_messages_limit: yuriLimit,
    scans_used: scans_used,
    scans_limit: scanLimit,
    yuri_messages_remaining: Math.max(0, yuriLimit - yuri_used),
    scans_remaining: Math.max(0, scanLimit - scans_used),
    yuri_at_limit: yuri_used >= yuriLimit,
    scans_at_limit: scans_used >= scanLimit,
    yuri_usage_pct: Math.min(100, Math.round((yuri_used / yuriLimit) * 100)),
    scans_usage_pct: Math.min(100, Math.round((scans_used / scanLimit) * 100)),
  }
}

/**
 * Increment Yuri message count. Returns false if at limit.
 */
export async function incrementYuriMessageCount(userId: string): Promise<boolean> {
  const status = await getUsageStatus(userId)
  if (status.yuri_at_limit) return false

  const supabase = getServiceClient()

  const periodStart = currentUsagePeriod().start

  const { error } = await supabase
    .from('ss_usage_tracking')
    .update({ yuri_messages_used: status.yuri_messages_used + 1 })
    .eq('user_id', userId)
    .eq('billing_period_start', periodStart)
  if (error) console.error('[usage] yuri_messages_used increment failed:', error.message)

  return true
}

/**
 * Increment scan count. Returns false if at limit.
 */
export async function incrementScanCount(userId: string): Promise<boolean> {
  const status = await getUsageStatus(userId)
  if (status.scans_at_limit) return false

  const supabase = getServiceClient()

  const periodStart = currentUsagePeriod().start

  const { error } = await supabase
    .from('ss_usage_tracking')
    .update({ scans_used: status.scans_used + 1 })
    .eq('user_id', userId)
    .eq('billing_period_start', periodStart)
  if (error) console.error('[usage] scans_used increment failed:', error.message)

  return true
}
