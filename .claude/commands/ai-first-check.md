Review all changes made in this session against Seoul Sister's AI-First architecture principles. Run this on the DIFF, before commit. For EVERY file modified, read the actual diff and verify:

1. **No rigid templates or regex replacing AI judgment** — Claude models should evaluate dynamically, not be replaced by hardcoded rules, static templates, lookup tables, or regex pattern matching for DECISIONS. (Mechanical data extraction — INCI parsing, email/phone detection, score-delta math — is fine; it's structured input, not judgment.)

2. **No AI capabilities removed** — If a model call was removed or gated, confirm the model still runs at appropriate times and nothing was permanently disabled. Reducing frequency is fine; eliminating intelligence is not.

3. **No hardcoded constraints on AI output** — Yuri should be free to generate what she determines is best. No clamping responses to fixed formats, no truncating her reasoning, no scripted phrasing/sequencing. Prompt changes follow **Surface Facts, Do Not Instruct**: one fact + at most one tripwire, never a script.

4. **AI still owns strategy** — Users provide facts, AI provides strategy. Changes must not shift strategic decisions (copy, tone, recommendations, scoring) from a model to static logic or user/operator configuration.

5. **Learning loops preserved** — The graded-outcome corpus, decision memory, treatment-phase extraction, effectiveness scoring, and cross-user pattern detection remain intact. Data feeding the learning engine is not suppressed. The moat is the labeled outcomes — protect them.

6. **Yuri Sole Authority Principle intact** — No new non-Yuri surface generates personalized recommendations. Recommendation surfaces route through Yuri; other surfaces only display data, navigate, or offer a Yuri-conversation entry point. No "Yuri's [thing]" label without Yuri's actual reasoning. No `if condition then "use Z"` rule engine presented as advice.

7. **Prompt changes expand, not constrain** — Any system-prompt modification gives the model MORE context or better guidelines, not less freedom to reason. Guardrails that forbid a specific bad output (a tripwire) are allowed; scripts that dictate phrasing are not.

8. **Model tier correct** — User-facing intelligence still runs on the most capable model (Opus); no user-facing path was quietly downgraded to Sonnet.

For each file changed, report:
- **File**: path
- **AI-First Status**: PASS or FLAG
- **Notes**: What was changed and why it's safe (or why it's a concern)

End with a summary: "All changes preserve AI-First principles" or flag specific concerns.

(Best-practices companion gate — verify alongside AI-First: `tsc --noEmit` clean, `next build` clean, no hardcoded secrets, errors handled not swallowed, files not bloating past ~300 lines. AI-First PASS does not substitute for these.)
