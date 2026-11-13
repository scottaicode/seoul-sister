'use client'

import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'
import { gatedSignupHref } from '@/lib/landing-chat'
import { trackEvent, DemoEvent } from '@/lib/analytics'
import { widgetMembershipLine } from '@/lib/offers'
import { REAL_YURI_EXAMPLE, type YuriExampleMessage } from '@/content/yuri-example'

interface GatedYuriIntroProps {
  /** The question a feeder page ("Ask Yuri about this product") sent them here with, or ''. */
  question: string
  /** Where they arrived from (blog, product, tiktok, ...), for the sign-up link. */
  source: string | null
  /** A confirmed creator code's percent off, so the price line is the one they will pay. */
  percentOff: number | null | undefined
  /** The illustrative example used until a real, approved one exists. */
  fallbackExample: { label: string; messages: YuriExampleMessage[] }
}

/** A sign-up click from the closed hero, counted in GA4 beside the account rows. */
function trackGateClick(source: string | null, hasQuestion: boolean): void {
  trackEvent(DemoEvent.gateSignupClick, { source: source || 'unknown', has_question: hasQuestion })
}

/**
 * What the hero shows while the landing chat is closed (src/lib/landing-chat.ts):
 * who Yuri is, the visitor's own question if they came with one, one way
 * forward, and an example of her at work. Display and navigation only; nothing
 * here is generated and nothing recommends a product.
 */
export default function GatedYuriIntro({ question, source, percentOff, fallbackExample }: GatedYuriIntroProps) {
  const example = REAL_YURI_EXAMPLE ?? fallbackExample
  const href = gatedSignupHref(source, question)

  return (
    <div className="p-4 space-y-3">
      <div className="flex justify-start">
        <div className="max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-white/5 border border-gold/25 text-white/85">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3 h-3 text-gold" />
            <p className="font-semibold text-gold">Yuri</p>
          </div>
          Hey, I&apos;m Yuri, an AI K-beauty advisor who&apos;s honest to a fault. I give my
          best read once I know your skin, so we start with a free account: I ask about
          your skin and what you&apos;re using, and we go from there.
        </div>
      </div>

      {question && (
        <div className="flex flex-col items-end gap-1">
          <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-gradient-to-br from-gold to-gold-light text-seoul-dark">
            {question}
          </div>
          <p className="text-[11px] text-white/45">
            Create your account on this device and this question will be waiting in the box, ready to send.
          </p>
        </div>
      )}

      <div className="bg-gold/5 rounded-2xl p-4 border border-gold/20 text-center">
        <Link
          href={href}
          onClick={() => trackGateClick(source, Boolean(question))}
          className="inline-flex items-center gap-1.5 glass-button-primary text-sm py-2.5 px-6"
        >
          Create my free account <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <p className="text-xs text-white/50 mt-2">{widgetMembershipLine(percentOff)}</p>
      </div>

      <div className="pt-3 mt-1 border-t border-white/10">
        <p className="text-[10px] uppercase tracking-wider text-white/35 mb-2">{example.label}</p>
        <div className="space-y-3 opacity-80">
          {example.messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gradient-to-br from-gold to-gold-light text-seoul-dark'
                    : 'bg-white/5 border border-white/10 text-white/80'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3 h-3 text-gold" />
                    <p className="font-semibold text-gold">Yuri</p>
                  </div>
                )}
                {/* The illustrative example is clamped so the greeting and the
                    button stay on screen on a phone; a real one is shown whole. */}
                <p className={REAL_YURI_EXAMPLE ? undefined : 'line-clamp-3'}>{m.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
