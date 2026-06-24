# ElevenLabs TTS Playbook — Seoul Sister

> How to get the best-sounding narration out of ElevenLabs (Eleven v3). Written Jun 19 2026
> after the tagged-block rewrite produced a clearly better cold-open take than the flat v1 lines.
> This is the canonical method for ALL Seoul Sister VO (launch video, social videos, Yuri lines).

---

## The 5 rules that made the difference

1. **Write in 250+ character BLOCKS, not single lines.**
   v3 is inconsistent on short fragments — the same one-liner generates differently every run, which
   is what made v1's takes feel mismatched. Grouping consecutive beats into one ~250-char block gives
   v3 enough runway to settle into a consistent read. **Split the block back into separate clips later
   in CapCut**, at the natural sentence gaps. You record long, you cut short.

2. **Tags in [brackets] are performance cues, not spoken words.**
   `[warm]`, `[sighs]`, `[empathetic]`, `[sincere]`, `[softly]`, `[curious]`, `[reassuring]`,
   `[knowing]`, `[matter-of-fact]`. They shape the line that FOLLOWS them until the next tag.
   v3 reads them silently. The tags are what separate "competent" from "she actually feels it."
   Don't over-tag — Seoul Sister's voice is understated. 2–4 tags per block is plenty.

3. **Punctuation IS the direction. v3 ignores visual line breaks; it only hears punctuation.**
   - `…` (ellipsis) = a weighted dramatic pause. Use at the emotional beats ("not even sure it's real…").
   - `.` (period) = a full stop / separate beat. "Spent hundreds. Tried everything." = three hammer taps.
   - `,` (comma) = a quick breath.
   - CAPS = emphasis on that word (use sparingly).
   Never mash sentences together to "tidy" the box — the gaps are the performance.

4. **Stability = Creative for emotional narration. (LOCKED for Seoul Sister VO.)**
   Creative makes the tags actually land — warmth, sighs, empathy come through. Natural flattens them.
   THE TRADE-OFF: Creative occasionally **hallucinates a word** that isn't in the script
   (real example Jun 19: it inserted "Rightful" into the cold open). This is catchable and free to fix.
   A flat Natural take is NOT fixable. So: Creative + the reject-bad-takes habit below.

5. **Reject any take that changes a single word. Regenerate — it's just credits.**
   Each Generate gives 2 takes. Listen to both. If a take adds/drops/swaps ANY word, discard it.
   If both drift, hit Generate again (you have hundreds of thousands of credits — never settle).
   Keep the take that (a) follows the script exactly AND (b) has the warmest read.

---

## The workflow, step by step

1. ElevenLabs → **Text to Speech** → Voice = the target voice (SS Narrator for VO, Yuri for Yuri lines).
2. Model = **Eleven v3**. Stability = **Creative**. Output = MP3 44.1kHz 128kbps.
3. Paste ONE block (with tags + punctuation as written). Don't tidy the wrapping.
4. **Generate speech.** You get 2 takes.
5. Play both. Reject any with a word change or a flat read. Regenerate if needed.
6. **Download the keeper** (let it save with the default name — rename in batch at assembly time).
7. Repeat per block. In CapCut, split each downloaded block into its named clips at the sentence gaps.

---

## Why we record long blocks but cut short clips

The video timeline needs short, separately-timed VO clips (each synced to a scene). But v3 sounds best
on long blocks. Resolve the tension by recording the long block, then in CapCut splitting the audio clip
at the silence between sentences — each piece becomes its own timed clip. Same audio quality, scene-level
timing control. The "split points" are called out per block in the script docs.

---

## Voices

- **SS Narrator** — custom Voice Design voice (ElevenLabs, created Jun 19 2026, option 1 of 3). The video
  NARRATOR. Replaced the Kimberly Library voice (Kristy recognized it from TikTok — too common).
- **Yuri** — the locked Yuri voice (her on-screen spoken bookend lines). Different role from the narrator;
  never use the narrator voice for Yuri or vice-versa.

Both get the SAME treatment above: Creative stability, tagged blocks, reject-bad-takes.
