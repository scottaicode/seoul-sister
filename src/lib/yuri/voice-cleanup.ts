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

  // Double spaces from removal
  { pattern: /  +/g, replacement: ' ' },
]

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
