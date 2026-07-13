/**
 * Load .env.local into process.env for standalone `npx tsx scripts/...` runs.
 *
 * Import this FIRST — before any `src/` import — because modules under src/
 * read process.env at load time (getServiceClient, the Anthropic client, etc).
 *
 * Extracted from the inline loader that several scripts each carried a copy of.
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))

try {
  const envContent = readFileSync(resolve(__dir, '..', '.env.local'), 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
} catch {
  // No .env.local; rely on inherited env.
}
