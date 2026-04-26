/**
 * One-off: Numbuzin No.5 Vitamin Niacinamide Concentrated Serum
 * The auto-enrichment skipped this because the search returned the "Pad" variant.
 * Manually pointing at the correct Incidecoder URL.
 */
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  const k = t.slice(0, i).trim()
  const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  if (!process.env[k]) process.env[k] = v
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const PRODUCT_ID = '640117e1-d3df-4f72-882a-9831c8d28134'
const URL = 'https://incidecoder.com/products/numbuzin-no-5-vitamin-concentrated-serum'

async function main() {
  console.log('=== Numbuzin No.5 Manual Fix ===')
  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const idx = text.toLowerCase().indexOf('ingredients')
  const window = text.slice(Math.max(0, idx - 200), idx + 4000)
  console.log(`Page: ${text.length} chars, window: ${window.length} chars`)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    system: 'Extract the complete INCI list from the Incidecoder page content. Return JSON: { "ingredients": ["Name1","Name2",...], "confidence": 0.0-1.0, "reasoning": "..." }. Use canonical INCI names, strip percentages and asterisks, keep parenthetical synonyms only when part of canonical name (e.g. "Water (Aqua)").',
    messages: [{ role: 'user', content: `Page: ${URL}\n\nContent:\n${window}` }],
  })

  const txt = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
  const jsonMatch = txt.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || txt.match(/(\{[\s\S]*\})/)
  if (!jsonMatch) throw new Error('No JSON in response')
  const parsed = JSON.parse(jsonMatch[1]) as { ingredients: string[]; confidence: number; reasoning: string }
  console.log(`Sonnet: ${parsed.ingredients.length} ingredients, confidence ${parsed.confidence}`)
  console.log(`Reasoning: ${parsed.reasoning}`)
  console.log(`First 5: ${parsed.ingredients.slice(0, 5).join(', ')}`)

  if (parsed.confidence < 0.7) {
    console.log('Confidence too low, aborting.')
    return
  }

  // Resolve ingredients
  const links: Array<{ product_id: string; ingredient_id: string; position: number }> = []
  let createdCount = 0
  for (let i = 0; i < parsed.ingredients.length; i++) {
    const name = parsed.ingredients[i]
    const { data: existing } = await supabase.from('ss_ingredients').select('id').ilike('name_inci', name).maybeSingle()
    let id: string
    if (existing) {
      id = existing.id
    } else {
      const { data: created, error } = await supabase.from('ss_ingredients').insert({
        name_inci: name, name_en: name, function: 'Pending enrichment',
        safety_rating: 3, comedogenic_rating: 0, is_active: false,
        is_fragrance: name.toLowerCase().includes('fragrance') || name.toLowerCase().includes('parfum'),
      }).select('id').single()
      if (error || !created) throw new Error(`Create failed for ${name}: ${error?.message}`)
      id = created.id
      createdCount++
    }
    links.push({ product_id: PRODUCT_ID, ingredient_id: id, position: i + 1 })
  }

  // Dedupe
  const seen = new Set<string>()
  const unique = links.filter(l => { if (seen.has(l.ingredient_id)) return false; seen.add(l.ingredient_id); return true })

  // Delete stub links
  await supabase.from('ss_product_ingredients').delete().eq('product_id', PRODUCT_ID)

  // Insert
  const { error: insErr } = await supabase.from('ss_product_ingredients').insert(unique)
  if (insErr) throw new Error(insErr.message)

  // Set raw
  await supabase.from('ss_products').update({
    ingredients_raw: parsed.ingredients.join(', '),
    updated_at: new Date().toISOString(),
  }).eq('id', PRODUCT_ID)

  console.log(`OK: ${unique.length} links inserted, ${createdCount} new master ingredients`)
}

main().catch(e => { console.error('FAIL:', e); process.exit(1) })
