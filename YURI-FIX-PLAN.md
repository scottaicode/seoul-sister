# Yuri Fix Plan — Routine Accuracy & Conversation Quality

**Created**: February 28, 2026
**Context**: Bailey's 10 conversations (42+ messages) with Yuri revealed systematic issues with routine assembly, product knowledge, and temporal reasoning. This plan addresses every identified problem with specific file-level changes.

**Goal**: Any Claude Opus 4.7 AI model session can follow this plan and implement the fixes successfully.

---

## Issue Inventory

Every issue identified from Bailey's conversations, categorized by root cause:

| # | Issue | Conversation | Severity | Root Cause |
|---|-------|-------------|----------|------------|
| 1 | Forgot Illiyoon in routine rewrite | Medicube Booster Wand (msg 7) | HIGH | No routine product completeness check |
| 2 | Listed "PDRN OR Anua" instead of both | Medicube Booster Wand (msg 9) | HIGH | No routine product completeness check |
| 3 | Wrong product thickness order (Anua thinner than PDRN) | Medicube Booster Wand (msg 11-12) | HIGH | No product-level texture data; relies on category-only |
| 4 | Red light mask placed after products instead of bare skin | Medicube Booster Wand (msg 13) | HIGH | Device placement rules in prompt only, no validation |
| 5 | Date math error ("2.5 weeks in" when 2 days in) | Bare Face Morning Assessment (msg 2) | MEDIUM | Date fix deployed (v8.5.0) but may predate it or be insufficient |
| 6 | Yuri suggested Glass Skin Score in ALL 4 conversations | Multiple conversations | LOW | Already addressed in v8.1.2 (feature repetition rule) |
| 7 | User asked "Will this now be saved in my routine?" — Yuri couldn't auto-save | Medicube Booster Wand (msg 16) | MEDIUM | No ability to save routine from conversation context |
| 8 | 4 sequential corrections needed before routine was correct | Medicube Booster Wand (msgs 7-14) | HIGH | No self-verification step before presenting routines |

---

## Fix 1: Routine Self-Verification (Addresses Issues #1, #2, #4, #8)

**Problem**: When Yuri writes or rewrites a routine, she assembles it purely from Claude's reasoning — products get forgotten, ordering gets wrong, devices get misplaced. Bailey had to catch 4 separate errors in one routine.

**Root Cause**: There is no verification step between Claude generating the routine and presenting it to the user. The system relies entirely on Claude's working memory to track all products, their correct order, and device placement rules.

**Solution**: Add a `verify_routine` tool that Yuri calls AFTER generating a routine but BEFORE presenting it. This tool cross-references the generated routine against the user's known products and layering rules.

### Implementation

#### Step 1: Create the `verify_routine` tool definition

**File**: `src/lib/yuri/tools.ts`

Add a new tool to `YURI_TOOLS`:

```typescript
{
  name: 'verify_routine',
  description: 'ALWAYS call this tool after generating or rewriting a routine for the user. Checks the routine against the user known products, layering rules, device placement, and ingredient conflicts. Returns warnings for any issues found.',
  input_schema: {
    type: 'object',
    properties: {
      routine_type: { type: 'string', enum: ['am', 'pm'], description: 'AM or PM routine' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            step_number: { type: 'number' },
            product_name: { type: 'string' },
            product_brand: { type: 'string' },
            category: { type: 'string', description: 'Product category: cleanser, toner, essence, serum, moisturizer, sunscreen, device, mask, eye_care, etc.' },
            is_device: { type: 'boolean', description: 'Whether this step is a device (LED mask, wand, etc.) rather than a product' },
            notes: { type: 'string', description: 'Any timing, frequency, or application notes' },
          },
          required: ['step_number', 'product_name', 'category'],
        },
        description: 'The routine steps in the order Yuri is about to present them'
      },
    },
    required: ['routine_type', 'steps'],
  },
}
```

#### Step 2: Implement the `verify_routine` execution function

**File**: `src/lib/yuri/tools.ts`

Add `executeVerifyRoutine()`:

This function performs 5 checks:

**Check A — Product Completeness**: Load the user's previously discussed products from:
1. `ss_routine_products` (existing saved routine products)
2. `ss_user_profiles.current_products` (if populated)
3. Recent decision memory entries with topic containing "routine" or "product"

