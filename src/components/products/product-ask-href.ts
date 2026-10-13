/**
 * href for the product-page "Ask Yuri" link at the top of the page
 * (ProductTopAskYuri). Pure so it can be executed in tests.
 *
 * `fp` carries the product path so the session's landing_path names WHICH
 * product, not just "a product page": the same-origin referrer is only a
 * fallback, and a browser controls that, not us.
 */
export function productTopHref(
  productId: string,
  brand: string | null,
  name: string | null,
  signedIn: boolean
): string {
  if (signedIn) return '/yuri'
  const label = [brand, name].filter(Boolean).join(' ') || 'this product'
  const prefill = `Is ${label} right for my skin?`
  const fp = encodeURIComponent(`/products/${productId}`)
  return `/?ask=${encodeURIComponent(prefill)}&from=product_top&fp=${fp}`
}
