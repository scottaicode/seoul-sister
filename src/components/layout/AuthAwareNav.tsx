'use client'

import { useAuth } from '@/contexts/AuthContext'
import Header from './Header'
import PublicNav from './PublicNav'

/**
 * Renders the right nav chrome for the current user's auth state.
 *
 * - Authenticated subscribers see Header (full AppShell nav: Dashboard,
 *   Skin Profile, Scan, Products, Sunscreen, Routine, Yuri, Glass Skin,
 *   Shelf Scan, Community, Trending, Ingredients, Blog).
 * - Unauthenticated visitors see PublicNav (marketing nav: Products,
 *   Ingredients, Best Products, Blog + Sign In / Subscribe CTAs).
 *
 * Used on shared SEO surfaces that need to work for both audiences —
 * /products/[id], /ingredients, /ingredients/[slug], /best, /best/[category].
 * The page CONTENT stays identical (preserving SEO output for bots that
 * crawl unauthenticated); only the navigation chrome changes.
 *
 * Why not just wrap these pages in AppShell? AppShell enforces auth
 * (redirects to /login if no user) and a subscription check (redirects to
 * /subscribe if no plan). Both would break SEO and the public marketing
 * value of these pages. AuthAwareNav lets the same page serve both
 * audiences without any redirect side effects.
 *
 * Shipped v10.6.3 (May 18 2026) — Bailey's morning-after feedback. Goal:
 * subscriber-shared URLs work for friends/family without forcing them
 * through /login or losing the marketing landing experience, while
 * subscribers themselves never see disorienting PublicNav chrome when
 * they're inside the app.
 */
export default function AuthAwareNav() {
  const { user, loading } = useAuth()

  // While loading, render PublicNav as the safer default — it doesn't
  // depend on subscriber-only data and won't show a flash of subscriber
  // chrome before falling back to public.
  if (loading) {
    return <PublicNav />
  }

  return user ? <Header /> : <PublicNav />
}