Compare the products in the submitted routine against ALL known products for this user. Flag any known product that is MISSING from the routine with: `"WARNING: [Product Name] is a known product for this user but is not included in this routine. Was this intentional?"`

**Check B — Layering Order Validation**: Call the existing `suggestLayeringOrder()` function from `src/lib/intelligence/layering-order.ts` with the routine steps. Compare suggested order against submitted order. Flag any out-of-order steps with: `"WARNING: [Product A] (category: serum, position: 4) is placed after [Product B] (category: moisturizer, position: 6). Serums go before moisturizers."`

**Check C — Device Placement Validation**: For any step where `is_device: true` OR where the product name matches `isBeautyDevice()` from `layering-order.ts`:
- LED/light therapy devices: Must be on clean bare skin (step should be BEFORE any serums, moisturizers, or actives). Flag if placed after products.
- EMS/microcurrent devices: Must be used WITH product applied (for conductivity). Flag if placed before any serum/moisturizer.
- If routine_type is 'pm' and contains a light therapy device after cleansing products, verify no products are listed between the cleanse and the device.

**Check D — Missing Essential Steps**: Call `detectMissingSteps()` from `layering-order.ts` with the routine steps and routine_type. Return any missing essential categories (cleanser, moisturizer, sunscreen for AM).

**Check E — Ingredient Conflict Check**: For any products that match `ss_products` records, load their ingredients and run them against `ss_ingredient_conflicts`. Also check against the user's known allergies from `ss_user_profiles`. Flag conflicts.

Return a JSON result:
```json
{
  "verified": true | false,
  "warnings": ["list of warning strings"],
  "suggestions": ["list of suggestion strings"],
  "missing_known_products": ["Product X", "Product Y"],
  "layering_issues": ["Product A should be before Product B"],
  "device_issues": ["LED mask should be on bare skin before products"],
  "missing_essentials": ["AM routine is missing sunscreen"],
  "conflicts": ["Vitamin C + Niacinamide conflict detected"]
}
```

If `verified: false` (any warnings found), Yuri receives this result and MUST address the issues before presenting the routine to the user. This means she'll self-correct before the user ever sees the mistake.

#### Step 3: Add mandatory verify_routine instruction to system prompt

**File**: `src/lib/yuri/advisor.ts`

In the `## Tools` section of `YURI_SYSTEM_PROMPT`, add:

```
## Routine Verification (MANDATORY)
Every time you write or rewrite a routine for the user — whether it's a new routine, an update, or a rewrite after a correction — you MUST call the `verify_routine` tool BEFORE presenting it. Pass every step in the routine you're about to show. If verify_routine returns warnings, fix them silently and present the corrected routine. NEVER show the user a routine that hasn't been verified.

This is non-negotiable. The user should never have to catch missing products, wrong layering order, or misplaced devices. That's YOUR job.
```

Also add this rule to the Routine Architect specialist prompt in `specialists.ts`:

```
CRITICAL: After generating ANY routine, call verify_routine with every step before showing it to the user. Fix all warnings before presenting.
```

#### Step 4: Load user's known products for completeness check

**File**: `src/lib/yuri/tools.ts` (inside `executeVerifyRoutine`)

Query sources for the user's known product inventory:

```sql
-- Source 1: Saved routine products
SELECT DISTINCT p.name_en, p.brand_en, p.category
FROM ss_routine_products rp
JOIN ss_user_routines r ON rp.routine_id = r.id
JOIN ss_products p ON rp.product_id = p.id
WHERE r.user_id = $userId AND r.is_active = true;

-- Source 2: Products mentioned in decision memory
SELECT decision_memory FROM ss_yuri_conversations
WHERE user_id = $userId AND decision_memory IS NOT NULL
ORDER BY updated_at DESC LIMIT 5;

-- Source 3: Product reactions (user has used these)
SELECT p.name_en, p.brand_en, p.category
FROM ss_user_product_reactions upr
JOIN ss_products p ON upr.product_id = p.id
WHERE upr.user_id = $userId;
```

Parse decision memory for product names mentioned in decisions/commitments. Combine all sources into a `knownProducts` set. Compare against the submitted routine steps by fuzzy name matching.

---

## Fix 2: Product Texture/Thickness Data (Addresses Issue #3)

