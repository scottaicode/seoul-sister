import type { Metadata } from 'next'
import HomeClient from '@/components/home/HomeClient'

// ---------------------------------------------------------------------------
// Server wrapper for `/`, existing ONLY to declare the homepage canonical.
//
// Why this file exists (measured Aug 25 2026 on the live site):
// `/` is the single anonymous-Yuri conversion surface, and every feeder page
// links to it as `/?ask=<question>&from=<source>`. `/?ask=test&from=blog`
// served **byte-identical HTML** to `/` (76,231 bytes, same <title>) carrying
// `robots: index, follow` and **no canonical anywhere on the page** — so each
// distinct prefill was a separately indexable near-duplicate of the homepage.
//
// The exposure was already live and large before any blog CTA became
// crawlable: `/ingredients/[slug]` emits a distinct ask-string per ingredient
// across ~12,800 pages, plus `/best/[category]` and `/products`. Every OTHER
// public route sets its own canonical; the homepage — the one Bing's ~525
// weekly citations point at — was the only one that did not.
//
// Root cause: the landing page is a Client Component (hooks, streaming widget),
// and a Client Component cannot export `metadata`, so `/` silently inherited
// the root layout's block, which never set `alternates.canonical`.
//
// The canonical is declared HERE and not in `src/app/layout.tsx` on purpose.
// Layout metadata is inherited by every route that does not override it, and
// eight public routes declare no canonical of their own — including
// `/privacy`, `/terms` and `/support`, which are indexable. Putting
// `canonical: '/'` in the layout would have pointed all of them at the
// homepage, telling Google the legal pages ARE the homepage. That mistake was
// made and reverted while writing this; do not re-introduce it.
//
// `og:url` is not a canonicalization directive and was never covering this.
// ---------------------------------------------------------------------------
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function Page() {
  return <HomeClient />
}
