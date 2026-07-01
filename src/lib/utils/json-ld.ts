/**
 * Serialize structured data for injection into a JSON-LD <script> tag.
 *
 * JSON.stringify does not escape `<`, so any DB- or AI-sourced string
 * containing `</script>` would terminate the tag and execute attacker
 * markup (XSS). Escaping `<` as its unicode escape keeps the payload valid
 * JSON for search-engine parsers while making tag breakout impossible.
 */
export function serializeJsonLd(jsonLd: unknown): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c')
}