**Problem**: Yuri ordered "PDRN Serum (thinner) → Anua Rice Ceramide (thicker)" but Bailey corrected that Anua is actually thinner. The layering system uses category-based positions only (`serum = 4`), which means two products in the same category always tie — and Claude guesses wrong.

**Root Cause**: `getProductPosition()` in `layering-order.ts` maps categories to positions but has no per-product texture data. Two serums both return position 4.

**Solution**: Add a `texture_weight` column to `ss_products` and use it as a tiebreaker within the same category position.

### Implementation

#### Step 1: Database migration

**Migration name**: `add_texture_weight_to_products`

```sql
-- texture_weight: 1 (wateriest) to 10 (thickest) within a category
-- Used for layering order when two products share the same category position
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS texture_weight INTEGER
  CHECK (texture_weight BETWEEN 1 AND 10);

-- Comment explaining the scale
COMMENT ON COLUMN ss_products.texture_weight IS
  'Texture thickness: 1=water-thin, 3=essence/light serum, 5=medium serum, 7=cream-serum, 10=heavy cream. Used for layering tiebreakers within same category.';
```

#### Step 2: Seed texture_weight for Bailey's specific products

Since Bailey's Anua Rice 70+ Ceramide and Medicube PDRN Serum are the products that caused the issue, ensure these have correct texture_weight values. Also seed values for other commonly-used products.

Run a script or migration that:
1. Queries `ss_products` for products Bailey uses (by name matching)
2. Sets texture_weight based on known product textures
3. For the specific issue: Anua Rice 70+ Ceramide = 3 (light/watery), Medicube PDRN Serum = 5 (medium serum texture)

For products without known texture, leave NULL — the system falls back to category-based ordering.

#### Step 3: Create a Sonnet-powered texture classification cron

For the 6,200+ products without texture_weight, create a background job:

**File**: `src/app/api/cron/classify-textures/route.ts`

- Runs weekly or on-demand
- Batch of 100 products at a time
- Sends product name, category, description, and ingredient list to Sonnet
- Sonnet returns a texture_weight 1-10 based on its knowledge of the product
- Updates `ss_products.texture_weight`

This is lower priority than the other fixes — the immediate need is that the verify_routine tool warns when two products in the same category have no texture data, prompting Yuri to ask the user: "Which feels thinner/more watery — the Anua or the PDRN?"

#### Step 4: Update layering logic to use texture_weight

**File**: `src/lib/intelligence/layering-order.ts`

Modify `suggestLayeringOrder()` to use texture_weight as a secondary sort:

```typescript
// Current: sorts by category position only, alphabetical tiebreak
// New: sorts by category position, then texture_weight ASC (thinnest first), then alphabetical
products.sort((a, b) => {
  const posA = getProductPosition(a.category, a.name)
  const posB = getProductPosition(b.category, b.name)
  if (posA !== posB) return posA - posB
  // Within same position, sort by texture (thin first)
  if (a.texture_weight && b.texture_weight) {
    return a.texture_weight - b.texture_weight
  }
  // Products without texture data go after those with data
  if (a.texture_weight && !b.texture_weight) return -1
  if (!a.texture_weight && b.texture_weight) return 1
  return a.name.localeCompare(b.name)
})
```

#### Step 5: Update verify_routine to flag texture ambiguity

In `executeVerifyRoutine()`, when two products share the same category position AND both lack texture_weight:

```json
{
  "suggestions": [
    "AMBIGUOUS ORDER: Anua Rice 70+ Ceramide and Medicube PDRN Serum are both serums. I don't have texture data for these. Ask the user which feels thinner/more watery — that one goes first."
  ]
}
```

This prevents Yuri from guessing and being wrong. She'll ask the user when uncertain, which is better than confidently presenting the wrong order.

---

## Fix 3: Device Placement Rules in Structured Data (Addresses Issue #4)

**Problem**: Yuri placed the red light mask after products, but it should go on bare clean skin (before products). She had correctly recommended this before in an earlier conversation but forgot when rewriting the routine.

**Root Cause**: Device placement rules exist only in the Routine Architect system prompt (text), not in structured data. When Claude rewrites a routine, it doesn't always recall prompt-level rules, especially under the cognitive load of tracking 9+ products.

**Solution**: Encode device placement rules as structured data that the verify_routine tool checks programmatically.

### Implementation

