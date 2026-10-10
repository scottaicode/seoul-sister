/**
 * Surrogate-safe string cutting (Oct 10 2026).
 *
 * `str.slice(0, n)` counts UTF-16 code units. An emoji is TWO units (a
 * surrogate pair), so a cut that lands between them leaves a lone high
 * surrogate. That string then serialises into a request body the Anthropic API
 * rejected outright ("invalid JSON: unexpected end of hex escape"), so a
 * summary for one of a subscriber's conversations was silently never written.
 *
 * safeSlice keeps the same budget (never longer than `max` units) and backs off
 * one unit when the cut would split a pair.
 */
export function safeSlice(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text
  const code = text.charCodeAt(max - 1)
  const end = code >= 0xd800 && code <= 0xdbff ? max - 1 : max
  return text.slice(0, end)
}

/**
 * Build a transcript from whole messages, newest first, within a total
 * character budget. Older turns that do not fit are dropped WITH a marker, so
 * the reader knows they exist, instead of every message being silently cut
 * mid-sentence. A single message larger than the whole budget is the only case
 * that is cut, and it says so.
 */
export function budgetedTranscript(lines: string[], budget: number): string {
  const kept: string[] = []
  let used = 0
  let i = lines.length - 1
  for (; i >= 0; i--) {
    const line = lines[i]
    if (used + line.length + 1 > budget) {
      if (kept.length === 0) {
        kept.unshift(`${safeSlice(line, Math.max(0, budget - 40))} [rest of this message omitted]`)
        i--
      }
      break
    }
    kept.unshift(line)
    used += line.length + 1
  }
  const omitted = i + 1
  return `${omitted > 0 ? `[${omitted} older message${omitted === 1 ? '' : 's'} omitted]\n` : ''}${kept.join('\n')}`
}
