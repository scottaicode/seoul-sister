# Known Issues — Investigated & Dismissed

This file records issues that were investigated and found to be **NOT Seoul Sister
bugs**, so a future session doesn't burn time re-chasing the same ghost. For real
open work, see the "Remaining Work" sections in `CLAUDE.md` and `CHANGELOG.md`.

---

## DISMISSED — Console CSS parse errors (`Unknown property 'cron'`, `filter:CHEMICAL/HYBRID/PHYSICAL/UNVERIFIED`)

**Reported:** June 22 2026, from a live homepage smoke test (browser console open).
**Symptom:** Firefox console on `www.seoulsister.com` shows repeated warnings:
- `Unknown property 'cron'. Declaration dropped.` (~15×, various line numbers of `ffd3bd8e987a9a13.css`)
- `Expected 'none', URL, or filter function but found 'CHEMICAL' / 'HYBRID' / 'PHYSICAL' / 'UNVERIFIED'. Error in parsing value for 'filter'.`
- `Error in parsing value for '-webkit-text-size-adjust'. Declaration dropped.`

**Verdict: NOT a Seoul Sister bug. Do not "fix" the CSS — there is nothing to fix.**

**Why (evidence gathered June 22 2026):**
1. The error file `ffd3bd8e987a9a13.css` IS one of the site's real stylesheets (HTTP 200,
   referenced by the homepage), so the errors are *attributed* to our CSS.
2. BUT the production CSS was fetched and grepped — it contains **zero** occurrences of
   `cron`, `chemical`, `hybrid`, `physical`, or `unverified`. The tokens the parser claims
   to have "found" are not in the file. A stylesheet cannot drop a declaration for a token
   it does not contain — unless something injects those rules into the parse context **in the
   browser after load**. That is the signature of a **browser extension** (privacy / reader /
   dark-mode / a tool literally named or themed "cron") rewriting page styles on the user's
   normal profile.
3. The `[filter:CHEMICAL]` / `[filter:PHYSICAL]` / `[filter:HYBRID]` / `[filter:UNVERIFIED]`
   tokens exist in the codebase ONLY in `src/app/api/routine/generate/route.ts` — as plain
   **text inside Yuri's AI prompt** (server-side), never rendered to the DOM or emitted as CSS.
   `cron` appears only in legitimate server/comment contexts. `globals.css` is clean,
   standard Tailwind. None of these reach a `className` or inline `style`.

**Confirm-it-yourself (30s):** open the homepage in a private/incognito window (extensions
off) with the console open. The `cron` / `filter:CHEMICAL` errors disappear → confirmed
extension, not us.

**Harmless either way:** the browser *drops* the unparseable declarations; nothing on the
page or in the Yuri widget is affected. Verified the widget streams end-to-end the same day
(`POST /api/widget/chat` → streamed answer, counter decremented).

**The genuinely-ours, harmless-standard warnings in the same console** (ignore — every
Next.js + GA4 site logs these): font `preload was not used within a few seconds`, the
`_ga_*` cookie `expires` overwrite, and the GTM `Referrer Policy` notice.

---

## DISMISSED — Console CSS errors: `Dangling combinator` / `Ruleset ignored due to bad selector` / `Expected attribute name but found 'x('`

**Reported:** June 22 2026, surfaced in a Firefox **private-window** test (extensions OFF,
so NOT the extension issue above — this is a separate, real-looking error class).
**Symptom:** repeated warnings against `ffd3bd8e987a9a13.css`:
- `Dangling combinator. Ruleset ignored due to bad selector.` (many)
- `Selector expected. Ruleset ignored due to bad selector.`
- `Expected attribute name or namespace but found 'x('. Ruleset ignored due to bad selector.`

**Verdict: NOT a Seoul Sister bug. The CSS is valid; the local Firefox build is too old to
parse it. Do not change the CSS.**

**Why (evidence gathered June 22 2026):**
1. Fetched the real production `ffd3bd8e987a9a13.css` (96 KB) and inspected it directly:
   - **Zero dangling combinators** (no selector ends in `>`, `+`, or `~` before `{`).
   - **Zero malformed `x(` attribute selectors.** The `'x('` the parser quoted is just a
     fragment of a longer VALID token (inside a `:where(...)`) that the old engine bailed on
     mid-parse.
2. The file contains **237 `:is()` / `:where()` selectors** — emitted by the official
   `@tailwindcss/typography` plugin for the blog `prose` classes (`:where([class~=not-prose])`,
   `:where([class~=lead])`, etc.). This is standard, spec-valid modern CSS.
3. `:is()` / `:where()` shipped in Firefox 78+ (2020). When an OLDER Firefox hits one it can't
   parse, it emits exactly this symptom set ("dangling combinator", "selector expected",
   "expected attribute name but found 'x('") because it bails mid-selector and misreads the
   tail. No `@property`, `@container`, `:has()`, or `&`-nesting is present (none of the truly
   bleeding-edge stuff) — so the only candidate is `:is()`/`:where()` on an old engine.
4. The page renders **fully styled** in the same normal-window screenshots — proof the CSS
   parses correctly on a current engine. Real visitors on current Chrome/Safari/Firefox see
   none of these.

**If you ever want a true-zero console** (cosmetic only, not worth it now): `@tailwindcss/typography`'s
`:where()` wrapping is intentional (keeps `prose` specificity low so it's easy to override).
Removing it isn't advisable. The right move is simply to update the local Firefox; do NOT
hand-edit generated CSS.
