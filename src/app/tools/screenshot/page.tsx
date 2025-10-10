'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import html2canvas from 'html2canvas'

export default function ScreenshotToolPage() {
  const [selectedProduct, setSelectedProduct] = useState({
    name: 'Snail 96 Mucin Essence',
    brand: 'COSRX',
    seoulPrice: 23,
    usPrice: 89,
    savings: 66
  })
  const [customMessage, setCustomMessage] = useState("Just discovered I've been overpaying by 74%! 🤯")
  const screenshotRef = useRef<HTMLDivElement>(null)

  const products = [
    { name: 'Snail 96 Mucin Essence', brand: 'COSRX', seoulPrice: 23, usPrice: 89, savings: 66 },
    { name: 'Glow Deep Serum', brand: 'Beauty of Joseon', seoulPrice: 8, usPrice: 45, savings: 37 },
    { name: 'Water Sleeping Mask', brand: 'Laneige', seoulPrice: 12, usPrice: 34, savings: 22 },
    { name: 'First Care Activating Serum', brand: 'Sulwhasoo', seoulPrice: 28, usPrice: 94, savings: 66 }
  ]

  const templates = [
    "Just discovered I've been overpaying by {savings}%! 🤯",
    "Seoul Sister just saved me ${savingsAmount} on my skincare! 💅",
    "Why is {brand} {product} 74% cheaper in Seoul?! 😱",
    "POV: You find out your $89 essence costs $23 in Seoul 🫠",
    "Gate keeping is over - here's how to get K-beauty at Seoul prices ✨"
  ]

  const takeScreenshot = async () => {
    if (screenshotRef.current) {
      try {
        const canvas = await html2canvas(screenshotRef.current, {
          backgroundColor: '#000000',
          scale: 2
        })

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'seoul-sister-story.png'
            a.click()
            URL.revokeObjectURL(url)
          }
        })
      } catch (error) {
        console.error('Screenshot failed:', error)
      }
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
        <div className="luxury-container">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-light mb-4">Instagram Story Generator</h1>
            <p className="text-gray-400">Create a viral story showing your Seoul Sister savings</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Controls */}
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-medium mb-4 text-yellow-500">
                  SELECT PRODUCT
                </label>
                <select
                  className="w-full px-4 py-3 bg-black border border-yellow-500/30 text-white"
                  onChange={(e) => {
                    const product = products[parseInt(e.target.value)]
                    setSelectedProduct(product)
                  }}
                >
                  {products.map((product, index) => (
                    <option key={index} value={index}>
                      {product.brand} - {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-4 text-yellow-500">
                  CAPTION TEMPLATE
                </label>
                <select
                  className="w-full px-4 py-3 bg-black border border-yellow-500/30 text-white mb-4"
                  onChange={(e) => setCustomMessage(e.target.value)}
                >
                  {templates.map((template, index) => (
                    <option key={index} value={template}>
                      {template}
                    </option>
                  ))}
                </select>
                <textarea
                  className="w-full px-4 py-3 bg-black border border-yellow-500/30 text-white"
                  rows={3}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </div>

              <button
                onClick={takeScreenshot}
                className="w-full py-4 bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-colors"
              >
                DOWNLOAD STORY IMAGE
              </button>
            </div>

            {/* Preview */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm">
                <div
                  ref={screenshotRef}
                  className="bg-black border border-yellow-500/20 aspect-[9/16] flex flex-col justify-center items-center p-8 relative"
                >
                  {/* Story Content */}
                  <div className="text-center space-y-8">
                    <div className="text-yellow-500 text-sm font-bold tracking-widest">
                      SEOUL SISTER
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-3xl font-light text-white">
                        {selectedProduct.brand}
                      </h2>
                      <p className="text-xl text-gray-400">
                        {selectedProduct.name}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-xs text-gray-500 mb-2">US RETAIL</p>
                        <p className="text-3xl line-through text-gray-400">
                          ${selectedProduct.usPrice}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-yellow-500 mb-2">SEOUL PRICE</p>
                        <p className="text-3xl text-yellow-500">
                          ${selectedProduct.seoulPrice}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-yellow-500/30 pt-6">
                      <p className="text-5xl font-bold text-yellow-500">
                        ${selectedProduct.savings}
                      </p>
                      <p className="text-sm text-gray-400 mt-2">SAVED</p>
                    </div>

                    <p className="text-sm text-gray-300 italic px-4">
                      {customMessage
                        .replace('{savings}', Math.round((selectedProduct.savings / selectedProduct.usPrice) * 100).toString())
                        .replace('{savingsAmount}', selectedProduct.savings.toString())
                        .replace('{brand}', selectedProduct.brand)
                        .replace('{product}', selectedProduct.name)}
                    </p>

                    <div className="absolute bottom-4 left-4 right-4 text-xs text-gray-500">
                      seoulsister.com
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}