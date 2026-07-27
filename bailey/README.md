# bailey/ — creator channel: arrangement, strategy, scripts, deliverable

Everything for Bailey's TikTok channel (@baileyydonn) in one place. She is Seoul Sister's
co-creator and the channel is the app's primary distribution experiment.

## Send her this

**`Baileys-TikTok-Playbook.pdf`** (or the `.docx` to edit first). One assembled document, written
to her in second person, no internal jargon. 29 scripts plus the strategy behind them.

Everything else in this folder is working source.

## The files

| File | What it is |
|---|---|
| **`Baileys-TikTok-Playbook.pdf` / `.docx`** | **The deliverable.** Built, tracked, current. |
| `guide-src/` | Source of the deliverable + `build.sh` to regenerate it |
| `BAILEY-SCRIPTS-REDDIT-VALIDATED.md` | 10 scripts from topics that already scored on Reddit |
| `BAILEY-SCRIPTS.md` | 6 Seoul Sister + 9 life + 4 Shop scripts |
| `BAILEY-TIKTOK-BLUEPRINT.md` | Strategy, CTA closer table, the 3-arm CTA test, **carousel hypothesis (n=1, untested)** |
| **`CAROUSEL-FEEDBACK-JUL27.md`** + `Carousel-Feedback-Jul27.{pdf,docx}` | **Sent.** Jul 27 read on her first Seoul Sister post (Medicube). Substance excellent (steelmanned the product, no alternative offered, Yuri's memory receipts on screen); app never named, no AI mentioned, FTC co-creator disclosure absent. Built by `guide-src/build-carousel-feedback.sh` |
| `BAILEY-CONTENT-PLAYBOOK.md` | Jul 13 diagnosis ("format problem, not voice problem") |
| `BAILEY-CREATOR-PLAN.md` / `.html` | ⚠️ **PARTIALLY SUPERSEDED Jul 27.** Read for the boundaries she drew (still live). **Not** for promotional guidance — its "no demoing the product" / "no link in captions" posture is reversed by the Jul 25 deliverable. See the header. |
| `BAILEY-FEEDBACK-LOG.md` | Her product corrections, the record behind Yuri Sole Authority |
| `COMPETITOR-VIDEO-STRUCTURES.md` | Teardowns of the creators she models, scored per lane |
| **`POSTING-FREQUENCY-AND-REPOSTS.md`** | **Send-ready.** Jul 27 answer to the "post 30x/day + repost your viral videos" advice. Verdict: cadence 5-7/week (not 30/day — TikTok says 1-4/day, and median views FALL above ~10/week); **never re-upload a winner** (TikTok's Sept 15 2025 enforcement names it, with Creator Rewards clawback + Jul 2026 account-level detection); remake the concept instead. Written to her, sourced. |

## Regenerating the deliverable

```bash
./bailey/guide-src/build.sh
```

Writes to `bailey/` (tracked) and `~/Downloads` (easy to attach). Needs `pandoc` + Google Chrome —
Chrome does the PDF because pandoc's PDF path needs LaTeX, which isn't installed. Don't
"simplify" it to `pandoc -o out.pdf`; it will fail.

**The working `.md` files and the deliverable are maintained separately on purpose** — the working
files carry evidence tiers, SQL and rationale Bailey doesn't need. So **when a script changes,
change it in both**, then rebuild. Silent drift is the failure mode and it has already happened
once.

## Still at repo root (deliberately)

- **`SEOUL-SISTER-VIDEO-PLAYBOOK.md`** — CLAUDE.md names it as a mandatory repo-root read before
  any Yuri video. Moving it breaks a documented instruction.
- **`SOCIAL-VIDEO-ENGINE.md`**, **`REDDIT-VALIDATED-VIDEO-QUEUE.md`** — video system and shot list,
  not Bailey-specific.

## Two rules that override everything else here

1. **Never mix a TikTok Shop tag with a Seoul Sister mention.** Shop penalizes off-app traffic in
   shop-tagged content, including implied references; 24 points in 90 days is a ban.
2. **Personal stories yes, symptom checklists no.** "For me it was stinging" is a story. "Here's how
   you know if yours is damaged" is a diagnosis, and the claims guardrail bans it.
