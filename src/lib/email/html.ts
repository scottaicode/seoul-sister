/**
 * Shared HTML escaping for email bodies.
 *
 * Extracted v11.23.0. This function was copy-pasted in guardian/alert.ts and
 * email/new-subscriber-alert.ts; the nudge email would have been the third copy.
 * Any value interpolated into an email body — a product name, a user-supplied
 * string, or a model-generated message — goes through this first.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