#### Step 1: Add device placement rules to layering-order.ts

**File**: `src/lib/intelligence/layering-order.ts`

Add a structured rules map:

```typescript
interface DevicePlacementRule {
  deviceKeywords: string[]
  placement: 'before_products' | 'with_products' | 'after_products'
  requiresProduct: boolean  // Must have product applied for conductivity?
  description: string
}

const DEVICE_PLACEMENT_RULES: DevicePlacementRule[] = [
  {
    deviceKeywords: ['led mask', 'red light', 'blue light', 'light therapy', 'light mask', 'led panel'],
    placement: 'before_products',
    requiresProduct: false,
    description: 'LED/light therapy goes on bare, clean skin immediately after cleansing — before any serums, moisturizers, or actives. Light wavelengths penetrate best through clean skin without product barriers.'
  },
  {
    deviceKeywords: ['ems', 'booster mode', 'booster wand', 'microcurrent', 'mc mode'],
    placement: 'with_products',
    requiresProduct: true,
    description: 'EMS and microcurrent devices need product on the skin for conductivity and to drive actives deeper. Apply serum or moisturizer first, then use the device over it.'
  },
  {
    deviceKeywords: ['dermashot', 'electroporation'],
    placement: 'with_products',
    requiresProduct: true,
    description: 'Electroporation devices drive active ingredients deeper. Apply your target active serum first, then use the device.'
  },
  {
    deviceKeywords: ['gua sha', 'facial roller', 'jade roller', 'ice roller'],
    placement: 'with_products',
    requiresProduct: true,
    description: 'Facial tools need product for smooth gliding. Use over serum or facial oil.'
  },
  {
    deviceKeywords: ['airshot'],
    placement: 'with_products',
    requiresProduct: true,
    description: 'Airshot mode is gentle and works with product applied. Safe for sensitive areas.'
  },
]

export function getDevicePlacementRule(productName: string): DevicePlacementRule | null {
  const nameLower = productName.toLowerCase()
  return DEVICE_PLACEMENT_RULES.find(rule =>
    rule.deviceKeywords.some(kw => nameLower.includes(kw))
  ) || null
}
```

#### Step 2: Use in verify_routine

In `executeVerifyRoutine()`, for each step flagged as a device or matching `isBeautyDevice()`:

1. Look up `getDevicePlacementRule(step.product_name)`
2. If `placement === 'before_products'` and there are non-device, non-cleanser products before this step, flag: `"WARNING: ${step.product_name} should be on bare clean skin BEFORE products. Move it to right after cleansing."`
3. If `placement === 'with_products'` and there are no serums/moisturizers before this step, flag: `"WARNING: ${step.product_name} needs product applied for conductivity. Apply a serum or moisturizer before this step."`

---

## Fix 4: Date/Time Reasoning Hardening (Addresses Issue #5)

**Problem**: Yuri told Bailey she was "2.5 weeks" into her plan when she was 2 days in. A date-counting fix was deployed in v8.5.0, but it needs to be verified and potentially strengthened.

**Root Cause**: The v8.5.0 fix injects `Today's date` and a counting instruction into the system prompt. However, Claude's date arithmetic can still fail, especially with complex timelines. The fix relies on Claude correctly reading decision memory timestamps and calculating elapsed days — which is a known weak spot for LLMs.

**Solution**: Two-part approach — verify the existing fix is working, and add a helper tool.

### Implementation

#### Step 1: Verify existing date injection

**File**: `src/lib/yuri/advisor.ts`

Confirm this exists in `buildSystemPrompt()`:
```typescript
const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
parts.push(`**Today's date: ${dateStr}**\nWhen referencing dates, timelines, or how long ago something happened, calculate precisely from decision memory timestamps and today's date. Count the actual days. Do not estimate or round.`)
```

This should already be present from v8.5.0. If it is, move to Step 2.

#### Step 2: Pre-calculate elapsed days in decision memory context

**File**: `src/lib/yuri/memory.ts`

In `formatContextForPrompt()`, when rendering the decision memory section, pre-calculate elapsed days for each decision:

Currently renders as:
```
- **barrier_repair**: 3-phase approach starting with ceramides (decided 2026-02-23)
```

Change to:
```
- **barrier_repair**: 3-phase approach starting with ceramides (decided 2026-02-23, which was 5 days ago)
```

