import type { ExtractedSkinProfile } from '@/types/database'

/**
 * What Yuri has on file from the setup chat, as rows to show on the paywall
 * (Nov 10 2026). Data display only: these are the values the person stated in
 * onboarding (`ss_onboarding_progress.skin_profile_data`, the provenance record
 * of truth), shown back to them. Nothing is inferred, defaulted or recommended
 * here, and a field that was never captured produces no row. Medical history,
 * age and skin-tone estimates are deliberately left off this screen.
 */
export function onFileRows(profile: ExtractedSkinProfile | null): Array<{ label: string; value: string }> {
  if (!profile) return []
  const rows: Array<{ label: string; value: string }> = []
  const list = (items: string[] | undefined, max: number) => {
    const clean = (items ?? []).filter((i) => typeof i === 'string' && i.trim() !== '')
    if (!clean.length) return null
    const shown = clean.slice(0, max).join(', ')
    return clean.length > max ? `${shown} and ${clean.length - max} more` : shown
  }
  if (profile.skin_type) rows.push({ label: 'Your skin', value: profile.skin_type })
  const concerns = list(profile.skin_concerns, 4)
  if (concerns) rows.push({ label: "What you're working on", value: concerns })
  if (profile.location_text) rows.push({ label: 'Where you live', value: profile.location_text })
  else if (profile.climate) rows.push({ label: 'Your climate', value: profile.climate })
  const shelf = list(profile.current_routine, 4)
  if (shelf) rows.push({ label: 'On your shelf', value: shelf })
  const reacts = list(profile.allergies, 4)
  if (reacts) rows.push({ label: 'You react to', value: reacts })
  return rows
}
