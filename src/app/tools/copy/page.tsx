'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function CopyGeneratorPage() {
  const [platform, setPlatform] = useState('tiktok')
  const [product, setProduct] = useState('Water Sleeping Mask')
  const [brand, setBrand] = useState('LANEIGE')
  const [generatedCopy, setGeneratedCopy] = useState('')
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const products = [
    { name: 'Water Sleeping Mask', brand: 'LANEIGE' },
    { name: 'Snail 96 Mucin Essence', brand: 'COSRX' },
    { name: 'Glow Deep Serum', brand: 'Beauty of Joseon' },
    { name: 'First Care Activating Serum', brand: 'Sulwhasoo' }
  ]

  const generateCopy = async () => {
    setIsGenerating(true)
    setGeneratedCopy('')

    try {
      const response = await fetch('/api/generate-viral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product,
          brand,
          platforms: [platform]
        })
      })

      const data = await response.json()

      if (data.success && data.content[platform]) {
        // Extract the content from AI response
        const content = data.content[platform].content

        // If it's AI-generated, parse and format it
        if (typeof content === 'string') {
          // Extract the most relevant part based on platform
          let formattedContent = ''

          if (platform === 'tiktok') {
            // Extract hook and main content
            const hookMatch = content.match(/hook[:\s]+(.+?)(?:\n|$)/i)
            const scriptMatch = content.match(/script[:\s]+([\s\S]+?)(?:hashtag|$)/i)
            const hashtagMatch = content.match(/hashtag[s:\s]+([\s\S]+?)$/i)

            formattedContent = hookMatch ? hookMatch[1] + '\n\n' : ''
            if (scriptMatch) formattedContent += scriptMatch[1].trim() + '\n\n'
            if (hashtagMatch) formattedContent += hashtagMatch[1].trim()
          } else {
            // For other platforms, use the full content
            formattedContent = content
          }

          setGeneratedCopy(formattedContent || content)
        } else if (content && typeof content === 'object') {
          // Handle structured content
          if (platform === 'tiktok' && content.hook) {
            setGeneratedCopy(`${content.hook}\n\n${content.script || ''}\n\n${content.hashtags || ''}`)
          } else if (platform === 'instagram' && Array.isArray(content.carousel)) {
            setGeneratedCopy(content.caption || content.carousel.join('\n\n'))
          } else if (platform === 'twitter' && Array.isArray(content.tweets)) {
            setGeneratedCopy(content.tweets[0] || '')
          } else {
            setGeneratedCopy(JSON.stringify(content, null, 2))
          }
        }
      } else {
        // Fallback to static template if AI fails
        setGeneratedCopy(`STOP paying US prices for K-beauty! 🛑

${brand} ${product}:
❌ Sephora: $${data.prices?.us || 34}
✅ Seoul Sister: $${data.prices?.seoul || 12}

The math is mathing 💅

#KBeauty #SeoulPrices #SkincareAddict`)
      }
    } catch (error) {
      console.error('Error generating copy:', error)
      // Fallback content
      setGeneratedCopy(`Just discovered ${brand} ${product} is 70% cheaper in Seoul!

Seoul Sister gets you the real Seoul price. No cap.

#KBeauty #SeoulSister #BeautyScam`)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProductChange = (productName: string) => {
    setProduct(productName)
    const selectedProduct = products.find(p => p.name === productName)
    if (selectedProduct) {
      setBrand(selectedProduct.brand)
    }
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
                  {['tiktok', 'instagram', 'twitter', 'pinterest'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`py-3 px-4 border transition-all ${
                        platform === p
                          ? 'bg-yellow-500 text-black border-yellow-500'
                          : 'border-gray-700 hover:border-yellow-500'
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
                  value={product}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full bg-black border border-gray-700 px-4 py-3 focus:border-yellow-500 focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.brand} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={generateCopy}
                disabled={isGenerating}
                className="w-full bg-yellow-500 text-black py-4 font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'GENERATING WITH AI...' : 'GENERATE VIRAL COPY'}
              </button>
            </div>

            {/* Generated Copy */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-4 text-yellow-500">
                  GENERATED COPY
                </label>
                <div className="bg-gray-900 border border-gray-700 p-6 min-h-[300px]">
                  {isGenerating ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-pulse text-gray-400">Creating viral content with Claude AI...</div>
                    </div>
                  ) : generatedCopy ? (
                    <pre className="whitespace-pre-wrap text-sm font-mono">{generatedCopy}</pre>
                  ) : (
                    <p className="text-gray-500 italic">
                      Click "Generate Viral Copy" to create AI-powered content
                    </p>
                  )}
                </div>
              </div>

              {generatedCopy && (
                <button
                  onClick={copyToClipboard}
                  className="w-full border border-yellow-500 text-yellow-500 py-3 hover:bg-yellow-500 hover:text-black transition-all"
                >
                  {copied ? '✓ COPIED!' : 'COPY TO CLIPBOARD'}
                </button>
              )}

              <div className="border-t border-gray-800 pt-6">
                <h3 className="text-sm font-medium mb-3 text-yellow-500">PRO TIPS</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>• Post between 6-10am or 7-11pm for best engagement</li>
                  <li>• Add trending audio to boost visibility</li>
                  <li>• Show the price comparison visually in your video</li>
                  <li>• Use Claude AI for unique, authentic content every time</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}