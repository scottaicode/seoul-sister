/**
 * Says whose rating a product's stars are.
 *
 * Why (Nov 15 2026): a member's product page showed "5.0 (2 reviews)" beside
 * a green "Verified" shield. The two reviews were Olive Young's; no Seoul
 * Sister member had reviewed the product. Unlabelled, a retailer's rating
 * reads as ours.
 *
 * Where a rating can come from, measured on production the same day (5,387
 * rated products, after the invented launch ratings were cleared in
 * v11.61.11):
 *   - 5,226 from the Olive Young scrape (`ss_product_staging.source`),
 *     549 of them with a rating and no review count (the listing page gives
 *     the rating only);
 *   - 141 from the trending backfill, which reads the Olive Young page;
 *   - 20 came from launch seed reviews written under two insider accounts.
 *     Those reviews and ratings were deleted the same day; there are no
 *     member reviews yet. When one exists, the `ss_reviews` trigger replaces
 *     `rating_avg` with the member average.
 * So: member reviews if there are any, otherwise Olive Young. If a second
 * retailer's ratings are ever imported, this needs the source per product.
 * Known gap (Nov 15 2026): the count trigger `ss_products_review_count` adds
 * each member review to the SAME `review_count` column that holds Olive
 * Young's count. After the first member review, a surface that passes 0
 * member reviews here (ProductCard, the best-of list) would label a member
 * average "N reviews on Olive Young". True today only because there are no
 * member reviews; fix the trigger or pass the member count before there are.
 * Known gap: if a member review is later deleted, the trigger leaves the
 * member average in place with no review behind it.
 */
export function ratingSourceNote(memberReviews: number, storedReviewCount: number): string {
  if (memberReviews > 0) {
    return `${memberReviews.toLocaleString('en-US')} member ${memberReviews === 1 ? 'review' : 'reviews'}`
  }
  if (storedReviewCount > 0) {
    return `${storedReviewCount.toLocaleString('en-US')} ${storedReviewCount === 1 ? 'review' : 'reviews'} on Olive Young`
  }
  return 'rated on Olive Young'
}
