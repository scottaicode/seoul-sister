/**
 * Decides whether the blog page should render `faq_schema` as a VISIBLE
 * accordion, given the post body that is about to be rendered.
 *
 * Background — a contract nobody asserted. LGAAS deliberately mandates a body
 * FAQ in the visible content (`api/content-blog.js`: "The 'Frequently Asked
 * Questions' section with visible H3 sub-questions is NON-NEGOTIABLE... AI
 * search engines extract Q&A pairs directly from page content"), and it has an
 * auto-injector that adds one from schema when the model omits it. Seoul
 * Sister then ALSO rendered `faq_schema` as collapsed `<details>` accordions.
 * Neither side was wrong alone; the result was the same Q&As twice on 39 of 45
 * published posts.
 *
 * Resolution: the body copy wins. It is plain text every crawler reads without
 * executing JS, and it is LGAAS's stated extraction surface. The accordion is
 * collapsed by default — the weaker surface, and the likely reason the body
 * mandate exists. `faq_schema` keeps feeding JSON-LD unconditionally; that is a
 * separate code path and is deliberately untouched here.
 *
 * WHY THE HEADING, AND NOT THE SUB-QUESTIONS
 *
 * The obvious detector — look for H3 sub-questions — is wrong, and was measured
 * before this shipped. Five published posts render a complete, visible FAQ whose
 * questions are BOLD paragraphs rather than H3s:
 *
 *   ## Frequently Asked Questions
 *   **Can I use a Korean cleansing oil if I don't wear makeup?**
 *   Absolutely. ...
 *
 * Keying on H3s would have called those "no body FAQ" and kept the duplicate.
 * The heading is the reliable signal for "a visible FAQ section exists here."
 *
 * WHY NOT THE LITERAL STRING "Frequently Asked Questions"
 *
 * Also measured. Of the 39 posts with a body FAQ, 37 use that exact heading —
 * but one uses `## FAQ` and one uses `## Common Questions`, and the latter was
 * on the work order's list of posts believed to have NO body FAQ. A literal
 * match would have left both duplicated. LGAAS's prompt asks for a specific
 * heading; it does not guarantee one, so we match the shape, not the phrasing.
 *
 * WHY IT READS RENDERED HTML, NOT THE MARKDOWN SOURCE
 *
 * So it self-corrects as posts change, and so an incidental mention in prose
 * ("...answers to frequently asked questions below") cannot suppress a real
 * accordion: after `marked`, a heading is an `<h1>`-`<h4>` element and prose is
 * a `<p>`. Scoping the match to heading tags makes the two distinguishable.
 *
 * Deliberately NOT a stored flag and NOT a content mutation. Render-layer only,
 * zero backfill, reversible by deleting the call site.
 */

/**
 * Matches an FAQ-ish heading in rendered HTML.
 *
 * Scoped to h1-h4 tags so body prose can never trigger it. The tag may carry
 * attributes (`marked` emits bare tags today, but a future `headerIds` option
 * or a downstream transform would add an `id`), hence `[^>]*`. The inner text
 * is allowed leading/trailing markup and words — `## Frequently Asked
 * Questions (FAQ)` and `<h2>FAQ</h2>` both count — but the phrase itself must
 * appear inside the heading element.
 */
const FAQ_HEADING = /<h[1-4][^>]*>[^<]{0,80}?(?:frequently\s+asked\s+questions?|common\s+questions?|\bFAQs?\b)[^<]{0,80}?<\/h[1-4]>/i

/**
 * True when the rendered post body already contains a visible FAQ section.
 *
 * @param renderedBodyHtml the post body AFTER markdown rendering (and after
 *   ingredient auto-linking — the linker only rewrites ingredient names into
 *   anchors, so it cannot introduce or destroy a heading).
 */
export function bodyHasVisibleFaq(renderedBodyHtml: string | null | undefined): boolean {
  if (!renderedBodyHtml) return false
  return FAQ_HEADING.test(renderedBodyHtml)
}

/**
 * True when the page should render the `faq_schema` accordion.
 *
 * The accordion is a FALLBACK, not the primary surface: it renders only when
 * the body has no FAQ of its own. Eight published posts are in exactly that
 * state, and removing the accordion unconditionally would leave them with no
 * visible FAQ at all.
 *
 * @param renderedBodyHtml rendered post body
 * @param faqQuestionCount number of questions in `faq_schema`
 */
export function shouldRenderFaqAccordion(
  renderedBodyHtml: string | null | undefined,
  faqQuestionCount: number
): boolean {
  if (faqQuestionCount <= 0) return false
  return !bodyHasVisibleFaq(renderedBodyHtml)
}
