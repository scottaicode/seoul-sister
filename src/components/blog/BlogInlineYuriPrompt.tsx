'use client'

import { Sparkles } from 'lucide-react'

interface BlogInlineYuriPromptProps {
  category?: string | null
  primaryKeyword?: string | null
}

function getPromptText(category?: string | null): string {
  const cat = category?.toLowerCase() || ''

  if (cat.includes('routine') || cat.includes('guide'))
    return 'Not sure which products to use? Yuri can build a routine for your skin type \u2192'

  if (cat.includes('ingredient'))
    return 'Want to check if this ingredient works for your skin? Ask Yuri \u2192'

  if (cat.includes('sunscreen') || cat.includes('spf') || cat.includes('sun'))
    return 'Need help picking the right sunscreen? Yuri knows every K-beauty SPF \u2192'

  if (cat.includes('trend'))
    return 'Curious what else is trending? Yuri tracks live Korean bestseller data \u2192'

  return 'Have a question about this? Ask Yuri \u2014 she has access to our full product database \u2192'
}

export default function BlogInlineYuriPrompt({ category }: BlogInlineYuriPromptProps) {
  const openYuri = () => {
    window.dispatchEvent(new CustomEvent('open-yuri'))
  }

  return (
    <p
      onClick={openYuri}
      className="flex items-center gap-2 text-sm text-amber-400/70 hover:text-amber-400 cursor-pointer transition-colors my-8"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openYuri() }}
    >
      <Sparkles className="w-3.5 h-3.5 shrink-0" />
      <span>{getPromptText(category)}</span>
    </p>
  )
}
