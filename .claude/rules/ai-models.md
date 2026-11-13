---
paths:
  - "src/lib/anthropic.ts"
  - "src/lib/llm-request.ts"
  - "src/lib/yuri/**"
  - "src/lib/widget/**"
  - "src/app/api/yuri/**"
  - "src/app/api/widget/**"
  - "src/lib/intelligence/**"
  - "src/lib/learning/**"
  - "src/lib/scanning/**"
  - "scripts/ab-*.ts"
  - "tests/llm-request-layout.test.mjs"
  - "tests/background-sonnet55-migration.test.mjs"
---

## AI Model Usage

Model IDs live in `src/lib/anthropic.ts` (`MODELS`). Never hardcode one at a call site.

- **Claude Opus 5.5** (`claude-opus-5-5`, `MODELS.chat`, `CHAT_EFFORT = 'low'`): the three Yuri conversations — landing widget, authenticated advisor, onboarding. Moved Oct 7 2026 on a measured A/B (v11.39.0): −24% per real conversation vs Opus 4.8 (−38% before the search retry), and a blind Fable 5.1 judge preferred it on 16 of 20 real widget turns (4.8 won 1).
  - **Thinking cannot be disabled on 5.5; effort is the cost control.** `medium` (the API default) erased the entire 20% per-token price cut and added ~6s/turn. Thinking counts toward `max_tokens`, which is why the chat ceilings are 6000-8000.
  - **Forced `tool_choice` (`any`/`tool`) returns a 400 on 5.5.** The keyword heuristics (`shouldWidgetForceToolUse`, `shouldForceToolUse`) now add a fact line and, if the reply names products with no tool behind it, retry the round ONCE (`nextRoundAction` in `src/lib/llm-request.ts`; kill switch `YURI_SEARCH_RETRY_ENABLED=false`). Never reintroduce `tool_choice` on a chat surface; a test fails if you do.
  - **Tool loops pass the model's content back unchanged** — 5.5's thinking blocks are invalid if edited.
  - **`stop_reason: 'refusal'`** re-runs the round once on `MODELS.primary`; a second refusal shows `DECLINED_REPLY`, never a fake "database" error.
- **Claude Opus 4.8** (`claude-opus-4-8`, `MODELS.primary`): one-shot user-facing analysis — label scanning, counterfeit detection, skin/glass-skin analysis, dupes, routine generation, lead/recap email, proactive nudges, SEO guardian, content generation. Low volume and not yet re-tested on 5.5; move each only with its own A/B.
- **Claude Sonnet 5.5** (`claude-sonnet-5-5`, `MODELS.background`, since v11.42.0 Oct 19 2026): background processing only (memory summaries, decision memory, onboarding extraction, titles, treatment phases, widget visitor memory, learning patterns, product/ingredient pipeline). Sonnet 4.5 was deprecated Sep 30 2026 and **retires Nov 30 2026**.
  - **Every request goes through `adaptParamsForModel` in the shared client** (keyed on the model ID): no/disabled thinking becomes adaptive thinking at effort `low`; sampling params are dropped (400 on 5.5). Not `between_tools` (5.5's thinking-off): measured on a real conversation, decision memory caught a Fitzpatrick I->II correction 1/3 with thinking off vs 3/3 adaptive-low, same output size.
  - **Kill switch:** set `AI_BACKGROUND_MODEL=claude-sonnet-4-5-20250929` to roll back without a deploy (only until Nov 30). Adapter leaves other models untouched.
  - **Size `max_tokens` from measurement, never by feel.** `scripts/ab-background-sonnet55-sites.ts` runs the real functions on real inputs against both models. 5.5 writes 10-40% more; the old 500 cap on learning-pattern extraction had been truncating 4.5 itself (5/5 conversation runs, 3/5 review runs). `tests/background-sonnet55-migration.test.mjs` holds every cap at >=1.5x the measured max.
  - **The shared client wrapper must return the SDK's own promise.** Returning `p.then(...)` drops `APIPromise.withResponse()`, which `messages.stream()` calls internally, so all three Yuri chat surfaces broke while every stubbed test passed. `tests/anthropic-client-real-sdk.test.mjs` executes the real SDK with `fetch` stubbed.
  - Read output with the first text block (or `responseText()`), never `content[0]`: thinking blocks can come first and a refusal has no text.
  - Not yet visible in data: background truncations/refusals only `console.warn` (deferral `background_truncation_not_in_data` in `ss_pipeline_runs`). Seven one-off `scripts/*.ts` still hardcode 4.5 with their own clients and stop working Nov 30.

### Request layout for chat surfaces (LOAD-BEARING — v11.39.0)

All three chat surfaces build requests through `src/lib/llm-request.ts`:
- **System = static prompt(s) only.** Per-turn context (conversation state, clock, specialist, give/email facts) goes in a **trailing `role:'system'` message after the newest user message** (`withTrailingContext`). As a system block it rendered in front of the history, so every turn re-wrote the whole transcript to cache (measured 2K → 9K tokens/turn of writes; flat ~1K after).
- **Widget breakpoint is on the visitor's message** (`markLastUserMessage`). **Advisor/onboarding keep it on the last assistant message** (`markPenultimateAssistant`), applied BEFORE the trailing message is appended — the advisor tags history with `[Mon 8:44 PM]` timestamps but not the current message, so a breakpoint on the current message would never be re-read.
- **The advisor caches `[static Yuri prompt][user context]` as two blocks** (`cachedBlocks`), so a mid-conversation data write (a saved product, a background extraction) re-writes only the context and everything after it, not the ~20K-token static prompt. That is the leading explanation (6 of 7 misses on one real conversation lined up with a write) for the long-open "system block missed after a tool turn" residual.
- 4 cache breakpoints max per request: the advisor uses all 4 (tools, 2 system, history). Add none.
- **Preserved thinking:** history is rebuilt from stored TEXT every turn, so no thinking block is ever replayed across turns; within a turn the loop only appends. That keeps us clear of Opus 5.5's history-editing check (enforced for accounts created on/after Aug 31 2026) regardless of account age. If you ever persist and replay raw assistant content blocks, re-read the migration guide first.
- `tests/llm-request-layout.test.mjs` executes these helpers; every assertion was confirmed to fail when its bug is reverted.
