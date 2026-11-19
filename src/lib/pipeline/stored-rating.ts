/**
 * What a product row may hold for its star rating and review count.
 *
 * A rating is only stored with the number of reviews behind it. The Olive Young
 * importer reads a rating from the listing page and the count from the detail
 * page; when the detail read fails it has a rating and no count. That pair used
 * to be written as "rating 5.0, 0 reviews": `review_count` is NOT NULL, so an
 * unknown count became a statement that nobody had reviewed the product. By
 * Nov 18 2026 549 rows said so, and a blog post quoted one as "5 out of 5 on
 * Olive Young". A star rating with no count cannot be weighed (5.0 from three
 * people and 5.0 from three thousand look the same), so it is not stored. The
 * figure stays in ss_product_staging.raw_data, and the next import that reads
 * both writes both.
 */
export function storedRating(
  ratingAvg: number | null | undefined,
  reviewCount: number | null | undefined,
): { rating_avg: number | null; review_count: number } {
  const count = typeof reviewCount === 'number' && Number.isFinite(reviewCount) ? Math.round(reviewCount) : 0
  const rating = typeof ratingAvg === 'number' && Number.isFinite(ratingAvg) ? ratingAvg : null
  return { rating_avg: count > 0 ? rating : null, review_count: count > 0 ? count : 0 }
}