This means Claude doesn't have to do the date math — it's already calculated. Implementation:

```typescript
const now = new Date()
for (const decision of mergedDecisions) {
  const decisionDate = new Date(decision.date)
  const daysAgo = Math.floor((now.getTime() - decisionDate.getTime()) / (1000 * 60 * 60 * 24))
  decision.displayDate = `${decision.date}, which was ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`
}
```

#### Step 3: Add elapsed-days calculation to commitment formatting

Same approach for commitments:
```
- Try COSRX Snail Mucin for 2 weeks (committed 2026-02-23, which was 5 days ago — 9 days remaining)
```

For commitments with a duration, calculate both elapsed and remaining time. This requires parsing the duration from the commitment text (e.g., "for 2 weeks" → 14 days), which can be done with simple regex.

---

## Fix 5: Yuri's Product Knowledge Gap (Addresses Issue #3 indirectly)

**Problem**: Yuri said "Okay the database pulled the wrong products for both" when Bailey corrected the texture order. The products in question (Medicube PDRN, Anua Rice Ceramide) may not be in the Seoul Sister database, or their data may be incomplete.

**Root Cause**: Users buy products that may not be in the `ss_products` database. When Yuri discusses these products, she has no structured data to reference — she relies on Claude's training knowledge, which may not know specific product textures.

**Solution**: Two-part approach — track user's personal product inventory, and allow Yuri to learn product attributes from user corrections.

### Implementation

#### Step 1: Create `ss_user_products` table for personal product tracking

**Migration name**: `add_user_products_table`

```sql
CREATE TABLE ss_user_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  product_id UUID REFERENCES ss_products(id),  -- NULL if not in DB
  custom_name TEXT,                              -- User's name for the product
  custom_brand TEXT,
  category TEXT,
  texture_weight INTEGER CHECK (texture_weight BETWEEN 1 AND 10),
  notes TEXT,                                    -- User-provided notes
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'finished', 'returned', 'gave_away')),
  learned_from TEXT DEFAULT 'conversation',       -- 'conversation', 'scan', 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ss_user_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own products" ON ss_user_products
  FOR ALL USING ((select auth.uid()) = user_id);
CREATE INDEX idx_user_products_user ON ss_user_products(user_id);
```

#### Step 2: Auto-populate from conversation context

When Yuri's `extractContinuousLearning()` function (in `advisor.ts`) detects a new product mention that isn't in the database, create an `ss_user_products` record with `product_id = NULL` and the user-provided name/brand.

When a user corrects Yuri about a product attribute (like "the Anua is thinner"), Yuri should call a new tool `update_user_product` that updates the texture_weight or other attributes.

#### Step 3: Add `update_user_product` tool

**File**: `src/lib/yuri/tools.ts`

```typescript
{
  name: 'update_user_product',
  description: 'Update information about a product the user owns. Use when the user corrects you about a product attribute (texture, how they use it, etc.) or mentions a new product they bought.',
  input_schema: {
    type: 'object',
    properties: {
      product_name: { type: 'string' },
      brand: { type: 'string' },
      category: { type: 'string' },
      texture_weight: { type: 'number', description: '1=water-thin, 3=light, 5=medium, 7=thick, 10=heavy cream' },
      notes: { type: 'string', description: 'Any notes about how the user uses this product' },
      status: { type: 'string', enum: ['active', 'finished', 'returned', 'gave_away'] },
    },
    required: ['product_name'],
  },
}
```

When Yuri learns that "Anua is thinner than PDRN," she calls:
```json
{ "product_name": "Anua Rice 70+ Ceramide", "texture_weight": 3 }
{ "product_name": "Medicube PDRN Pink Peptide Serum", "texture_weight": 5 }
```

These records persist across sessions. Next time Yuri builds a routine, verify_routine references `ss_user_products` for texture data, getting the order right.

#### Step 4: Load user products in context

**File**: `src/lib/yuri/memory.ts`

Add a query in `loadUserContext()` for the 'routine' or 'products' intent:

```sql
SELECT custom_name, custom_brand, category, texture_weight, notes, status
FROM ss_user_products
WHERE user_id = $userId AND status = 'active'
ORDER BY custom_name;
```

