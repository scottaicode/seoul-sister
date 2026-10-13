'use client'

import { Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { buildBlogPrefill, blogCtaHref, shownOpener } from './blog-prefill'
import { trackEvent, BlogEvent } from '@/lib/analytics'

interface BlogInlineYuriPromptProps {
  title?: string | null
  category?: string | null
  primaryKeyword?: string | null
  /** Site-relative path of THIS post, so the widget can record which page
   *  produced the conversation. See ss_widget_sessions.landing_path. */
  feederPath?: string | null
  /** ss_content_posts.yuri_opener — see blog-prefill.ts. */
  yuriOpener?: string | null
}

function getPromptText(category?: string | null): string {
  const cat = category?.toLowerCase() || ''

  if (cat.includes('routine') || cat.includes('guide'))
    return 'Not sure which products fit you? Yuri can build a routine for your skin type.'
  if (cat.includes('ingredient'))
    return 'Want to know if this ingredient works for YOUR skin? Ask Yuri.'
  if (cat.includes('sunscreen') || cat.includes('spf') || cat.includes('sun'))
    return 'Need help picking the right sunscreen? Yuri knows every K-beauty SPF.'
  if (cat.includes('acne'))
    return 'Breaking out and not sure what to use? Yuri can help you figure it out.'
  if (cat.includes('trend'))
    return 'Curious what else is worth trying? Yuri tracks live Korean bestseller data.'

  return 'Have a question about your own skin? Ask Yuri. She will tell you what is worth your money and what to skip.'
}

export default function BlogInlineYuriPrompt({ title, category, primaryKeyword, feederPath, yuriOpener }: BlogInlineYuriPromptProps) {
  const { user } = useAuth()

  // A real <Link href>, for the same reason as BlogYuriCta: navigation used to
  // live in a click handler, so no `?ask=` link existed in the delivered HTML.
  // This component renders 2-3 times per post, so it is most of the blog's CTA
  // surface and most of the missing internal links to `/`.
  //
  // It was also a `div role="button"` with a hand-rolled onKeyDown. A real
  // anchor gets keyboard activation, focus handling, middle-click and
  // open-in-new-tab for free, so the a11y shim is deleted rather than kept.
  //
  // href swaps on auth (no preventDefault) — see BlogYuriCta for why.
  const prefill = buildBlogPrefill({ title, category, primaryKeyword, opener: yuriOpener })
  // `fp` (feeder path) names WHICH post, where `from=blog` names only the KIND.
  // Explicit rather than inferred: the widget also reads the same-origin
  // referrer as a fallback, but a referrer is a claim the BROWSER controls
  // (rel="noreferrer", a referrer-policy change, an in-app webview) while a
  // param is one we control. Belt and braces — either alone would work today.
  // Anonymous readers see the exact question that will start their chat, so
  // the click promises nothing the conversation won't open with. Signed-in
  // readers go to /yuri, which ignores the prefill, so they keep the generic line.
  const own = shownOpener(yuriOpener, !!user)
  const href = blogCtaHref(prefill, !!user, feederPath)

  return (
    <Link
      href={href}
      onClick={() => trackEvent(BlogEvent.ctaClick, { placement: 'inline_prompt', authed: !!user })}
      className="my-10 flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 cursor-pointer hover:bg-amber-500/15 hover:border-amber-500/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
        {own ? (
          // Label on its own line so a ~100-char question wraps cleanly at 390px.
          <span className="min-w-0">
            <span className="block text-xs font-medium text-amber-300 mb-0.5">Ask Yuri, free:</span>
            <span className="block text-sm md:text-base text-white/90">&ldquo;{own}&rdquo;</span>
          </span>
        ) : (
          <span className="text-sm md:text-base text-white/90">{getPromptText(category)}</span>
        )}
      </div>
      <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
    </Link>
  )
}
