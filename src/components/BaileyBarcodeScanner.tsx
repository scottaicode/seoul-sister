'use client'

import { useState, useEffect, useRef } from 'react'
import { Scan, ShoppingCart, TrendingDown, AlertCircle, Check, X, DollarSign, Store } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import barcode scanner to avoid SSR issues
// @ts-ignore - Package will be installed later
const BarcodeScanner = dynamic(() => import('react-qr-barcode-scanner' as any), { ssr: false })

interface BarcodeScannerProps {
  userId?: string
  whatsappNumber?: string
  currentLocation?: string
  existingProducts?: any[]
}

interface PriceComparison {
  inStore: number
  online: {
    amazon?: number
    sephora?: number
    ulta?: number
    target?: number
    walmart?: number
    cvs?: number
    brand?: number
    lowest: {
      price: number
      retailer: string
      savings: number
      url?: string
    }
  }
  verdict: 'good-deal' | 'overpriced' | 'fair'
  savings: number
  recommendation: string
}

export default function BaileyBarcodeScanner({
  userId,
  whatsappNumber,
  currentLocation,
  existingProducts = []
}: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [barcode, setBarcode] = useState<string>('')
  const [manualEntry, setManualEntry] = useState('')
  const [storePrice, setStorePrice] = useState<string>('')
  const [storeName, setStoreName] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleBarcodeScan = async (scannedBarcode: string) => {
    if (!scannedBarcode || isAnalyzing) return

    setBarcode(scannedBarcode)
    setIsScanning(false)

    // Stop camera
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
    }

    // Auto-trigger analysis if we have store price
    if (storePrice) {
      analyzePriceComparison(scannedBarcode)
    }
  }

  const analyzePriceComparison = async (barcodeToUse?: string) => {
    const finalBarcode = barcodeToUse || barcode || manualEntry

    if (!finalBarcode) {
      setError('Please scan or enter a barcode')
      return
    }

    if (!storePrice) {
      setError('Please enter the store price')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/bailey-barcode-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: finalBarcode,
          storePrice: parseFloat(storePrice),
          storeName: storeName || currentLocation || 'Current Store',
          userId,
          whatsappNumber,
          existingProducts
        })
      })

      const data = await response.json()

      if (data.success) {
        setScanResult(data)
      } else {
        setError(data.error || 'Failed to analyze product')
      }
    } catch (err) {
      console.error('Error analyzing barcode:', err)
      setError('Failed to look up product. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const resetScanner = () => {
    setBarcode('')
    setManualEntry('')
    setStorePrice('')
    setStoreName('')
    setScanResult(null)
    setError(null)
    setIsScanning(false)
  }

  const getPriceVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'good-deal': return 'text-green-600'
      case 'overpriced': return 'text-red-600'
      case 'fair': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  const getPriceVerdictEmoji = (verdict: string) => {
    switch (verdict) {
      case 'good-deal': return '✅'
      case 'overpriced': return '❌'
      case 'fair': return '➖'
      default: return '❓'
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          In-Store Price Checker
        </h2>
        <p className="text-gray-600">
          Bailey will instantly compare prices and check if you already own similar products
        </p>
      </div>

      {!scanResult ? (
        <div className="space-y-6">
          {/* Store Information */}
          <div className="bg-purple-50 rounded-xl p-4">
            <h3 className="font-medium text-purple-900 mb-3">Where are you shopping?</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Store name (optional)"
                className="px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Store price*"
                className="px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                value={storePrice}
                onChange={(e) => setStorePrice(e.target.value)}
                required
              />
            </div>
            <p className="text-xs text-purple-600 mt-2">
              * Enter the price you see in store (before tax)
            </p>
          </div>

          {/* Barcode Input Methods */}
          <div className="space-y-4">
            {/* Camera Scanner */}
            {!barcode && !manualEntry && (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                {isScanning ? (
                  <div className="space-y-4">
                    <div className="bg-black rounded-lg overflow-hidden" style={{ height: '300px' }}>
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-32 border-2 border-yellow-400 rounded-lg">
                          <div className="w-full h-0.5 bg-red-500 absolute top-1/2 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsScanning(false)}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel Scanning
                    </button>
                  </div>
                ) : (
                  <>
                    <Scan className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                    <p className="text-lg font-medium mb-2">Scan Product Barcode</p>
                    <p className="text-sm text-gray-600 mb-4">
                      Point your camera at the barcode on the product
                    </p>
                    <button
                      onClick={() => setIsScanning(true)}
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600"
                    >
                      Start Camera Scanner
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Manual Entry */}
            {!isScanning && !barcode && (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-3">or</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type barcode number manually"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    value={manualEntry}
                    onChange={(e) => setManualEntry(e.target.value)}
                  />
                  <button
                    onClick={() => analyzePriceComparison()}
                    disabled={!manualEntry || !storePrice || isAnalyzing}
                    className="px-6 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50"
                  >
                    Analyze
                  </button>
                </div>
              </div>
            )}

            {/* Scanned Barcode Display */}
            {barcode && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700 font-medium">Barcode Scanned!</p>
                    <p className="text-lg font-mono text-green-900">{barcode}</p>
                  </div>
                  <button
                    onClick={() => analyzePriceComparison()}
                    disabled={!storePrice || isAnalyzing}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Check Prices'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Loading State */}
          {isAnalyzing && (
            <div className="text-center py-8">
              <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg font-medium text-gray-700">Bailey is checking prices...</p>
              <p className="text-sm text-gray-500">Comparing across multiple retailers</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Results Display */
        <div className="space-y-6">
          {/* Product Information */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">
                  {scanResult.product.name}
                </h3>
                <p className="text-gray-600">{scanResult.product.brand}</p>
                <p className="text-sm text-gray-500">{scanResult.product.category}</p>
              </div>
              <button
                onClick={resetScanner}
                className="p-2 hover:bg-white rounded-lg transition-all"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Bailey's Verdict */}
            <div className="bg-white rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Price Analysis</span>
                <span className={`text-2xl font-bold ${getPriceVerdictColor(scanResult.priceComparison.verdict)}`}>
                  {getPriceVerdictEmoji(scanResult.priceComparison.verdict)} {scanResult.priceComparison.verdict.replace('-', ' ').toUpperCase()}
                </span>
              </div>
              <p className="text-gray-700">
                {scanResult.baileyMessage}
              </p>
            </div>
          </div>

          {/* Price Comparison Chart */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h4 className="font-semibold text-gray-800 mb-4">
              <DollarSign className="inline-block w-5 h-5 mr-2" />
              Price Comparison
            </h4>

            <div className="space-y-3">
              {/* In-Store Price */}
              <div className="flex items-center justify-between p-3 bg-purple-100 rounded-lg">
                <div className="flex items-center">
                  <Store className="w-5 h-5 mr-2 text-purple-600" />
                  <span className="font-medium">{scanResult.storeName}</span>
                </div>
                <span className="text-xl font-bold text-purple-700">
                  ${scanResult.priceComparison.inStore.toFixed(2)}
                </span>
              </div>

              {/* Online Prices */}
              {Object.entries(scanResult.priceComparison.online)
                .filter(([key]) => key !== 'lowest' && scanResult.priceComparison.online[key as keyof typeof scanResult.priceComparison.online])
                .sort(([, a], [, b]) => (a as number) - (b as number))
                .map(([retailer, price]) => (
                  <div key={retailer} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <span className="capitalize">{retailer}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">${(price as number).toFixed(2)}</span>
                      {(price as number) < scanResult.priceComparison.inStore && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          Save ${(scanResult.priceComparison.inStore - (price as number)).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

              {/* Lowest Price Highlight */}
              {scanResult.priceComparison.online.lowest && (
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border-2 border-green-300">
                  <div>
                    <p className="text-sm text-green-700 font-medium">BEST PRICE FOUND</p>
                    <p className="font-semibold capitalize">{scanResult.priceComparison.online.lowest.retailer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-700">
                      ${scanResult.priceComparison.online.lowest.price.toFixed(2)}
                    </p>
                    <p className="text-sm text-green-600">
                      Save ${scanResult.priceComparison.online.lowest.savings.toFixed(2)}!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Duplicate/Similar Product Warning */}
          {scanResult.recommendation?.similarOwned && scanResult.recommendation.similarOwned.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h4 className="font-medium text-yellow-800 mb-2">
                <AlertCircle className="inline-block w-5 h-5 mr-2" />
                You Already Own Similar Products
              </h4>
              <div className="space-y-2">
                {scanResult.recommendation.similarOwned.map((product: any, idx: number) => (
                  <div key={idx} className="text-sm text-yellow-700">
                    • {product.name} - {product.similarity}
                  </div>
                ))}
              </div>
              <p className="text-sm text-yellow-600 mt-3">
                {scanResult.recommendation.duplicateAdvice}
              </p>
            </div>
          )}

          {/* Ingredient Analysis */}
          {scanResult.ingredients && (
            <div className="bg-purple-50 rounded-xl p-6">
              <h4 className="font-semibold text-purple-900 mb-3">
                Ingredient Analysis
              </h4>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-sm text-gray-600 mb-1">Cleanliness</p>
                  <p className="text-xl font-bold text-purple-700">
                    {scanResult.ingredients.cleanlinessScore}/100
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-sm text-gray-600 mb-1">For Your Skin</p>
                  <p className="text-xl font-bold text-purple-700">
                    {scanResult.recommendation.userNeedsThis ? '✅ Good' : '⚠️ Maybe Not'}
                  </p>
                </div>
              </div>

              {scanResult.recommendation.reason && (
                <p className="text-sm text-gray-700">
                  {scanResult.recommendation.reason}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                // Save to wishlist logic
                console.log('Save to wishlist:', scanResult)
              }}
              className="flex-1 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              Save to Wishlist
            </button>
            <button
              onClick={resetScanner}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Scan Another
            </button>
          </div>

          {/* Bailey's Tip */}
          <div className="text-center text-sm text-gray-500 italic">
            💡 Tip: Always check online prices before buying in-store. The "sale" might not be a deal!
          </div>
        </div>
      )}
    </div>
  )
}