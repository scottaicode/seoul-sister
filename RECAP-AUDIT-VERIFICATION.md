# Recap Audit — PENDING VERIFICATION (opened Aug 17 2026)

**Status: schema applied, code deployed, ZERO production rows. The loop is NOT verified.**

If you are a fresh session and someone says "the recap audit works," it does not yet. Nobody
has seen a row it produced. Read this before touching it, and before claiming anything about it.

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

**Verified = at least one row with `body_stored: true`.** As of Aug 17 2026 every row reads
`false` — those 10 recaps were sent before the columns existed and are unreconstructable. That
is the honest record of the blind period, not a bug, and it must not be "fixed" by backfilling
anything.

**It fires only when a visitor captures an email in the widget.** There is no cron, no
backfill, no way to trigger it by hand that would prove anything. Per the repo's standing rule,
a hand invocation does not count — the real path must produce the row.

---

## What to do when the first real row appears

1. **Confirm the body stored.** `body_stored: true` and `recap_subject` non-null.
2. **Read `recap_artifacts`.** It is `{"count": N, "artifacts": [...]}` scored by
   `detectCumulativeGive` — the same detector the chat uses.
3. **Interpret `count`:**
   - **≥2** — the recap email is handing over the subscriber build. That would mean **the email
     is the real leak**, and the chat-side give instrument (which was the whole focus of Aug 17)
     is guarding the smaller half of the problem. This is the outcome worth acting on.
   - **0–1** — the email is holding its documented scope (`src/lib/email/lead-email.ts`:
     *"NOT a complete take-home routine"*), and the cow question is answered for this surface.
4. **Read `recap_body_html` yourself.** The score is a starting point, not a verdict — the
   detector was built for chat prose and this is its first contact with email HTML. If the
   score and your reading disagree, the detector is wrong, not the email.

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
