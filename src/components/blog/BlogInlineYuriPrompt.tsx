'use client'

import { Sparkles, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { buildBlogPrefill } from './blog-prefill'

interface BlogInlineYuriPromptProps {
  title?: string | null
  category?: string | null
  primaryKeyword?: string | null
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

  return 'Have a question about your own skin? Ask Yuri. She knows our full product database.'
}

export default function BlogInlineYuriPrompt({ title, category, primaryKeyword }: BlogInlineYuriPromptProps) {
  const { user } = useAuth()
  const router = useRouter()

  const openYuri = () => {
    if (user) {
      router.push('/yuri')
    } else {
      const prefill = buildBlogPrefill({ title, category, primaryKeyword })
      window.dispatchEvent(new CustomEvent('open-yuri', { detail: { prefill } }))
    }
  }

  return (
    <div
      onClick={openYuri}
      className="my-10 flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 cursor-pointer hover:bg-amber-500/15 hover:border-amber-500/40 transition-colors"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openYuri() }}
    >
      <div className="flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
        <span className="text-sm md:text-base text-white/90">{getPromptText(category)}</span>
      </div>
      <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
    </div>
  )
}
