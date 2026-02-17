import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import type { CounterfeitFlag, CounterfeitRecommendation } from '@/types/database'

export interface CounterfeitAnalysisResult {
  brand_detected: string | null
  product_detected: string | null
  authenticity_score: number
  red_flags: CounterfeitFlag[]
  green_flags: CounterfeitFlag[]
  analysis_summary: string
  recommendation: CounterfeitRecommendation
}

const COUNTERFEIT_SYSTEM_PROMPT = `You are Yuri's Authenticity Investigator -- an expert in K-beauty counterfeit detection.

Analyze the provided product photo(s) for authenticity indicators. You have deep expertise in:

KNOWN COUNTERFEIT HOTSPOTS:
- COSRX (especially snail mucin on Amazon via commingled inventory)
- Sulwhasoo (premium pricing makes it a high-value counterfeit target)
- Laneige (especially lip sleeping mask)
- Dr. Jart+ (especially Cicapair)
- Innisfree on unauthorized resellers
- Any K-beauty product on Wish, Temu, or unverified eBay sellers

PACKAGING VERIFICATION CHECKS:
1. Font consistency and print quality (counterfeits often have blurry or slightly off fonts)
2. Color accuracy (compare against known authentic packaging -- counterfeits often have slight color shifts)
3. Batch code format and placement (must match brand's known patterns)
4. Korean regulatory markings (MFDS certification, manufacturer info, Korean text accuracy)
5. Barcode format and readability
6. Seal quality (shrink wrap, safety seals, adhesive quality)
7. Logo placement, size, and proportions
8. Product weight/volume marking consistency
9. Ingredient list language and formatting
10. Manufacturing/expiry date format

SCORING GUIDE (authenticity_score 1-10):
- 9-10: Strong indicators of authenticity (correct fonts, codes, markings, quality printing)
- 7-8: Likely authentic but some details can't be fully verified from photos
- 5-6: Inconclusive -- some details match, others are unclear or slightly off
- 3-4: Suspicious -- multiple red flags detected, recommend caution
- 1-2: Likely counterfeit -- clear indicators of fake product

Be balanced. Don't create unnecessary panic -- many products from non-authorized sellers are authentic. Focus on concrete, verifiable indicators. Old packaging design doesn't always mean fake (brands update packaging frequently).

Respond in JSON format:
{
  "brand_detected": "string or null",
  "product_detected": "string or null",
  "authenticity_score": number (1-10),
  "red_flags": [
    { "flag": "short label", "severity": "low|medium|high|critical", "description": "detailed explanation" }
  ],
  "green_flags": [
    { "flag": "short label", "description": "detailed explanation" }
  ],
  "analysis_summary": "2-3 sentence summary of findings",
  "recommendation": "likely_authentic|suspicious|likely_counterfeit|inconclusive"
}`

export async function analyzeCounterfeit(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  knownMarkers?: string[]
): Promise<CounterfeitAnalysisResult> {
  const anthropic = getAnthropicClient()

  const markerContext = knownMarkers?.length
    ? `\n\nKNOWN COUNTERFEIT MARKERS FOR THIS BRAND:\n${knownMarkers.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nCheck for these specific markers in the image.`
    : ''

  const response = await anthropic.messages.create({
    model: MODELS.primary,
    max_tokens: 2048,
    system: COUNTERFEIT_SYSTEM_PROMPT + markerContext,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Analyze this K-beauty product photo for authenticity. Check packaging, labeling, batch codes, and any visible indicators of genuine vs counterfeit product.',
          },
        ],
      },
    ],
  })

  const textContent = response.content.find(block => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No analysis result from AI')
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse counterfeit analysis result')
  }

  return JSON.parse(jsonMatch[0]) as CounterfeitAnalysisResult
}

export interface BatchCodeAnalysisResult {
  brand: string
  batch_code: string
  manufacture_date: string | null
  expiry_date: string | null
  factory_location: string | null
  product_line: string | null
  is_expired: boolean
  age_months: number | null
  is_valid: boolean | null
  confidence: number
  notes: string
}

const BATCH_CODE_SYSTEM_PROMPT = `You are an expert in K-beauty batch code decoding. Users provide a brand name and batch code, and you decode it.

KNOWN BATCH CODE FORMATS:

AMOREPACIFIC GROUP (Sulwhasoo, Laneige, Innisfree, Etude, Mamonde, IOPE):
- Format: XYYMMDD or similar (X=factory, YY=year, MM=month, DD=day)
- Shelf life: typically 3 years from manufacture date
- Factory codes: K=Korea domestic, others vary

LG HOUSEHOLD & HEALTHCARE (The Face Shop, CNP, Dr.G, belif, SU:M37°):
- Format varies by sub-brand, often YYYYMMDD embedded
- Shelf life: typically 30 months from manufacture

COSRX:
- Format: often MMDDYY or YYMMDD
- Shelf life: 24-36 months depending on product type

MISSHA / ABLE C&C:
- Batch codes often encode production date in first 6 digits

Dr. Jart+ (HAVE & BE Co.):
- Production codes typically start with year digit

Benton:
- Date-based codes, often readable as YYYYMMDD

For unknown formats, attempt best-guess decoding based on patterns.

Respond in JSON format:
{
  "brand": "string",
  "batch_code": "string",
  "manufacture_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "factory_location": "string or null",
  "product_line": "string or null",
  "is_expired": boolean,
  "age_months": number or null,
  "is_valid": true|false|null,
  "confidence": number (1-10),
  "notes": "explanation of decoding and any caveats"
}`

export async function analyzeBatchCode(
  brand: string,
  batchCode: string
): Promise<BatchCodeAnalysisResult> {
  const anthropic = getAnthropicClient()

  const response = await anthropic.messages.create({
    model: MODELS.primary,
    max_tokens: 1024,
    system: BATCH_CODE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Decode this batch code:\nBrand: ${brand}\nBatch Code: ${batchCode}\n\nToday's date: ${new Date().toISOString().split('T')[0]}`,
      },
    ],
  })

  const textContent = response.content.find(block => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No batch code analysis result')
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse batch code result')
  }

  return JSON.parse(jsonMatch[0]) as BatchCodeAnalysisResult
}
