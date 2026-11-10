/**
 * Stamp the first sign-up click from the landing chat on an EXISTING visitor
 * row (Nov 10 2026). Pure of imports so the guard test can execute it against a
 * fake database: a source-text test passed while the update was pointed at the
 * wrong column (review, Nov 10 2026).
 *
 * It never creates a visitor, so a crawler following the link cannot inflate
 * the count of people who chatted. Set-once: the first click stays on record.
 */
export type RegisterClickResult = 'recorded' | 'already' | 'unknown_visitor' | 'error'

interface Db {
  // Structural, so the real Supabase client and the test fake both fit.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any
}

export async function stampRegisterClick(db: Db, visitorId: string, nowIso: string): Promise<RegisterClickResult> {
  const { data: visitor, error: readErr } = await db
    .from('ss_widget_visitors')
    .select('register_clicked_at, total_messages')
    .eq('visitor_id', visitorId)
    .maybeSingle()
  if (readErr) {
    console.error('[widget/register-click] visitor read failed:', readErr.message)
    return 'error'
  }
  if (!visitor) return 'unknown_visitor'
  if (visitor.register_clicked_at) return 'already'

  const { error: writeErr } = await db
    .from('ss_widget_visitors')
    .update({ register_clicked_at: nowIso, register_click_messages: visitor.total_messages ?? 0 })
    .eq('visitor_id', visitorId)
    .is('register_clicked_at', null)
  if (writeErr) {
    console.error('[widget/register-click] stamp failed:', writeErr.message)
    return 'error'
  }
  return 'recorded'
}
