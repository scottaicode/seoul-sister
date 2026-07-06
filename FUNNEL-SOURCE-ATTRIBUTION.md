# Funnel Source Attribution — Make Tonight's Funnel Measurable in Our Own Data

**Created:** June 29 2026
**Status:** Building
**Why now:** We shipped 6 funnel PRs tonight (#13–#18) consolidating every "Ask Yuri" entry point onto the landing widget, with GA4 events firing. But the actual conversations land in `ss_widget_*` with **no record of which feeder page drove them**. GA4 can sort of show this; our own moat data cannot. Per the Learning Loop principle, the data that grades a judgment must come back into a readable place. This closes that.

## The gap (verified)

- `ss_widget_sessions` has **no `source` column** (verified against live schema).
- The widget chat route (`/api/widget/chat`) receives `visitor_id` + `session_id` but **never receives or persists `source`** (the `from=blog|product|ingredient|...` we already put in the `?ask=` URLs).
- Result: a Yuri conversation is in our DB, but we can't answer "which feeder page produces the conversations that go deepest / capture an email / show buying intent." That's exactly the question the funnel redesign needs answered.

## What we already have (don't rebuild)

- The landing widget reads `?ask=` and `from=` from the URL (PR #14). It fires `yuri_prefill_arrived { source }` to GA4.
- Every feeder tags its source: `from=blog`, `product`, `ingredient`, `nav`, `ingredient_cta`, `products_cta`, plus nudge `kind`.
- `ss_widget_sessions` already aggregates `message_count`, `intent_signals_detected`, `ai_summary` per session — rich signal once we can group it by source.

## The improvement (this PR)

### 1. Persist `source` onto the widget session (the moat fix)
- Migration: add `source TEXT NULL` to `ss_widget_sessions` (run via app service client — Supabase MCP is read-only).
- Landing widget: when it reads `from=<source>` from the URL, pass it on the FIRST widget chat request (alongside visitor_id/session_id).
- `/api/widget/chat`: accept optional `source`; on session creation, persist it. Only set on the session's first creation (don't overwrite on later messages).
- `createSession(visitorId, count, source?)`: write `source` into the insert.

Now every stored conversation knows its feeder. We can run: "sessions by source → avg message_count, % with intent signals, % email captured." That's the objective read on which content actually drives engaged Yuri conversations — from our own data, the moat, not a third party.

### 2. Complete the click leg (small)
The nudge fires `yuri_nudge_click`, and blog CTAs route, but the blog CTA click itself wasn't a discrete event. The `source` persistence above largely subsumes this (arrival is recorded with source), so we do NOT add redundant click events — arrival + first-message keyed by source is the cleaner signal. (Documented here so a future session doesn't "add click tracking" thinking it's missing — it's intentionally covered by source attribution.)

## Out of scope (future, when volume justifies)

- An admin funnel dashboard UI. For now the data is queryable (SQL) — a dashboard is polish, and per the freeze we build the measurement capture first, read it via query, and only build UI when there's volume to look at.
- Attribution beyond first-touch (multi-touch). First-touch source is the high-value 80%.

## AI-First

Pure data capture (a `source` string) + the existing GA4 events. No AI logic, no judgment surface, no constraint on Yuri. It STRENGTHENS the learning loop by making the funnel's outcome legible in our own data. Expected PASS.

## Verify

1. Migration applied: `ss_widget_sessions.source` exists.
2. `tsc` + `build` clean, AI-First PASS.
3. From a blog "Ask Yuri" click → land on widget → send a message → query `ss_widget_sessions` and confirm the new row has `source = 'blog'`.
4. Direct visitor (no `?ask=`) → session row has `source = NULL` (organic). Distinguishable from feeders.
5. Query proves the read: `SELECT source, count(*), avg(message_count) FROM ss_widget_sessions GROUP BY source`.

## External social attribution tags (added Jul 5 2026)

The `from=` param has **no allowlist** — the widget persists whatever slug it receives (read at `TryYuriSection.tsx:144`, sanitized to `[a-z0-9_]` and capped at 40 chars in `api/widget/chat/route.ts:72`, written on session creation at `:259`). So an external social bio link works with **zero code change** — just point it at `seoulsister.com/?from=<tag>`.

**Naming rule:** external tags must **never contain a person's name** (it sits in a public URL). Use a neutral, platform-parallel slug. Personal credit is derived from the tag → operator mapping below, read at query time — not exposed in the link.

| Public tag (`?from=`) | Channel | Operated by | Bio link |
|-----------------------|---------|-------------|----------|
| `ig_ss` | Instagram (@seoulsisterskin) | Bailey | `seoulsister.com/?from=ig_ss` |
| `tt_ss` | TikTok | Bailey | `seoulsister.com/?from=tt_ss` |

Reason `ig_ss`/`tt_ss` were chosen over `bailey_ig`: Bailey asked that her name not appear anywhere public, and it was showing in the original `?from=bailey_ig` slug.

**Read Bailey's credited social traffic:**
```sql
SELECT source, count(*) AS sessions, round(avg(message_count),1) AS avg_depth,
       count(*) FILTER (WHERE intent_signals_detected > 0) AS intent_sessions
FROM ss_widget_sessions
WHERE source IN ('ig_ss','tt_ss')
GROUP BY source;
```

When a new operator/channel is added, add a row here and pick a name-free slug. No code change is needed for the tag to start tracking.
