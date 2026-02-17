import { getServiceClient } from './supabase'
import type { SubscriptionPlan } from '@/types/database'

export type Feature =
  | 'unlimited_yuri'
  | 'specialist_agents'
  | 'unlimited_scans'
  | 'routine_builder'
  | 'price_alerts'
  | 'counterfeit_scanner'
  | 'routine_outcomes'
  | 'priority_support'

const PRO_FEATURES: Feature[] = [
  'unlimited_yuri',
  'specialist_agents',
  'unlimited_scans',
  'routine_builder',
  'price_alerts',
  'counterfeit_scanner',
  'routine_outcomes',
  'priority_support',
]

function isPro(plan: SubscriptionPlan): boolean {
  return plan === 'pro_monthly' || plan === 'pro_annual' || plan === 'student'
}

export function checkFeatureAccessByPlan(
  plan: SubscriptionPlan,
  feature: Feature
): boolean {
  if (PRO_FEATURES.includes(feature)) {
    return isPro(plan)
  }
  return true
}

export async function getUserPlan(userId: string): Promise<SubscriptionPlan> {
  const supabase = getServiceClient()

  const { data } = await supabase
    .from('ss_subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single()

  if (!data || data.status !== 'active') return 'free'
  return data.plan as SubscriptionPlan
}

export async function checkFeatureAccess(
  userId: string,
  feature: Feature
): Promise<boolean> {
  const plan = await getUserPlan(userId)
  return checkFeatureAccessByPlan(plan, feature)
}

export function getYuriMessageLimit(plan: SubscriptionPlan): number {
  return isPro(plan) ? -1 : 3 // -1 = unlimited, 3 for free
}

export function getScanLimit(plan: SubscriptionPlan): number {
  return isPro(plan) ? -1 : 3 // -1 = unlimited, 3/month for free
}
