/**
 * Delete the learning notes written from a conversation or a review
 * (Nov 14 2026).
 *
 * The nightly learning job reads conversations and reviews and stores what it
 * takes from each as a row in `ss_learning_patterns`: free text written by a
 * model, with `data.source_id` set to the conversation or review it came from.
 * A row can carry what the person told Yuri about their skin and health (one
 * read "a mature user with dry skin, high sun sensitivity, and a history of
 * precancer removal").
 *
 * Deleting an account, or a single conversation, left those rows behind with a
 * source id pointing at nothing. The privacy page called them anonymized
 * contributions that cannot be traced back. With a few dozen members and
 * details like that, they can. They now go with their source.
 */
const CHUNK = 40

export async function deleteLearningNotesFrom(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { from(table: string): any },
  sourceIds: readonly string[]
): Promise<{ error: { message: string } | null; deleted: number }> {
  const ids = [...new Set(sourceIds.filter((id) => typeof id === 'string' && id.length > 0))]
  let deleted = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error, count } = await db
      .from('ss_learning_patterns')
      .delete({ count: 'exact' })
      .in('data->>source_id', ids.slice(i, i + CHUNK))
    if (error) return { error: { message: error.message }, deleted }
    deleted += count ?? 0
  }
  return { error: null, deleted }
}