Include in the system prompt as:
```
## Your Product Inventory
These are products the user currently owns and uses:
- Anua Rice 70+ Ceramide (serum, texture: 3/10 — light/watery)
- Medicube PDRN Pink Peptide Serum (serum, texture: 5/10 — medium)
- Illiyoon Ceramide Ato Concentration Cream (moisturizer, texture: 8/10 — thick)
...
```

This gives Yuri structured product knowledge for EVERY product the user discusses, even those not in the Seoul Sister database.

---

## Fix 6: Routine-to-App Save Integration (Addresses Issue #7)

**Problem**: Bailey asked "Will this now be saved in my routine?" and Yuri could only say "this conversation is saved in your chat history" and pointed her to manually build it in /routine. Yuri SHOULD be able to save the routine she just verified to the user's routine.

**Root Cause**: The `add_to_routine` tool adds ONE product at a time. There is no `save_full_routine` tool that writes an entire routine in one operation.

**Solution**: Add a `save_routine` tool that takes a complete verified routine and writes it to `ss_user_routines` + `ss_routine_products`.

### Implementation

#### Step 1: Add `save_routine` tool

**File**: `src/lib/yuri/tools.ts`

```typescript
{
  name: 'save_routine',
  description: 'Save a complete routine to the user app after verify_routine has passed. Call this when the user approves a routine you have presented, or when they ask to save it. Requires the routine to have been verified first.',
  input_schema: {
    type: 'object',
    properties: {
      routine_type: { type: 'string', enum: ['am', 'pm'] },
      routine_name: { type: 'string', description: 'Display name like "Phase 1 AM Routine"' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            product_name: { type: 'string' },
            product_brand: { type: 'string' },
            category: { type: 'string' },
            step_order: { type: 'number' },
            frequency: { type: 'string', description: 'daily, weekdays_only, mon_wed_fri, tue_thu, etc.' },
            notes: { type: 'string' },
          },
          required: ['product_name', 'step_order'],
        },
      },
      replace_existing: { type: 'boolean', description: 'If true, deactivate any existing routine of this type before saving' },
    },
    required: ['routine_type', 'steps'],
  },
}
```

#### Step 2: Implement `executeSaveRoutine()`

1. If `replace_existing`, set `is_active = false` on existing routines of the same type
2. Create new `ss_user_routines` record
3. For each step, resolve product_id via `smartProductSearch()` (may be NULL for non-DB products)
4. Insert `ss_routine_products` for each step with correct step_order
5. Return confirmation with routine ID

#### Step 3: Add system prompt guidance

In the Routine Architect prompt and the main tools section:

```
After presenting a verified routine and the user approves it (e.g., "looks good", "yes", "save it"), call save_routine to save it to their app. Ask first: "Want me to save this to your Routine page so you can reference it anytime?"
```

---

## Fix 7: System Prompt Reinforcement for Self-Verification Culture (Addresses Issue #8)

**Problem**: The pattern across Bailey's conversations is that Yuri presents routines confidently without self-checking, then requires multiple corrections from the user. This erodes trust.

**Root Cause**: The system prompt emphasizes knowledge, personality, and tool usage — but doesn't establish a self-verification habit. Yuri optimizes for speed and confidence when she should optimize for accuracy.

**Solution**: Add a "Verification Mindset" section to the system prompt.

### Implementation

**File**: `src/lib/yuri/advisor.ts`

Add to `YURI_SYSTEM_PROMPT` after the Tools section:

```
## Verification Mindset
When you write routines, product orders, or specific recommendations:
1. Build the routine mentally first
2. Call verify_routine BEFORE presenting — this catches missing products, wrong layering, and device misplacement
3. If the tool returns warnings, fix them silently. The user should never see an unverified routine.
4. When you're uncertain about product texture order (two products in the same category), ASK the user instead of guessing: "Which feels thinner/more watery — the [A] or the [B]? That one goes first."
5. When a user corrects you, call update_user_product to record the correction so you get it right next time.

Accuracy > Speed. A routine that takes one extra tool call but is correct builds more trust than a fast routine the user has to fix.
```

---

## Implementation Order

The fixes are designed to be built in dependency order:

