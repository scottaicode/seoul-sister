/**
 * Pipeline Cost Tracker
 *
 * Tracks Anthropic API token usage and estimates costs per pipeline run.
 * Sonnet 4.5 pricing: $3 / 1M input tokens, $15 / 1M output tokens
 */

const SONNET_COST_PER_INPUT_TOKEN = 3 / 1_000_000
const SONNET_COST_PER_OUTPUT_TOKEN = 15 / 1_000_000

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
}

export class CostTracker {
  private totalInput = 0
  private totalOutput = 0
  private callCount = 0

  /** Record token usage from one API call */
  record(usage: TokenUsage): void {
    this.totalInput += usage.input_tokens
    this.totalOutput += usage.output_tokens
    this.callCount++
  }

  /** Estimated USD cost so far */
  get estimatedCostUsd(): number {
    return (
      this.totalInput * SONNET_COST_PER_INPUT_TOKEN +
      this.totalOutput * SONNET_COST_PER_OUTPUT_TOKEN
    )
  }

  /** Summary stats */
  get summary() {
    return {
      calls: this.callCount,
      input_tokens: this.totalInput,
      output_tokens: this.totalOutput,
      estimated_cost_usd: Math.round(this.estimatedCostUsd * 10000) / 10000,
    }
  }

  /** Reset counters */
  reset(): void {
    this.totalInput = 0
    this.totalOutput = 0
    this.callCount = 0
  }
}
