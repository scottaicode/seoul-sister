/**
 * Yuri Scenario Mode — curated persona presets (Jul 5 2026)
 *
 * These are DEMONSTRATION personas for the Scenario Mode demo engine, not fake
 * customers. Bailey picks one (or writes a freeform persona), asks the REAL Yuri
 * a question, and screenshots the real, verified output to show "here's what
 * Yuri does for skin like yours." Nothing is persisted (see advisor.ts scenario
 * guards); nothing trains the learning loop (is_demo exclusion).
 *
 * Why a curated library: the 2026 conversion research is clear that the winning
 * pattern is persona-specific, self-qualifying demos that answer "will this work
 * for MY skin?" So the presets deliberately span the full spectrum of the
 * audience — including deeper Fitzpatrick skin + post-inflammatory
 * hyperpigmentation, which K-beauty content routinely under-serves — so a viewer
 * of any skin type can find themselves. This is a starting library, NOT a cap:
 * the demo page also takes a freeform persona for anything not covered here.
 *
 * These are FACTS fed to Yuri (skin context), never instructions on how she
 * should answer. She reasons over them exactly as she would a real user's
 * profile. (AI-First: Surface Facts, Do Not Instruct.)
 */

import type { YuriScenario } from './advisor'

export interface ScenarioPreset extends YuriScenario {
  /** Stable slug for analytics / URL. */
  id: string
  /** Short label for the picker button. */
  label: string
  /** One-line description shown under the label. */
  blurb: string
  /** A strong default question that shows Yuri's firepower for this persona. */
  suggested_question: string
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'oily_acne_teen',
    label: 'Oily & acne-prone (teen/early 20s)',
    blurb: 'Humid climate, tight budget, breakouts and shine.',
    skin_type: 'oily',
    skin_concerns: ['acne', 'breakouts', 'large pores', 'excess oil'],
    fitzpatrick_scale: 'III',
    climate: 'hot and humid',
    age_range: '16-22',
    budget_range: 'budget',
    experience_level: 'beginner',
    persona_note:
      '19, oily acne-prone skin, humid climate, student on a tight budget, overwhelmed by conflicting TikTok advice.',
    suggested_question:
      'My skin is oily and I keep breaking out. Can you build me a simple Korean skincare routine under $60 total?',
  },
  {
    id: 'dry_mature',
    label: 'Dry & mature (40s+)',
    blurb: 'Fine lines, dryness, wants firmness and glow.',
    skin_type: 'dry',
    skin_concerns: ['fine lines', 'dryness', 'loss of firmness', 'dullness'],
    fitzpatrick_scale: 'II',
    climate: 'cold and dry',
    age_range: '45-55',
    budget_range: 'premium',
    experience_level: 'intermediate',
    persona_note:
      '48, dry and increasingly crepey skin, cold winter climate, willing to invest in the right products but tired of empty anti-aging promises.',
    suggested_question:
      'I have dry, mature skin and want more firmness and glow. What Korean actives actually work, and how do I layer them?',
  },
  {
    id: 'sensitive_rosacea',
    label: 'Sensitive & reactive (rosacea)',
    blurb: 'Redness, stinging, barrier damage from over-exfoliating.',
    skin_type: 'sensitive',
    skin_concerns: ['redness', 'rosacea', 'stinging', 'compromised barrier'],
    fitzpatrick_scale: 'I',
    climate: 'temperate',
    age_range: '30-40',
    budget_range: 'mid-range',
    experience_level: 'intermediate',
    allergies: ['fragrance', 'essential oils'],
    persona_note:
      '35, very sensitive reactive skin with rosacea flushing, barrier wrecked from over-exfoliating, reacts to fragrance and essential oils.',
    suggested_question:
      'My skin is red, stinging, and reacts to everything after I over-exfoliated. How do I repair my barrier with gentle Korean products?',
  },
  {
    id: 'combination_hormonal',
    label: 'Combination & hormonal acne (late 20s)',
    blurb: 'Oily T-zone, dry cheeks, cyclical jawline breakouts.',
    skin_type: 'combination',
    skin_concerns: ['hormonal acne', 'jawline breakouts', 'oily t-zone', 'dry cheeks'],
    fitzpatrick_scale: 'III',
    climate: 'temperate',
    age_range: '26-32',
    budget_range: 'mid-range',
    experience_level: 'intermediate',
    persona_note:
      '28, combination skin — oily T-zone, dry cheeks — with hormonal breakouts along the jaw that flare around her cycle.',
    suggested_question:
      'I get hormonal breakouts on my jaw every month but my cheeks are dry. How should I adjust my routine across my cycle?',
  },
  {
    id: 'deeper_skin_pih',
    label: 'Deeper skin tone + dark spots (PIH)',
    blurb: 'Fitzpatrick IV-VI, post-acne hyperpigmentation, even tone.',
    skin_type: 'normal',
    skin_concerns: ['post-inflammatory hyperpigmentation', 'dark spots', 'uneven tone', 'acne scarring'],
    fitzpatrick_scale: 'V',
    climate: 'warm',
    age_range: '25-35',
    budget_range: 'mid-range',
    experience_level: 'intermediate',
    persona_note:
      '30, deeper skin tone (Fitzpatrick V), main concern is stubborn dark spots and post-acne hyperpigmentation, wary of ingredients that irritate and worsen PIH.',
    suggested_question:
      'I have a deeper skin tone and dark spots that linger for months after a breakout. Which Korean brightening ingredients are safe and actually fade PIH?',
  },
  {
    id: 'dehydrated_glass_skin',
    label: 'Dehydrated, chasing glass skin',
    blurb: 'Tight, dull, wants the hydrated glass-skin look.',
    skin_type: 'combination',
    skin_concerns: ['dehydration', 'dullness', 'tightness', 'uneven texture'],
    fitzpatrick_scale: 'III',
    climate: 'dry indoor / air-conditioned',
    age_range: '22-30',
    budget_range: 'mid-range',
    experience_level: 'beginner',
    persona_note:
      '25, dehydrated skin that feels tight and looks dull despite being oily in places, wants the glass-skin look but does not know where to start.',
    suggested_question:
      'My skin is dehydrated and dull but oily in my T-zone. How do I actually get the glass-skin look with a Korean routine?',
  },
  {
    id: 'mens_lowmaintenance',
    label: 'Low-maintenance beginner (men’s skincare)',
    blurb: 'Wants results with the fewest possible steps.',
    skin_type: 'normal',
    skin_concerns: ['occasional breakouts', 'oiliness', 'razor irritation'],
    fitzpatrick_scale: 'III',
    climate: 'temperate',
    age_range: '25-40',
    budget_range: 'budget',
    experience_level: 'beginner',
    persona_note:
      '32, wants clearer, healthier skin with the fewest steps possible, has never used more than a bar of soap, skeptical of complicated routines.',
    suggested_question:
      'I have never had a skincare routine and want the simplest possible one that actually works. What are the fewest Korean products I need?',
  },
  {
    id: 'pregnancy_safe',
    label: 'Pregnancy-safe routine',
    blurb: 'Needs to avoid retinoids and certain actives.',
    skin_type: 'combination',
    skin_concerns: ['melasma', 'hormonal changes', 'sensitivity'],
    fitzpatrick_scale: 'III',
    climate: 'temperate',
    age_range: '28-38',
    budget_range: 'mid-range',
    experience_level: 'intermediate',
    persona_note:
      '33, pregnant, needs a routine that avoids retinoids and other pregnancy-unsafe actives, dealing with new melasma and hormonal shifts.',
    suggested_question:
      'I’m pregnant and need to avoid retinol and certain actives. Can you build me a safe Korean routine for melasma and hormonal changes?',
  },
]

export function getPresetById(id: string): ScenarioPreset | undefined {
  return SCENARIO_PRESETS.find((p) => p.id === id)
}