| Order | Fix | Dependencies | Estimated Lines |
|-------|-----|-------------|----------------|
| 1 | Fix 3: Device placement rules (structured data) | None — adds to existing layering-order.ts | ~60 lines |
| 2 | Fix 4: Date reasoning hardening | None — modifies memory.ts formatting | ~30 lines |
| 3 | Fix 2: texture_weight column + migration | None — database + layering-order.ts | ~40 lines code + migration |
| 4 | Fix 5: ss_user_products table + update_user_product tool | Fix 2 (texture_weight concept) | ~150 lines + migration |
| 5 | Fix 1: verify_routine tool | Fix 2, Fix 3, Fix 5 (uses texture + device rules + user products) | ~250 lines |
| 6 | Fix 6: save_routine tool | Fix 1 (verify before save) | ~120 lines |
| 7 | Fix 7: System prompt updates | Fix 1, Fix 5, Fix 6 (references new tools) | ~30 lines |

**Total estimated new/modified code**: ~680 lines across 5 files + 2 migrations

---

## Files to Create

| File | Purpose |
|------|---------|
| (migration) `add_texture_weight_to_products` | Adds texture_weight column to ss_products |
| (migration) `add_user_products_table` | Creates ss_user_products table with RLS |

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/intelligence/layering-order.ts` | Add device placement rules, texture_weight sorting, export getDevicePlacementRule() |
| `src/lib/yuri/tools.ts` | Add 3 new tools (verify_routine, update_user_product, save_routine) + execution functions |
| `src/lib/yuri/memory.ts` | Pre-calculate elapsed days in decision memory, load user products |
| `src/lib/yuri/advisor.ts` | Add Verification Mindset section, verify_routine mandate |
| `src/lib/yuri/specialists.ts` | Update Routine Architect prompt with verify_routine mandate |

## Files NOT Modified

- `src/app/api/yuri/chat/route.ts` — No changes needed (tools auto-available via YURI_TOOLS)
- `src/app/api/widget/chat/route.ts` — Widget doesn't do routine building
- `src/lib/yuri/onboarding.ts` — Onboarding not affected
- `src/lib/yuri/voice-cleanup.ts` — Not related

---

## Testing Checklist

After implementation, verify these scenarios work:

### Routine Accuracy
- [ ] Ask Yuri to build an AM routine — verify_routine should fire before the routine is shown
- [ ] Add a product mid-conversation, then ask for routine rewrite — the new product must appear
- [ ] Include a device (LED mask) in a PM routine — verify it's placed before products
- [ ] Include EMS/microcurrent wand — verify it's placed after products (needs conductivity)
- [ ] Two products in the same category — verify texture_weight ordering or ambiguity question

### Product Knowledge
- [ ] Mention a product not in the database — ss_user_products record should be created
- [ ] Correct Yuri about a product texture — update_user_product should fire
- [ ] Next session: ask for routine with the corrected product — correct order should be used

### Date Reasoning
- [ ] Start a plan on day 1, ask "how long have I been on this?" on day 3 — should say "3 days"
- [ ] Decision memory should show "(decided Feb 23, which was 5 days ago)"

### Routine Saving
- [ ] After Yuri presents a verified routine, say "save it" — save_routine should fire
- [ ] Check /routine page — routine should appear with correct products and order
- [ ] Verify existing routine of same type is deactivated when replaced

### Regression
- [ ] Normal conversation without routine topics — no verify_routine calls (tools stay auto)
- [ ] Widget conversations — no new tools exposed
- [ ] Specialist routing — still works correctly
- [ ] Decision memory extraction — still works (every 5 messages)
- [ ] Cross-session memory — summaries still generated correctly

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| verify_routine adds latency (extra tool call) | Only fires when routine is generated — most conversations don't build routines. ~2-3s extra for the verification call. |
| Claude ignores verify_routine mandate | Use `shouldForceToolUse()` pattern — when routine keywords detected + verify_routine hasn't been called yet, force tool_choice. Alternatively, trust the system prompt mandate since routine building is a deliberate action, not an edge case. |
| texture_weight data is sparse initially | verify_routine flags ambiguity and prompts Yuri to ask the user. This is better than guessing wrong. Over time, user corrections populate ss_user_products, and the Sonnet cron backfills ss_products. |
| ss_user_products accumulates stale data | Products have a `status` field. Yuri can mark products as 'finished' or 'gave_away' when users mention it. |
| save_routine conflicts with manual routine building | save_routine uses `replace_existing` flag. User can always override in /routine page. Both paths coexist. |
