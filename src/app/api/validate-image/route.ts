import { NextResponse } from 'next/server'
import { validateProductImage, validateAllProducts } from '@/lib/image-validator'

export async function POST(request: Request) {
  try {
    const { imageUrl, category, products } = await request.json()

    // Single image validation
    if (imageUrl && category) {
      const result = await validateProductImage(imageUrl, category)
      return NextResponse.json(result)
    }

    // Batch validation
    if (products && Array.isArray(products)) {
      const results = await validateAllProducts(products)

      // Convert Map to object for JSON serialization
      const resultsObject: Record<string, any> = {}
      results.forEach((value, key) => {
        resultsObject[key] = value
      })

      return NextResponse.json({
        results: resultsObject,
        summary: {
          total: products.length,
          valid: Array.from(results.values()).filter(r => r.isValid).length,
          invalid: Array.from(results.values()).filter(r => !r.isValid).length,
          averageConfidence: Array.from(results.values()).reduce((acc, r) => acc + r.confidence, 0) / products.length
        }
      })
    }

    return NextResponse.json({ error: 'Invalid request. Provide imageUrl and category, or products array.' }, { status: 400 })

  } catch (error) {
    console.error('Image validation error:', error)
    return NextResponse.json({ error: 'Failed to validate image(s)' }, { status: 500 })
  }
}

// GET endpoint to check all current products
export async function GET(request: Request) {
  try {
    // Fetch all products from database
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/products`)
    const { products } = await response.json()

    if (!products || products.length === 0) {
      return NextResponse.json({ message: 'No products to validate' })
    }

    // Validate all product images
    const results = await validateAllProducts(products)

    // Convert Map to detailed report
    const report: any[] = []
    results.forEach((validation, productName) => {
      report.push({
        product: productName,
        status: validation.isValid ? 'PASS' : 'FAIL',
        confidence: `${validation.confidence}%`,
        issues: validation.issues,
        suggestions: validation.suggestions,
        metadata: validation.imageMetadata
      })
    })

    // Sort by confidence (lowest first, so problematic images appear at top)
    report.sort((a, b) => {
      const aConf = parseInt(a.confidence)
      const bConf = parseInt(b.confidence)
      return aConf - bConf
    })

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalProducts: products.length,
      validImages: report.filter(r => r.status === 'PASS').length,
      invalidImages: report.filter(r => r.status === 'FAIL').length,
      report
    })

  } catch (error) {
    console.error('Validation report error:', error)
    return NextResponse.json({ error: 'Failed to generate validation report' }, { status: 500 })
  }
}