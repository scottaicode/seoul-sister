/**
 * The real conversation shown on the landing page while the chat is closed.
 *
 * RULE: only a real exchange, word for word, from a member who has read this
 * exact text and agreed to it being public. Never an invented or "tidied"
 * conversation; trimming whole sentences from the end is the only edit allowed.
 * While this is null the page shows the labelled illustrative example instead,
 * and says so.
 *
 * To publish one: fill in the object below, record who approved it and when in
 * `approvedBy`, and have the page copy reviewed by a second model first.
 */

export interface YuriExampleMessage {
  role: 'user' | 'assistant'
  text: string
}

export interface RealYuriExample {
  /** The line above the exchange, e.g. "A real conversation, shared with permission". */
  label: string
  messages: YuriExampleMessage[]
  /** Who agreed to this exact text being public, and the date. Required. */
  approvedBy: string
}

export const REAL_YURI_EXAMPLE: RealYuriExample | null = null
