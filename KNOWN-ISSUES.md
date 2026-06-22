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
