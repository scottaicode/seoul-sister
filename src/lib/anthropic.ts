import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY environment variable')
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

export const MODELS = {
  primary: 'claude-opus-4-6' as const,
  background: 'claude-sonnet-4-5-20250929' as const,
} as const
