/**
 * Signup attribution — first-touch capture.
 *
 * WHY THIS EXISTS (Jul 13 2026): Seoul Sister could not answer "where did this
 * user come from?" for any of its users. Bailey's personal account got ~10x the
 * followers in a day — the biggest top-of-funnel event the product has had — and
 * the bio link had no way to report that it worked.
 *
 * FIRST-TOUCH, NOT LAST-TOUCH. Someone clicks Bailey's bio link on Tuesday,
 * lurks, and signs up on Friday by typing the URL directly. Last-touch would
 * credit "direct" and Bailey's video would look like it did nothing. The click
 * that *introduced* them is the one worth crediting for a top-of-funnel creator
 * link, so once we record a first touch we never overwrite it.
 *
 * The click precedes the account by minutes to days, so the capture has to
 * happen at landing (client-side) and be held until a profile exists.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'ss_attribution_v1';

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  referrer?: string;
  landing_path?: string;
  first_seen_at?: string;
}

/** Bound every field so a hostile or malformed query string can't write junk. */
function clean(value: string | null, max = 200): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length ? trimmed : undefined;
}

/**
 * Derive a source from the referrer when no UTM is present.
 * A creator posting organically often can't attach UTMs (Instagram strips them
 * from bio links in some surfaces, and a spoken "link in bio" carries none), so
 * the referring host is the only signal we get. Best-effort, never fabricated:
 * if we can't tell, we return undefined rather than guessing.
 */
function isInternalReferrer(referrer: string | undefined): boolean {
  if (!referrer) return false;
  try {
    return (
      typeof window !== 'undefined' &&
      new URL(referrer).hostname.toLowerCase() === window.location.hostname.toLowerCase()
    );
  } catch {
    return false;
  }
}

function sourceFromReferrer(referrer: string | undefined): string | undefined {
  if (!referrer || isInternalReferrer(referrer)) return undefined;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  if (host.includes('tiktok')) return 'tiktok';
  if (host.includes('instagram')) return 'instagram';
  if (host.includes('reddit')) return 'reddit';
  if (host.includes('youtube') || host.includes('youtu.be')) return 'youtube';
  if (host.includes('google')) return 'google';
  return host; // record the raw host rather than inventing a label
}

/**
 * Capture first-touch attribution if we haven't already. Idempotent and safe to
 * call on every page load. Never overwrites an existing first touch.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;

  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return; // first touch already recorded

    const params = new URLSearchParams(window.location.search);
    const rawReferrer = clean(document.referrer, 500);

    // An internal referrer is not a traffic source — it's someone clicking around
    // the site. Treat it as absent, or we record "seoulsister.com" as a source and
    // pollute the very data this exists to collect.
    const referrer = isInternalReferrer(rawReferrer) ? undefined : rawReferrer;

    const utmSource = clean(params.get('utm_source'));
    const derived = utmSource ?? sourceFromReferrer(referrer);

    // Nothing to record: no UTM and no external referrer. Writing a row of
    // all-nulls would be noise, so abstain rather than fabricate.
    if (!derived && !referrer) return;

    const attribution: Attribution = {
      utm_source: derived,
      utm_medium: clean(params.get('utm_medium')),
      utm_campaign: clean(params.get('utm_campaign')),
      utm_content: clean(params.get('utm_content')),
      referrer,
      landing_path: clean(window.location.pathname, 300),
      first_seen_at: new Date().toISOString(),
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // localStorage can throw (private mode, quota, blocked cookies). Attribution
    // is a measurement nicety — it must NEVER break a signup. Fail silent.
  }
}

/** Read the stored first touch, if any. */
export function getAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Server side
// ---------------------------------------------------------------------------

/**
 * Build the attribution columns for a profile upsert, reading the payload that
 * signUp() stashed in auth.users.raw_user_meta_data.
 *
 * Returns {} when there is nothing to stamp OR when this profile already has a
 * first touch — FIRST-TOUCH IS IMMUTABLE. Profile upserts run on later edits
 * too, and without this guard a returning user would overwrite the original
 * bio-link credit with whatever brought them back, silently destroying the
 * signal. Spreading {} into the upsert is a no-op, so callers stay simple.
 *
 * `db` is a service-role Supabase client.
 */
export async function buildAttributionFields(
  db: SupabaseClient,
  userId: string,
  userMetadata: Record<string, unknown> | null | undefined
): Promise<Record<string, unknown>> {
  const raw = userMetadata?.attribution as Attribution | undefined;
  if (!raw || typeof raw !== 'object') return {};

  try {
    const { data: existing } = await db
      .from('ss_user_profiles')
      .select('attribution_locked_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.attribution_locked_at) {
      return {}; // already has a first touch — never overwrite
    }
  } catch {
    return {}; // a failed read must not block profile creation
  }

  return {
    utm_source: raw.utm_source ?? null,
    utm_medium: raw.utm_medium ?? null,
    utm_campaign: raw.utm_campaign ?? null,
    utm_content: raw.utm_content ?? null,
    referrer: raw.referrer ?? null,
    landing_path: raw.landing_path ?? null,
    first_seen_at: raw.first_seen_at ?? null,
    attribution_locked_at: new Date().toISOString(),
  };
}
