'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function CopyGeneratorPage() {
  const [platform, setPlatform] = useState('tiktok')
  const [product, setProduct] = useState('Snail 96 Mucin Essence')
  const [generatedCopy, setGeneratedCopy] = useState('')
  const [copied, setCopied] = useState(false)

  const products = [
    'Snail 96 Mucin Essence',
    'Glow Deep Serum',
    'Water Sleeping Mask',
    'First Care Activating Serum'
  ]

  const templates = {
    tiktok: [
      "POV: You've been paying ${usPrice} for {product} when Seoul Sisters pay ${seoulPrice} 🤡\n\n#KBeauty #SeoulSister #SkincareHack #KoreanSkincare #BeautyTok #SkincareRoutine",
      "Why nobody told me {product} is 74% cheaper in Seoul?? 😭\n\nLiterally saving ${savings} per bottle through Seoul Sister!\n\n#KBeautySecrets #AffordableSkincare #SeoulSister",
      "STOP paying US prices for K-beauty! 🛑\n\n{product}: \n❌ Sephora: ${usPrice}\n✅ Seoul Sister: ${seoulPrice}\n\nThe math is mathing 💅\n\n#KBeauty #SeoulPrices #SkincareAddict"
    ],
    instagram: [
      "Your sign to stop overpaying for K-beauty 💌\n\nJust found out {product} costs ${seoulPrice} in Seoul vs ${usPrice} at Sephora. That's a ${savings} difference! 🤯\n\nSeoul Sister brings you authentic K-beauty at Seoul prices. Link in bio for insider access ✨\n\n#KBeauty #KoreanSkincare #SeoulSister #SkincareRoutine #GlowUp #KBeautyAddict #SkincareSecrets",
      "Today's reminder that gate-keeping is over 🔓\n\n{product} price breakdown:\n📍 US Retail: ${usPrice}\n📍 Seoul Price: ${seoulPrice}\n📍 Your Savings: ${savings}\n\nJoin Seoul Sister for insider pricing on all your K-beauty favs 🇰🇷\n\n#KoreanBeauty #SeoulSister #SkincareDeals #KBeautyCommunity"
    ],
    twitter: [
      "just found out I've been paying 3x more for {product} and I'm going through all stages of grief simultaneously\n\nSeoul: ${seoulPrice}\nUS: ${usPrice}\n\nthanks @seoulsister for the reality check 💀",
      "K-beauty pricing is criminal in the US\n\n{product}:\n🇺🇸 ${usPrice}\n🇰🇷 ${seoulPrice}\n\nSeoul Sister said enough is enough",
      "the way {product} is ${usPrice} at Sephora but ${seoulPrice} in Seoul...\n\nSeoul Sister bringing us the real prices we deserve 🙏"
    ],
    pinterest: [
      "{product} Price Comparison 💰\n\n• Sephora: ${usPrice}\n• Ulta: ${usPrice}\n• Seoul Sister: ${seoulPrice}\n\nSave ${savings} on authentic K-beauty! Get insider Seoul pricing at seoulsister.com\n\n#KBeauty #SkincareRoutine #KoreanSkincare #BeautyHacks #AffordableSkincare"
    ]
  }

  const generateCopy = () => {
    const prices = {
      'Snail 96 Mucin Essence': { us: 89, seoul: 23, savings: 66 },
      'Glow Deep Serum': { us: 45, seoul: 8, savings: 37 },
      'Water Sleeping Mask': { us: 34, seoul: 12, savings: 22 },
      'First Care Activating Serum': { us: 94, seoul: 28, savings: 66 }
    }

    const productPrices = prices[product as keyof typeof prices]
    const platformTemplates = templates[platform as keyof typeof templates]
    const randomTemplate = platformTemplates[Math.floor(Math.random() * platformTemplates.length)]

    const copy = randomTemplate
      .replace(/\{product\}/g, product)
      .replace(/\$\{usPrice\}/g, `$${productPrices.us}`)
      .replace(/\$\{seoulPrice\}/g, `$${productPrices.seoul}`)
      .replace(/\$\{savings\}/g, `$${productPrices.savings}`)

    setGeneratedCopy(copy)
    setCopied(false)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="navbar-luxury">
        <div className="luxury-container flex justify-between items-center">
          <Link href="/" className="text-2xl font-light tracking-widest">
            Seoul Sister
          </Link>
          <Link href="/" className="text-sm hover:text-yellow-500 transition-colors">
            Back to Home
          </Link>
        </div>
      </nav>

      <div className="pt-32 pb-20">
        <div className="luxury-container max-w-4xl">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-light mb-4">Viral Copy Generator</h1>
            <p className="text-gray-400">Generate platform-optimized content for your Seoul Sister savings</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Controls */}
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-medium mb-4 text-yellow-500">
                  SELECT PLATFORM
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {Object.keys(templates).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`py-3 px-4 border transition-all ${
                        platform === p
                          ? 'bg-yellow-500 text-black border-yellow-500'
                          : 'bg-black text-white border-yellow-500/30 hover:border-yellow-500'
                      }`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-4 text-yellow-500">
                  SELECT PRODUCT
                </label>
                <select
                  className="w-full px-4 py-3 bg-black border border-yellow-500/30 text-white"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={generateCopy}
                className="w-full py-4 bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-colors"
              >
                GENERATE VIRAL COPY
              </button>
            </div>

            {/* Output */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-4 text-yellow-500">
                  GENERATED COPY
                </label>
                <div className="bg-black border border-yellow-500/30 p-6 min-h-[300px]">
                  {generatedCopy ? (
                    <>
                      <pre className="whitespace-pre-wrap text-gray-300 font-sans">
                        {generatedCopy}
                      </pre>
                      <button
                        onClick={copyToClipboard}
                        className="mt-6 w-full py-3 border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all"
                      >
                        {copied ? 'COPIED!' : 'COPY TO CLIPBOARD'}
                      </button>
                    </>
                  ) : (
                    <p className="text-gray-500 text-center mt-20">
                      Select platform and product, then generate your viral copy
                    </p>
                  )}
                </div>
              </div>

              {generatedCopy && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-yellow-500">PRO TIPS</h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    {platform === 'tiktok' && (
                      <>
                        <li>• Post between 6-10am or 7-11pm for best engagement</li>
                        <li>• Add trending audio to boost visibility</li>
                        <li>• Show the price comparison visually in your video</li>
                      </>
                    )}
                    {platform === 'instagram' && (
                      <>
                        <li>• Use all 30 hashtags for maximum reach</li>
                        <li>• Post Reels showing your skincare haul</li>
                        <li>• Tag @seoulsister for a chance to be featured</li>
                      </>
                    )}
                    {platform === 'twitter' && (
                      <>
                        <li>• Reply to skincare threads with your savings</li>
                        <li>• Quote tweet beauty influencer product reviews</li>
                        <li>• Use 1-2 relevant hashtags max</li>
                      </>
                    )}
                    {platform === 'pinterest' && (
                      <>
                        <li>• Create a "K-Beauty Deals" board</li>
                        <li>• Use vertical images (2:3 ratio) for best performance</li>
                        <li>• Include price in your pin image</li>
                      </>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}