// ---------------------------------------------------------------------------
// Voice Quality Post-Processing — Remove AI artifacts from Yuri's responses
// ---------------------------------------------------------------------------
// Applied BEFORE saving to DB (after streaming completes) so conversation
// history and summaries are clean. Users see the raw stream in real-time
// (latency-sensitive), but saved text is polished.
//
// These patterns catch common Claude-isms that slip through despite Yuri's
// system prompt instructing her to avoid filler. The system prompt handles
// most of the voice work; this is a safety net for edge cases.
// ---------------------------------------------------------------------------

interface CleanupRule {
  pattern: RegExp
  replacement: string
}

const BANNED_PATTERNS: CleanupRule[] = [
  // Opener clichés — these should never start a Yuri response
  { pattern: /^Great question!\s*/i, replacement: '' },
  { pattern: /^That's a great question!\s*/i, replacement: '' },
  { pattern: /^That's a really great question!\s*/i, replacement: '' },
  { pattern: /^I'd be happy to help!?\s*/i, replacement: '' },
  { pattern: /^I'd love to help!?\s*/i, replacement: '' },
  { pattern: /^Absolutely!\s*/i, replacement: '' },
  { pattern: /^Of course!\s*/i, replacement: '' },
  { pattern: /^Sure thing!\s*/i, replacement: '' },
  { pattern: /^Let me break this down\.?\s*/i, replacement: '' },
  { pattern: /^Here's what I think\.?\s*/i, replacement: '' },
  { pattern: /^What a great question!\s*/i, replacement: '' },
  { pattern: /^That's an excellent question!\s*/i, replacement: '' },

  // Limitation disclaimers — Yuri should state what she CAN do, not lead with can't
  { pattern: /^So I can't [^.]+, but /i, replacement: '' },
  { pattern: /^I can't [^.]+, but /i, replacement: '' },
  { pattern: /^Unfortunately,? I (?:can't|don't have|am not able to) [^.]+, but /i, replacement: '' },

  // Conversational filler openers (not caught by the "Great question" set)
  { pattern: /^Ha,?\s+/i, replacement: '' },
  { pattern: /^Haha,?\s+/i, replacement: '' },
  { pattern: /^Love to hear that\.?\s*/i, replacement: '' },
  { pattern: /^Love that\.?\s*/i, replacement: '' },
  { pattern: /^So glad to hear that\.?\s*/i, replacement: '' },
  { pattern: /^Good question,?\s*/i, replacement: '' },
  { pattern: /^Really good question,?\s*/i, replacement: '' },
  { pattern: /^Ooh,?\s+/i, replacement: '' },
  { pattern: /^Oh,?\s+I love /i, replacement: 'I love ' },

  // Mid-sentence filler phrases (Claude inserts these as transitions)
  // Handle after comma, period, exclamation, colon, or line-start
  { pattern: /[,!.:]?\s*[Ll]et me break (?:it|this|that) down[.,:]?\s*/g, replacement: '. ' },
  { pattern: /[,!.:]?\s*[Ll]et me walk you through (?:this|that|it)[.,:]?\s*/g, replacement: '. ' },
  { pattern: /[,!.:]?\s*[Ll]et me explain[.,:]?\s*/g, replacement: '. ' },
  { pattern: /[,!.:]?\s*[Ll]et me unpack (?:this|that)[.,:]?\s*/g, replacement: '. ' },
  { pattern: /[,!.:]?\s*[Hh]ere's the (?:thing|deal)[.,:]?\s*/g, replacement: '. ' },
  { pattern: /[,!.:]?\s*[Hh]ere's what's going on[.,:]?\s*/g, replacement: '. ' },
  { pattern: /,? I'll be honest[.,:]?\s*/gi, replacement: '. ' },
  { pattern: /,? if I'm being honest[.,:]?\s*/gi, replacement: '. ' },

  // Em-dash overuse (replace with comma when between words)
  // Only replace spaced em-dashes, not unspaced ones used intentionally in Korean terms
  { pattern: / — /g, replacement: ', ' },

  // Corporate filler phrases
  { pattern: /\bit's worth noting that /gi, replacement: '' },
  { pattern: /\bit's important to note that /gi, replacement: '' },
  { pattern: /\bit is worth noting that /gi, replacement: '' },
  { pattern: /\bit is important to note that /gi, replacement: '' },
  { pattern: /\bin conclusion,? /gi, replacement: '' },
  { pattern: /\bto summarize,? /gi, replacement: '' },
  { pattern: /\bto sum up,? /gi, replacement: '' },
  { pattern: /\bfurthermore,? /gi, replacement: 'also, ' },
  { pattern: /\bmoreover,? /gi, replacement: 'also, ' },
  { pattern: /\badditionally,? /gi, replacement: 'also, ' },
  { pattern: /\butilize\b/gi, replacement: 'use' },
  { pattern: /\butilizing\b/gi, replacement: 'using' },
  { pattern: /\butilization\b/gi, replacement: 'use' },

  // Trailing filler questions — anchored to end-of-response so diagnostic
  // questions mid-paragraph are never touched. Only strip the closer-at-end
  // pattern. System prompt is the primary fix; this is a safety net.
  // Matches: optional leading newline/space, the filler, optional trailing punctuation.
  { pattern: /\s*(?:Sound good|Sounds good|Does that sound good|Does that feel doable|Want me to [^?]{1,80}|Make sense|Does that make sense|Sound like a plan|Ready to (?:dive in|get started))\??\s*$/i, replacement: '' },

  // Double spaces from removal
  { pattern: /  +/g, replacement: ' ' },
]

// ---------------------------------------------------------------------------
// Phantom tool-call narration stripper (LGAAS pattern, ported from
// advisor-conversation.js stripPhantomToolCallNarration).
//
// When Opus runs in long, dense conversations with tool use available, it
// sometimes narrates its own reasoning about phantom tool calls into the
// user-facing text — "Ignore that tool call, misfire on my end", "tool call
// I just fired, misfire on my end". The narration references something that
// did not happen. v10.2.1 added a preventive Tool-Call Honesty rule to the
// system prompt, but prompt-level rules don't catch every slip on dense
// contexts. This is a defensive backstop.
//
// Caller invokes this only when NO real tool fired this turn — any tool-call
// apology in that case is fabrication and safe to remove.
//
// LGAAS observed this in production (Apr 24 long-thread test). Seoul Sister
// uses the same model (Opus 4.7), same architecture, same tool-use pattern.
// Sample size is the only reason we haven't seen it yet.
// ---------------------------------------------------------------------------
const PHANTOM_TOOL_NARRATION_REGEX = /(?:^|\n)\s*(?:also\s+)?ignore that tool call[^\n]*?(?:misfire|mistake|misfired|cleanup list|fired by mistake|same misfire)[^\n]*\.?\s*(?:\n|$)/gi
const PHANTOM_TOOL_FOLLOWUP_REGEX = /(?:^|\n)\s*(?:adding (?:it )?to the cleanup list|adding to the cleanup list)[^\n]*\.?\s*(?:\n|$)/gi

/**
 * Strip phantom tool-call narration from assistant text. Only call when no
 * real tool fired this turn — otherwise this could accidentally strip a
 * legitimate apology about a real tool failure.
 *
 * Returns the cleaned text, and logs to console.warn when stripping occurred
 * so we can monitor in production whether the LGAAS-observed pattern actually
 * shows up in Yuri.
 */
export function stripPhantomToolCallNarration(text: string): string {
  if (!text || typeof text !== 'string') return text
  let stripped = false

  let cleaned = text.replace(PHANTOM_TOOL_NARRATION_REGEX, () => {
    stripped = true
    return '\n'
  })
  cleaned = cleaned.replace(PHANTOM_TOOL_FOLLOWUP_REGEX, () => {
    stripped = true
    return '\n'
  })

  // Collapse multiple consecutive blank lines that the strip can leave behind
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  if (stripped) {
    console.warn(`[YURI][phantom-tool-strip] removed phantom tool-call narration: "${text.slice(0, 200)}..."`)
  }

  return cleaned
}

/**
 * Clean AI artifacts from Yuri's response text.
 * Safe to call on any text — returns cleaned version.
 */
export function cleanYuriResponse(text: string): string {
  let cleaned = text

  for (const { pattern, replacement } of BANNED_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement)
  }

  // Trim leading/trailing whitespace per line (but preserve intentional line breaks)
  cleaned = cleaned
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()

  // Fix sentence-start capitalization after removal of opener phrases
  // If the first character is now lowercase (because we removed a prefix), capitalize it
  if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }

  return cleaned
}
