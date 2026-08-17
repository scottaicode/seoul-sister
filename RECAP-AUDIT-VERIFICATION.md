# Recap Audit — VERIFIED (closed Aug 17 2026)

**Status: VERIFIED. A real production row exists.**

Opened and closed the same day. The row that closed it:

| field | value |
|---|---|
| `recap_status` | `delivered` |
| `body_stored` | **true** (1,532 chars) |
| `recap_subject` | "your Phoenix routine, the short version" |
| `recap_artifacts` | `{"count": 2, "artifacts": ["slot_picks","lineup_conflict_check"]}` |
| `recap_reason` | "Visitor shared their own address expecting a recap of the routine we built together." |

Produced by a real widget conversation through the real capture path — not a hand invocation.
Fires, writes, and reaches a consumer (the audit query below).

**THE HEADLINE RESULT: the email HELD its scope.** The cow did not leave in the email.

---

## The one query that closes this

```sql
SELECT captured_email,
       recap_status,
       recap_artifacts->>'count' AS artifacts,
       recap_subject,
       recap_reason,
       (recap_body_html IS NOT NULL) AS body_stored,
       recap_sent_at
FROM ss_widget_visitors
WHERE recap_status IS NOT NULL
ORDER BY recap_sent_at DESC NULLS LAST
LIMIT 10;
```

The 10 rows from before Aug 17 read `body_stored: false` — sent during the blind period and
unreconstructable. That is the honest record, not a bug, and it must not be "fixed" by
backfilling anything.

---

## What the first row actually showed

**The email obeyed its own rule.** Read in full, it:

- gave **one priority completely** (retire the redundant niacinamide serum)
- **named the withheld artifact honestly** — *"much easier to build with you than to spell out
  in a one-way email that can't adjust when your skin reacts"*
- contained **NO AM/PM sequence** (products named as context, never ordered)
- contained **NO rotation schedule** — the exact artifact Yuri had called subscriber work
- kept the **anti-selling** — *"your #1 priority isn't buying, it's subtracting"*
- pitched in **one soft paragraph** with the real price and "No pressure either way"

**The email is currently CLEANER than the chat.** In the same conversation Yuri gave both AM and
PM sequences by message 2; the email gave one priority and named the rest as subscriber work.

### But the SCORE was wrong, and this is the finding to carry forward

`count: 2` — and reading the body, **both artifacts are false positives**:

- **`slot_picks`** fired on *"COSRX cleanser, Anua toner, BoJ Glow Serum, Illiyoon ceramide cream,
  and sunscreen"* — a comma list **describing what the visitor already owns**, not a delivered
  lineup.
- **`lineup_conflict_check`** fired on *"doing the same job twice"* — `CONFLICT_LANGUAGE`
  catching a phrase used to explain a SINGLE retirement.

`detectCumulativeGive` was built for chat prose, where naming products means recommending them.
In a recap email, naming products is how you remind someone what you discussed. **Same words,
opposite meaning.**

**So do not act on `recap_artifacts` alone. Read the body.** A future session that treats a 2 as
"the email leaked the build" will be wrong, exactly as the first reading of this row was.
Tuning the scorer for email prose is a known open item, deliberately not rushed — one row is
not enough to tune a detector on, and the cost of the current false positive is a misleading
number, not a bad customer experience.

---

## Why this exists (do not re-derive)

The recap email is the surface that **converted the only paying subscriber** this funnel has
produced (Kim Wells, ~14 hours after her chat ended). It is **written fresh by Opus on every
send**, from a **separate prompt** than the chat, and it carries its own explicit scope rule.

Its subject and body were generated, sent, and **discarded**. Only `recap_status` and a Resend
message id survived — so an email that violated its own scope and one that obeyed it left
**identical database state**. Permanently unanswerable.

The sharper point: every give-side instrument built to date (`cumulative-give.ts`,
`tool-grounding.ts`) reads only the **chat**. A leak living in the **email** is invisible to all
of them. That is why this was worth building before more chat-side tuning.

---

## Design decisions worth not relitigating

- **One ruler, not two.** The email is scored with `detectCumulativeGive`, the chat-side
  detector. Two instruments eventually disagree about the same boundary.
- **HTML is stripped preserving line breaks.** The detector is LINE-based (an arrow chain is
  detected per line), so collapsing a multi-line routine into one line changes what it scores.
- **The body is written BEFORE analysis is attempted**, and analysis is wrapped. The body is
  irreplaceable; the score can be recomputed from it forever.
- **A missing audit column never costs the STATUS write.** The delivery/bounce webhook keys on
  `recap_status`. Adding observability must not break a working loop.

Guarded by `tests/recap-body-audit.test.mjs` (7 tests, each verified to fail against its own
bug by revert).

---

## Related open threads

- **`recap_reason` is new.** Yuri writes a one-line justification on every send decision; it was
  previously logged to console and dropped. A suppressed send with no reason was
  indistinguishable from a broken one. Now persisted — worth checking on the first suppression.
- **A disposable address already appeared** (`dnsink.com`, Aug 15). The email gate captures
  addresses that are never read; do not treat capture count alone as a lead metric.
- **Organic conversions are ZERO.** Kim Wells is a warm referral (a family connection), and both
  "converter" rows are the same person on two devices. Any analysis that treats her as a cold
  conversion is unsupported — this voided a conclusion on Aug 17.
