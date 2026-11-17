import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The full ingredient list we hold for each product, in label order.
 *
 * Why this exists (Nov 16 2026): Yuri built a routine for a member with
 * rosacea, a skin cancer history and a prescription retinoid, and saved a
 * sunscreen whose list holds four fragrant essential oils, retinol and
 * ascorbic acid. She had said "fragrance-free, no other actives" in the same
 * reply. She was not careless: `find_sunscreen_match` returned SPF, finish and
 * white cast and not one ingredient, so there was nothing to read. Asked
 * afterwards, she read the list and withdrew the product at once.
 *
 * So the list travels with the product, as data. Nothing here judges an
 * ingredient: which ones matter for this person is Yuri's reading.
 *
 * `failed` is separate from "no list": a query that errored must not look like
 * a product with nothing in it (the 22P02 lesson in CLAUDE.md).
 */
export interface IngredientLists {
  /** product id -> names in label order. A product with no rows is absent. */
  lists: Map<string, string[]>
  failed: boolean
}

const PAGE = 1000

export async function fullIngredientLists(db: SupabaseClient, productIds: Array<string | null | undefined>): Promise<IngredientLists> {
  const ids = [...new Set(productIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
  const lists = new Map<string, string[]>()
  if (ids.length === 0) return { lists, failed: false }
  // Paged: PostgREST stops at 1,000 rows without saying so, and 15 sunscreens
  // at ~60 ingredients each is close to that.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('ss_product_ingredients')
      .select('product_id, position, ingredient:ss_ingredients(name_inci)')
      .in('product_id', ids)
      .order('product_id', { ascending: true })
      .order('position', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[ingredient-lists] could not read ingredient lists:', error.message)
      return { lists: new Map(), failed: true }
    }
    const rows = (data ?? []) as unknown as Array<{ product_id: string; ingredient: { name_inci: string | null } | Array<{ name_inci: string | null }> | null }>
    for (const row of rows) {
      const ing = Array.isArray(row.ingredient) ? row.ingredient[0] : row.ingredient
      const name = ing?.name_inci
      if (!name) continue
      const list = lists.get(row.product_id)
      if (list) list.push(name)
      else lists.set(row.product_id, [name])
    }
    if (rows.length < PAGE) break
  }
  return { lists, failed: false }
}

/** What Yuri is told about the lists that come back with a product search or a routine save. A fact, not an instruction. */
export function ingredientListsFact(failed: boolean): string {
  return failed
    ? 'The ingredient lists could not be read just now, so none is shown. That is a failed lookup, not a sign that these products are free of anything.'
    : '`ingredients` is the full list we hold for that product, in label order. `null` means we hold no list for it, which is different from it containing nothing of concern. This tool compared none of them with this member\'s medical history, prescriptions, reactions or what you have told them to avoid.'
}
