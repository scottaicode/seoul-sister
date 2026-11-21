'use client'

import { Sparkles } from 'lucide-react'
import { REAL_YURI_EXAMPLE, type YuriExampleMessage } from '@/content/yuri-example'

interface GatedYuriIntroProps {
  /** The question a feeder page ("Ask Yuri about this product") sent them here with, or ''. */
  question: string
  /** The illustrative example used until a real, approved one exists. */
  fallbackExample: { label: string; messages: YuriExampleMessage[] }
}

/**
 * What the hero shows while the landing chat is closed (src/lib/landing-chat.ts):
 * who Yuri is, the visitor's own question if they came with one, and an example
 * of her at work. Display only; nothing here is generated and nothing
 * recommends a product.
 *
 * It has NO sign-up button and states no price (Nov 20 2026, Bailey). The
 * landing page's sign-up is the nav button on desktop and the bottom bar on a
 * phone, both always on screen (HomeClient). What an account starts and costs
 * is said on the sign-up form, before one exists, and on the pricing card.
 */
export default function GatedYuriIntro({ question, fallbackExample }: GatedYuriIntroProps) {
  const example = REAL_YURI_EXAMPLE ?? fallbackExample
  // "Example: a new member's first session with Yuri" is shown in two parts: the
  // word before the colon ABOVE the exchange, so a visitor knows it is an example
  // before reading it, and the description as a caption under it (Bailey, Nov 20
  // 2026: the full line in capitals cut the card in half). A label with no colon,
  // which is what a real, approved conversation carries, is shown whole, above.
  const colon = example.label.indexOf(': ')
  const exampleTag = colon > 0 ? example.label.slice(0, colon) : example.label
  const exampleCaption = colon > 0 ? example.label.slice(colon + 2) : ''

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

      {/* Framed, so it reads as a sample set into the card and not as the next
          lines of a live chat. */}
      <div className="rounded-2xl border border-dashed border-white/15 p-3">
        <p className="text-[10px] uppercase tracking-wider text-white/45 mb-2">{exampleTag}</p>
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
                {/* The illustrative example is clamped so the card stays short;
                    a real one is shown whole. */}
                <p className={REAL_YURI_EXAMPLE ? undefined : 'line-clamp-3'}>{m.text}</p>
              </div>
            </div>
          ))}
        </div>
        {exampleCaption && (
          <p className="text-[11px] text-white/45 mt-2 text-center first-letter:uppercase">{exampleCaption}</p>
        )}
      </div>
    </div>
  )
}
