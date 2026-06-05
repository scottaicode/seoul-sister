BEFORE writing any code, review the planned approach against Seoul Sister's AI-First architecture principles. This is a PRE-IMPLEMENTATION gate to prevent wasted tokens building something that violates core principles. Run this on the PLAN, before the first edit.

Review the task/plan and flag if ANY of these would occur:

1. **Replacing AI judgment with rigid logic** — Are we substituting a Claude call (Yuri, scanning, extraction, grading) with hardcoded rules, static templates, regex scoring, lookup tables, or deterministic `if skin_type X && condition Y then "use Z"` logic? Claude should evaluate dynamically. (Mechanical DATA extraction — parsing an INCI string, detecting an email, computing a Glass Skin delta — is NOT a violation; that's structured input, not judgment.)

2. **Removing AI capabilities** — Are we permanently disabling a Claude feature? Reducing frequency or optimizing WHEN a model runs (intent-based context loading, prompt caching) is fine. Eliminating intelligence is not.

3. **Constraining AI output** — Are we forcing Yuri into fixed formats, clamping responses, scripting her exact words, or encoding sequencing/choreography rules? Per **Surface Facts, Do Not Instruct**: give the model the one fact it can't infer plus at most one tripwire (a forbidden bad-output). Never script phrasing, timing, or order. Yuri owns the conversation.

4. **Shifting strategy to users or config** — Are we adding configuration that lets users/operators control what Claude should decide (tone, approach, what to recommend)? Users provide facts; AI provides strategy.

5. **Breaking learning loops** — Are we suppressing data that feeds the graded-outcome corpus, decision memory, treatment-phase extraction, ingredient/product effectiveness, or cross-user pattern detection? The labeled, graded outcomes ARE the moat — protect the data that feeds them.

6. **Violating the Yuri Sole Authority Principle** — Are we creating a NON-Yuri surface that generates personalized recommendations ("what the user should DO with their skin")? Recommendation logic lives exclusively with Yuri, who has full context (phase, decision memory, corrections, routine, allergies, climate, cycle). Other surfaces may only: (a) display data, (b) navigate, or (c) offer a Yuri-conversation entry point. No parallel rule-engine recommender. No "Yuri's [thing]" label when Yuri's reasoning isn't actually involved.

7. **Adding non-AI alternatives where AI belongs** — Are we building an outward-facing content-generation, scoring, or strategic-decision feature that SHOULD use a model but doesn't?

8. **Using a weaker model on a user-facing surface** — Per Principle 1, user-facing intelligence (Yuri, scans, grading a user sees, the nudge message) uses the most capable model (Opus). Sonnet is for background processing only. Flag any user-facing path quietly downgraded.

For each concern found, explain:
- What principle it violates
- Why it's a problem
- An AI-First alternative approach

If the plan is clean, say: "Plan is AI-First compliant — proceed with implementation."

If there are concerns, say: "HOLD — [N] AI-First concern(s) found" and list them with alternatives before any code is written.
