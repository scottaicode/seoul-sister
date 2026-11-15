/**
 * A fact for Yuri when a member's stated location has no map coordinates.
 *
 * Why (Nov 15 2026, the owner's own walkthrough): he told Yuri "Northern
 * California". The geocoder is deliberately conservative and returns nothing
 * for a bare region (null beats a guess, see geocode.ts), so the account had no
 * coordinates, the weekly note had no forecast, and nothing told Yuri. She did
 * not ask for a city because she could not see there was a gap. Two of nine
 * members were in this state.
 *
 * It says only what is known: what is on file, that there are no coordinates,
 * and what does not work without them. A second-model review of the first
 * wording found two claims that were not always true, and both are gone:
 *   - WHY there are no coordinates. The geocoder also returns nothing on a
 *     timeout or an outage, so "too broad" could be said of "Austin, Texas".
 *   - A REMEDY ("a city would give both"). In the member chat nothing saves
 *     coordinates from a city said in conversation; only setup and the
 *     Profile page's device location do. The member prompt's own
 *     "Location and weather" row already states what does work.
 * Whether and when to raise it is Yuri's. Nothing records that she already
 * asked, so the sentence must stay a plain state, not a prompt to act.
 *
 * The place name is the member's own words by way of the extractor: quotes
 * are removed and it is cut to 80 characters before it is echoed.
 */
export function unplacedLocationFact(
  locationText: string | null | undefined,
  hasCoordinates: boolean
): string | null {
  const place = (locationText ?? '').replace(/["\u201c\u201d]/g, "'").replace(/\s+/g, ' ').trim().slice(0, 80)
  if (!place || hasCoordinates) return null
  return `Location on file: "${place}". There are no map coordinates on file for it, so there is no saved-location weather or weekly forecast for them.`
}
