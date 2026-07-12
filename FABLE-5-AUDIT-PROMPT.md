# Fable 5 Audit Prompt — Seoul Sister

**How to use this**: paste everything below the line into a fresh Fable 5 session with repo access. Give it no other framing — the prompt is deliberately self-contained, and it deliberately does not tell Fable 5 who wrote the code it's auditing.

---

You are auditing a production codebase called **Seoul Sister** (`seoulsister.com`), a K-beauty intelligence platform whose core product is **Yuri**, an AI skincare advisor (Claude Opus 4.8) that runs both an anonymous landing-page chat widget and an authenticated in-app advisor.

Your job is **not** to make this product better. Read that again — it is the most common way this audit goes wrong.

## The situation, stated honestly

This is a genuinely good product with **almost no validated demand**. Ignore any instinct to improve the product; the binding constraint is commercial, not technical.

Hard numbers from the live database (as of July 12 2026):

| Metric | Value |
|---|---|
| Anonymous widget visitors (all time) | 38 |
| Widget sessions | 44 |
| Widget messages | 253 |
| **Sessions that died after ONE message** | **18 of 44 (41%)** |
| Sessions reaching 6+ messages | 4 |
| Average messages per session | 2.9 |
| **Emails captured** | **1** |
| **Widget → paid conversions** | **0** |
| Active paid subscriptions (total, all sources) | 1 |
| Price | $24.99/mo |

The quality of Yuri's advice is **not** in question and is not what you are auditing. Independent review of the transcripts shows she is honest (refuses to invent product data, admits when something isn't in the catalog, talks users *out of* purchases), tool-grounded, and clinically careful. The lighthouse user — a nurse, five months, 51 conversations — is so satisfied she has started building TikTok and Instagram accounts to promote the product unpaid. **The product works. Strangers do not pay for it.** That gap is the entire subject of this audit.

## Hard constraints (violating these makes your output worthless)

1. **Do NOT propose new features.** The repo has a standing feature freeze (`NORTH-STAR.md`, enforced by a `/ship-guard` command). New capability is explicitly forbidden until visitor→paid conversion is measured and moving. If your instinct is "you should build X," suppress it.
2. **Do NOT propose redesigns, rebrands, test-coverage initiatives, or architecture refactors.** These are the generic outputs of a code audit and they are all off-target here.
3. **Do NOT trust the existing code comments or commit messages as evidence of correctness.** Several are confidently wrong. Verify claims against the actual code and the actual data.
4. **Ground every claim in something you can point at** — a file and line, a query result, a specific transcript. Assertions without evidence are noise. If you are uncertain, say so explicitly rather than hedging in confident prose.

## The AI-First doctrine you must respect

This codebase has a load-bearing architectural principle you need to understand before you suggest changing anything:

- **Yuri owns all judgment.** No surface in this app generates a personalized recommendation via rules, lookup tables, or `if skin_type === X && humidity > Y` logic. Recommendation logic lives exclusively with the model, which has the full context. Seven separate incidents of algorithmic recommenders sneaking in were caught and removed (documented in `CLAUDE.md`, "Yuri Sole Authority Principle").
- **Surface the fact, never cage the judgment.** The correct fix for "the model isn't doing X" is almost always to give the model *more context*, never to hardcode X.
- If you propose replacing any model judgment with deterministic logic, you must justify it against this doctrine explicitly. Usually you will be wrong to.

## Your three tasks, in priority order

### Task 1 — Try to break four recent changes (highest value)

Four commits shipped today. Assume they contain defects and **hunt for them adversarially**. Do not review politely; try to find the input that makes each one fail.

```
795c728  fix(ingredients): stop unsplit INCI dumps polluting the public ingredient pages
639850c  fix(widget): give Yuri the conversation state she needs to actually make the email ask
3fcbb60  fix(routine): stop add/remove_from_routine writing the wrong product
0f36c34  docs(v11.1.0)
```

Files: `src/lib/pipeline/ingredient-parser.ts`, `src/app/api/ingredients/route.ts`, `src/app/api/widget/chat/route.ts`, `src/lib/yuri/tools.ts`.

Specific attacks worth attempting:

- **`ingredient-parser.ts`**: it now splits INCI strings on `@` and `[`/`]`, strips shade labels via regex, and drops any parsed name over 60 chars or containing `@[]`. Find a **legitimate** INCI ingredient name that this destroys or silently drops. (Known landmine it was built to avoid: `1,2-Hexanediol`, the catalog's most-linked ingredient at 504 products, which an earlier comma-split was silently truncating to `2-Hexanediol`. Are there others in that family — bracketed CI color numbers, parenthetical concentrations, names legitimately >60 chars?) Also: the shade-label-stripping regexes are aggressive. What real ingredient starts with a short word followed by a colon?
- **`widget/chat/route.ts`**: a factual "Conversation State" block is now injected into the system prompt each turn (turn number, whether an email is on file). The claim is that this lets Yuri time a once-per-conversation email ask that she previously never made. Attack it: does `turnNumber` compute correctly when `session` is null (persistence failure path)? Does the injected block get cached correctly given `cache_control: ephemeral` is set on the system prompt — **does appending a per-turn-varying string to a cached system prompt break the prompt cache on every single turn?** (This is a real cost concern. Check it.) Is there a `>= 6` threshold in there that constitutes a rule engine sneaking in?
- **`tools.ts`**: `executeAddToRoutine` / `executeRemoveFromRoutine` now use `resolveProductByNameStrict` and refuse near-miss writes. Find the case where this refuses a product it *should* have matched, breaking a flow that used to work. Also audit the **still-unguarded** callers of the loose `resolveProductByName` — `executeGetProductDetails`, `executeComparePrices`, `executeGetPersonalizedMatch`, `executeCheckIngredientConflicts`, `executeFindProductDupes`. Which of those can produce a *confidently wrong safety claim* about a product the user actually owns? Rank them by real-world harm.

### Task 2 — Answer the one question that matters

**Why do 18 of 44 people send exactly one message to Yuri and never send a second?**

This is the actual bottleneck and it sits *upstream* of everything else. An email-capture fix is worthless if 41% of people leave before turn two. Not one of these one-message visitors is a bot — check the transcripts.

The data is in Supabase: `ss_widget_sessions`, `ss_widget_messages` (full transcripts, `role`, `content`), `ss_widget_visitors`, `ss_widget_intent_signals`. The landing widget is `src/components/widget/TryYuriSection.tsx`; its API is `src/app/api/widget/chat/route.ts`; Yuri's widget system prompt is the `YURI_WIDGET_SYSTEM` constant in that route file.

Read the **actual first-message-and-died transcripts** and compare them against the ones that continued. Form a specific, evidence-backed hypothesis. Candidate directions worth testing (do not assume any of them — check):

- Is Yuri's *first* response too long, too dense, or does it end in a way that gives the visitor nothing to do next? (Note: the prompt explicitly forbids her from ending with "Sound good?"-style closers, on the theory they're an AI tell. Is that rule backfiring by killing the conversational hook?)
- Do the four quick-prompt buttons produce a satisfying dead-end — a complete answer that resolves the user's curiosity and ends the relationship?
- Is there latency, a rendering failure, a mobile viewport problem, or a streaming bug that makes the first response feel broken?
- Are these people getting a *good* answer and simply leaving satisfied — i.e. is the free tier too generous, giving away the whole value in one turn?

Then tell me which of these it actually is, with transcript evidence. If the data cannot distinguish between hypotheses, **say so and specify the smallest experiment that would**, rather than picking one and dressing it up.

### Task 3 — Find the recurrence of one bug class

Both bugs fixed today were **omission bugs of the same shape**: a correct rule was documented, a safe helper function existed, and some call sites simply weren't wired to it.

Concretely: `resolveProductByName`'s own doc comment (`src/lib/yuri/tools.ts`, ~line 240) states *"Write-path callers must treat 'partial' as do-not-silently-substitute."* Three write paths honored it. Two did not, and silently wrote a foot-care product into a user's facial routine.

Search the codebase for **other instances of this pattern**: a documented invariant or a safe wrapper that some callers bypass. Report each with file/line and the concrete harm. Then propose the **structural** fix that makes the bug class impossible rather than fixing instances one at a time (e.g. making the unsafe function private so choosing it is a deliberate, greppable act).

## Output format

Give me, in this order:

1. **Defects found** — ranked by real-world harm. For each: file:line, the exact input that triggers it, what breaks, and whether it's live in production right now. Say plainly if you found none in a given area; do not manufacture findings to fill space.
2. **The one-message-death diagnosis** — your evidence-backed answer to Task 2, with transcript quotes. Include your confidence level and what would change your mind.
3. **The bug-class audit** — Task 3 findings plus the structural fix.
4. **What you would do next, if the goal is the first paying stranger** — maximum three items, ranked. No new features. If your honest answer is "the code is fine, the problem is distribution," say that plainly; it is a legitimate and useful finding.

Be blunt. If something I've told you is wrong, or if the premise of a task is mistaken, say so directly — that is more valuable than a polished answer to the wrong question.
