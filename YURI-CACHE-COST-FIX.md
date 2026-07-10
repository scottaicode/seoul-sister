# Yuri Prompt-Cache Cost Fix (2026-07-10)

Ported from the LGAAS advisor cost fix ("Richard", same day). **Yuri's fix is the
SIMPLER HALF of the LGAAS fix** — her clock tail was already in the `system` block
(the correct place), so she needed only the *clock split*, NOT LGAAS's trailing
`role:'system'` message-array machinery. Do not re-introduce that complexity here.

## The bug

`buildSystemPrompt()` appended a minute-granularity `## RIGHT NOW` clock to the
tail of the cached `system` block. Prompt caching is a **prefix match**, so that
one ticking value invalidated the entire ~22K-token cached prefix every minute:
warm turns re-wrote the whole prompt to cache instead of reading it cheaply.

A secondary defect: `memory.ts` rendered computed relative-time strings
(`${daysAgo} days ago`, `60+ days ago`, `M days remaining`) inside the same cached
block. These tick *daily* (cheaper than the per-minute clock, but the same class
of defect) and are also just wrong on their own merits.

## Step 0 — measured, in production, before any code change

Query (`ss_ai_usage`, `feature='yuri_chat'`), warm turns only:

| metric | advisor (buggy) | widget (healthy control) |
|---|---|---|
| min cache-write on a warm turn | **21,240** | **0** |
| avg cache-write on a warm turn | 37,815 | 3,517 |

Not one advisor warm turn ever wrote ≈0. The ~21K write floor == the static
prompt size, rewritten every message. The widget (same cache marker, no volatile
tail) showed `min_write=0` — proving the pattern is fixable. Two numbers,
**21,240 vs 0**, are the whole story.

## The fix

1. **Clock split** (`advisor.ts`): `buildSystemPrompt()` returns
   `{ cachedPrompt, clockBlock }`. The stream call delivers the cached body as
   the ephemeral-marked `system` block, and the clock as a **separate, unmarked**
   block after it (uncached — correct for volatile content). Behind a default-on
   kill switch: `YURI_CLOCK_SPLIT_ENABLED` (`!== 'false'`). When off, the clock is
   folded back into the cached body **byte-for-byte identical** to pre-fix — revert
   is an env flip, no deploy. The clock's TEXT does not change by one character.

2. **Relative-time → raw dates** (`memory.ts`): decisions, commitments,
   corrections, open loops, glass-skin history now render the raw stored date and
   let Yuri compute elapsed/remaining against `## RIGHT NOW`. Correctness fix
   first, cache-stability second. The `daysAgo >= 7` cadence *gate* is preserved
   (real infrequent behavior, not a per-render tick).

## Verification (all three passed before commit)

- **Guard test** `tests/advisor-cache-shape.test.mjs` (`npm test`, ~50ms, no
  tokens): asserts the clock lives in `clockBlock`, never in the cached `parts[]`,
  and that the kill switch exists. **Proven to fail** when the clock is re-pushed
  into `parts[]`, pass when fixed.
- **Byte-diff, real function, across a minute boundary (65s):** two
  `buildSystemPrompt()` builds at 12:29 vs 12:30 → `cachedPrompt` **byte-identical
  (39,085 bytes)**, `clockBlock` changed. Confirms no second volatile value hides
  in the cached prefix ("a correct root cause is not a complete one" — cleared).
- **Live-API warm A/B, across a minute boundary:**
  - ON (fix): turn 1 `write=13314 read=0` (cold); turns 2 & 3 (after minute
    crossing) `write=0 read=13314`. ✅
  - OFF (kill switch, folded clock, crossing minutes): every minute-crossing turn
    `write=13577`. ✅ (First OFF run wrongly showed write=0 because all 3 requests
    landed in the *same minute* — the "same-minute landing by luck" artifact
    Richard warned about; re-ran honestly across boundaries.)

## Post-deploy verification (run this tomorrow against real traffic)

The single number that proves it held: **min cache-write on WARM turns**. Should
drop from ~21,240 toward ~0.

**Important on the filter:** `cache_read_tokens > 6000` intentionally selects
**warm turns only**. It excludes both (a) the ~5,930-token tool-result-suffix
rounds AND (b) the cold first-turn of each conversation (which writes ~13K and
reads ~0 — a cold turn legitimately SHOULD write, so it must not pollute the
warm-turn average). Read the result strictly as "warm turns," never "all turns."

```sql
-- Warm turns only (label it as such — cold first-turns are excluded by design).
SELECT
  count(*) AS warm_turns,
  round(min(cache_creation_tokens)) AS min_write_on_warm,   -- was 21,240; expect ~0
  round(avg(cache_creation_tokens)) AS avg_write_on_warm,
  round(avg(cache_read_tokens))     AS avg_read_on_warm,
  round(avg(cost_usd)::numeric, 5)  AS avg_cost_warm
FROM ss_ai_usage
WHERE feature = 'yuri_chat'
  AND cache_read_tokens > 6000        -- warm turns: excludes tool-suffix rounds AND cold starts
  AND created_at > now() - interval '2 days';
```

To see BOTH populations explicitly (so the number can't be misread), group
instead of filter — `is_warm=true` is the row that must show `min_write ≈ 0`:

```sql
SELECT
  (cache_read_tokens > 6000) AS is_warm,   -- true = warm turn, false = cold start / tool-suffix
  count(*) AS turns,
  round(min(cache_creation_tokens)) AS min_write,   -- warm row: was 21,240; expect ~0
  round(avg(cache_creation_tokens)) AS avg_write,
  round(avg(cache_read_tokens))     AS avg_read
FROM ss_ai_usage
WHERE feature = 'yuri_chat'
  AND created_at > now() - interval '2 days'
GROUP BY 1 ORDER BY 1;
```

If `min_write` on the warm row is still large after real multi-turn traffic, the
split did not take — check `YURI_CLOCK_SPLIT_ENABLED` isn't set to `false` in
Vercel env (it should be **unset** — the fix defaults on; the flag exists only in
code as the revert lever, not in the Vercel dashboard).

## Widget — NOT affected

`src/app/api/widget/chat/route.ts` builds its `system` from static text + raw-string
visitor memory only. No clock, no relative-time. Confirmed in code AND data
(`feature='widget_chat'` warm `min_write=0`). No change needed.
