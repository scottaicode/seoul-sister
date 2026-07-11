# Lead-Gen: Close the Source-Attribution Gap + Lift the Email-Capture Floor

**Created:** July 10 2026
**Status:** Building
**Why now:** Scott asked why lead quality/quantity on the landing page is hard to gauge. Investigation of the *already-built* `FUNNEL-SOURCE-ATTRIBUTION.md` procedures found they are live and correct — but the data they capture exposes two real gaps. This is measurement/conversion work (always-allowed under the freeze), not new product.

## What the DB actually shows (July 10 2026, live)

| Signal | Value | Read |
|---|---|---|
| Widget visitors (all-time) | 36 | Tiny absolute volume |
| Widget sessions (all-time) | 42 | |
| Sessions last 30d | 15 | |
| **Sessions with a `source` tag** | **1 of 42** | The attribution system is built + proven (one `ingredient_cta` row) but starved |
| Deep sessions (≥5 msgs) | 7 | Quality is genuinely good when they engage |
| Intent signals 30d | 55 | Strong intent present |
| **Emails captured (all-time)** | **1** | The conversion floor |
| Emails captured last 30d | **0** | |

GA4 shows 627 "users" (mostly Singapore/Direct bot noise). The DB is the truth: **36 real visitors ever.** That mismatch is why the landing-page numbers felt unreadable — GA4 counts bot pageviews, the DB counts people who actually talked to Yuri.

## Root causes (traced in code)

### Gap 1 — the floating `YuriBubble` drops source attribution (a real plumbing bug)
- The hero widget (`TryYuriSection.tsx`) correctly reads `?from=` (line 144) and sends `source` on the first chat request (line 219–231). Proven working: the one `ingredient_cta` session came through here.
- The **floating bubble** (`YuriBubble.tsx`), present on every page including blog posts, sends its chat request (line 120–128) with **no `source`** and never reads `?from=`. Its `open-yuri` event (line 221–229) carries `prefill` but not source.
- **Consequence:** a blog reader who clicks the floating bubble (or any in-page `open-yuri` CTA) instead of the hero creates a NULL-source session even though they came from tagged content. Every blog CTA that dispatches `open-yuri` loses its attribution here. This is a contributor to 41/42 NULL — a fixable leak, on top of genuinely-low feeder volume.

### Gap 2 — email capture is effectively dead (1 ever, 0 in 30d)
- Despite 7 deep sessions + 55 intent signals, the capture rate is ~2%.
- The v10.13.4 / Jul-7 work set the widget prompt to "ask ONCE then rest" (correct — over-asking was worse). But with 0 captures in 30d, the ask may be too soft / too rare, or mis-timed. This is the "cheapest unworked conversion lever" per `LEAD-GEN-LEARNINGS-LOG.md`.

## The fixes (this PR)

### Fix 1 — teach the floating bubble to carry source (plumbing, AI-First-neutral)
- `YuriBubble.tsx`: read `?from=` from the URL (same `landing` fallback as the hero) into a `sourceRef`, and let the `open-yuri` event optionally override it with `event.detail.source`.
- Send `source` once, on the first chat request that creates the session (mirror the hero's `sourceSentRef` first-touch guard exactly — do not overwrite on later messages).
- Feeders that dispatch `open-yuri` may pass `{ prefill, source }`; absent a source, fall back to the URL `?from=`, then `'landing'`.
- Net: both widget entry surfaces now attribute identically. The server side (`/api/widget/chat` sanitize + persist-on-create) already handles `source` — no server change needed.

### Fix 2 — lift the email-capture ask (prompt-copy only; Yuri keeps authority)
- Find the widget system prompt's email-capture guidance and sharpen the *timing and framing* of the single ask — tie it to a concrete earned moment (Yuri just delivered real value / the visitor showed buying intent), not a generic "give me your email."
- Keep "ask once, then rest" (proven). This is calibration of WHEN and HOW Yuri offers to continue the thread, not a rigid rule or a forced capture. Yuri still decides in-context whether the moment is right. AI-First: prompt guidance that hands the judgment to Yuri, does not constrain her output.

## Out of scope (deferred, correctly)
- Feeder VOLUME (why so few blog→widget clicks) — that's distribution/content work, gated on Bailey per the distribution gate. This PR makes the attribution *correct* so that when volume comes, it's measured.
- Admin funnel dashboard UI — still query-first per the freeze.
- Multi-touch attribution — first-touch is the high-value 80%.

## AI-First
- Fix 1 is pure data capture (a `source` string on the bubble path) — no judgment surface. PASS.
- Fix 2 is prompt COPY that calibrates Yuri's capture ask and explicitly leaves the decision to her — it strengthens the conversion loop without caging the judgment. Run `ai-first-guard` on the plan and `ai-first-check` on the diff.

## Verify
1. `tsc` + `build` clean.
2. Bubble: land with `?from=blog`, open bubble, send a message → `ss_widget_sessions.source = 'blog'`.
3. Bubble via `open-yuri` with `{source:'blog_inline'}` → session row tagged `blog_inline`.
4. Direct visitor, no `?from=`, bubble → `source = 'landing'` (distinguishable from the hero's `landing`, and from true organic NULL — both surfaces now emit `landing` for untagged, which is the honest value).
5. Email ask: read the updated prompt; confirm it asks once, tied to an earned moment, and does not nag.
