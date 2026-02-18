import { getServiceClient } from './supabase'

export type Feature =
  | 'unlimited_yuri'
  | 'specialist_agents'
  | 'unlimited_scans'
  | 'routine_builder'
  | 'price_alerts'
  | 'counterfeit_scanner'
  | 'routine_outcomes'

/** All features are available to active subscribers */
const PRO_FEATURES: Feature[] = [
  'unlimited_yuri',
  'specialist_agents',
  'unlimited_scans',
  'routine_builder',
  'price_alerts',
  'counterfeit_scanner',
  'routine_outcomes',
]

export function checkFeatureAccessBySubscription(
  hasActiveSubscription: boolean,
  feature: Feature
): boolean {
  if (PRO_FEATURES.includes(feature)) {
    return hasActiveSubscription
  }
  return true
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const supabase = getServiceClient()

  const { data } = await supabase
    .from('ss_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .single()

  return data?.status === 'active'
}

export async function checkFeatureAccess(
  userId: string,
  feature: Feature
): Promise<boolean> {
  const active = await hasActiveSubscription(userId)
  return checkFeatureAccessBySubscription(active, feature)
}

/** Monthly usage caps for active subscribers */
export const USAGE_CAPS = {
  yuri_messages_per_month: 500,
  scans_per_month: 30,
} as const

export function getYuriMessageLimit(): number {
  return USAGE_CAPS.yuri_messages_per_month
}

export function getScanLimit(): number {
  return USAGE_CAPS.scans_per_month
}
