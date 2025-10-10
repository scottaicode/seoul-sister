/**
 * Seoul Sister Image Validation System
 * Ensures product images are appropriate and match categories
 */

interface ValidationResult {
  isValid: boolean
  confidence: number
  issues: string[]
  suggestions: string[]
  category: string
  imageMetadata?: {
    width: number
    height: number
    format: string
    size: number
    aspectRatio: number
  }
}

class ProductImageValidator {
  private readonly MIN_IMAGE_WIDTH = 600
  private readonly MIN_IMAGE_HEIGHT = 600
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  private readonly PREFERRED_ASPECT_RATIO = 1 // Square images preferred

  // Keywords that should NOT appear in beauty product images
  private readonly FORBIDDEN_KEYWORDS = [
    'clothing', 'shirt', 'pants', 'dress', 'shoes', 'fashion',
    'apparel', 'outfit', 'wardrobe', 'textile', 'fabric',
    'model', 'mannequin', 'hanger', 'rack'
  ]

  // Expected keywords for each category
  private readonly CATEGORY_KEYWORDS: Record<string, string[]> = {
    'Serum': ['bottle', 'dropper', 'glass', 'liquid', 'skincare', 'treatment', 'essence'],
    'Mask': ['jar', 'container', 'cream', 'face', 'pack', 'sheet', 'sleeping'],
    'Cleanser': ['tube', 'foam', 'gel', 'wash', 'cleansing', 'soap'],
    'Toner': ['bottle', 'liquid', 'pad', 'cotton', 'mist', 'spray'],
    'Moisturizer': ['jar', 'cream', 'lotion', 'hydrating', 'moisture'],
    'Essence': ['bottle', 'liquid', 'treatment', 'concentrate', 'ampoule']
  }

  /**
   * Validate a product image URL
   */
  async validateImageUrl(imageUrl: string, productCategory: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      confidence: 100,
      issues: [],
      suggestions: [],
      category: productCategory
    }

    try {
      // Check URL format
      if (!this.isValidUrl(imageUrl)) {
        result.isValid = false
        result.issues.push('Invalid image URL format')
        result.confidence = 0
        return result
      }

      // Check if it's from a trusted source
      const trustedDomains = ['unsplash.com', 'supabase.co', 'seoulsister.com']
      const isTrusted = trustedDomains.some(domain => imageUrl.includes(domain))

      if (!isTrusted) {
        result.confidence -= 10
        result.suggestions.push('Consider using images from trusted sources')
      }

      // Analyze image metadata
      const metadata = await this.fetchImageMetadata(imageUrl)
      if (metadata) {
        result.imageMetadata = metadata

        // Validate dimensions
        if (metadata.width < this.MIN_IMAGE_WIDTH || metadata.height < this.MIN_IMAGE_HEIGHT) {
          result.isValid = false
          result.issues.push(`Image too small. Minimum size: ${this.MIN_IMAGE_WIDTH}x${this.MIN_IMAGE_HEIGHT}`)
          result.confidence -= 30
        }

        // Check aspect ratio
        if (Math.abs(metadata.aspectRatio - this.PREFERRED_ASPECT_RATIO) > 0.3) {
          result.suggestions.push('Square images (1:1 aspect ratio) display better')
          result.confidence -= 5
        }

        // Check file size
        if (metadata.size > this.MAX_FILE_SIZE) {
          result.issues.push('Image file too large (>5MB). This may slow down page load')
          result.confidence -= 15
        }
      }

      // Content validation based on URL patterns
      const contentValidation = this.validateContent(imageUrl, productCategory)
      if (!contentValidation.isValid) {
        result.isValid = false
        result.issues.push(...contentValidation.issues)
        result.confidence = Math.min(result.confidence, contentValidation.confidence)
      }
      result.suggestions.push(...contentValidation.suggestions)

      // AI-based content analysis (mock for now, would use real AI in production)
      const aiAnalysis = await this.analyzeImageContent(imageUrl, productCategory)
      if (aiAnalysis.inappropriateContent) {
        result.isValid = false
        result.issues.push('Image contains inappropriate content for product category')
        result.confidence = 0
      }

      return result

    } catch (error) {
      console.error('Image validation error:', error)
      return {
        isValid: false,
        confidence: 0,
        issues: ['Failed to validate image'],
        suggestions: ['Please try a different image'],
        category: productCategory
      }
    }
  }

  /**
   * Validate multiple images in batch
   */
  async validateBatch(
    images: Array<{ url: string; category: string; productName: string }>
  ): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>()

    await Promise.all(
      images.map(async (image) => {
        const result = await this.validateImageUrl(image.url, image.category)
        results.set(image.productName, result)
      })
    )

    return results
  }

  /**
   * Get recommended image sources for a product category
   */
  getRecommendedSources(category: string): string[] {
    const generalSources = [
      'Upload to Supabase Storage for best performance',
      'Use official brand product images',
      'Professional product photography on white background'
    ]

    const categorySpecific: Record<string, string[]> = {
      'Serum': ['Show dropper bottle clearly', 'Include texture shot if possible'],
      'Mask': ['Show jar or tube packaging', 'Include texture/application shot'],
      'Cleanser': ['Show foam or gel texture', 'Include packaging front view'],
      'Essence': ['Show bottle with clear branding', 'Include size reference'],
      'Moisturizer': ['Show jar or tube clearly', 'Include texture shot']
    }

    return [...generalSources, ...(categorySpecific[category] || [])]
  }

  /**
   * Fix common image issues automatically
   */
  async autoFixImage(imageUrl: string, issue: string): Promise<string | null> {
    // In production, this would use image processing APIs
    switch (issue) {
      case 'wrong_format':
        // Convert to WebP for better performance
        return this.convertToWebP(imageUrl)

      case 'too_large':
        // Compress image
        return this.compressImage(imageUrl)

      case 'wrong_aspect':
        // Crop to square
        return this.cropToSquare(imageUrl)

      default:
        return null
    }
  }

  // Private helper methods

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  private async fetchImageMetadata(url: string): Promise<ValidationResult['imageMetadata'] | null> {
    // In production, this would make a HEAD request or use an image analysis service
    // Mock implementation for now
    if (url.includes('unsplash')) {
      return {
        width: 600,
        height: 600,
        format: 'jpeg',
        size: 150000,
        aspectRatio: 1
      }
    }
    return null
  }

  private validateContent(url: string, category: string): Partial<ValidationResult> {
    const result: Partial<ValidationResult> = {
      isValid: true,
      confidence: 100,
      issues: [],
      suggestions: []
    }

    // Check for forbidden keywords in URL (basic heuristic)
    const urlLower = url.toLowerCase()

    for (const forbidden of this.FORBIDDEN_KEYWORDS) {
      if (urlLower.includes(forbidden)) {
        result.isValid = false
        result.confidence = 0
        result.issues = [`Image URL contains forbidden keyword: "${forbidden}". This suggests non-beauty product content.`]
        break
      }
    }

    // Check for category-appropriate keywords
    const expectedKeywords = this.CATEGORY_KEYWORDS[category] || []
    const hasExpectedKeyword = expectedKeywords.some(keyword => urlLower.includes(keyword))

    if (!hasExpectedKeyword && expectedKeywords.length > 0) {
      result.suggestions = [`Consider using images with keywords: ${expectedKeywords.join(', ')}`]
      result.confidence = (result.confidence || 100) - 10
    }

    return result
  }

  private async analyzeImageContent(url: string, category: string): Promise<{ inappropriateContent: boolean }> {
    // In production, this would use AI vision APIs (Claude, GPT-4V, etc.)
    // to actually analyze image content

    // Mock check based on known problematic URLs
    const problematicUrls = [
      'photo-1596755094514-f87e34085b2c', // The infamous blue shirt
      'photo-1556905055-8f358a7a47b2', // Clothing item
    ]

    const urlId = url.split('/').pop()?.split('?')[0]
    const inappropriateContent = problematicUrls.includes(urlId || '')

    return { inappropriateContent }
  }

  private async convertToWebP(url: string): Promise<string> {
    // In production, use image processing service
    return url.replace(/\.(jpg|jpeg|png)/, '.webp')
  }

  private async compressImage(url: string): Promise<string> {
    // In production, use image optimization service
    return url.includes('?') ? `${url}&q=85` : `${url}?q=85`
  }

  private async cropToSquare(url: string): Promise<string> {
    // In production, use image cropping service
    if (url.includes('unsplash')) {
      return url.replace(/w=\d+&h=\d+/, 'w=600&h=600')
    }
    return url
  }
}

// Export singleton instance
const imageValidator = new ProductImageValidator()

export default imageValidator

// Convenience functions
export const validateProductImage = async (
  imageUrl: string,
  category: string
): Promise<ValidationResult> => {
  return imageValidator.validateImageUrl(imageUrl, category)
}

export const validateAllProducts = async (
  products: Array<{ image_url: string; category: string; name_english: string }>
): Promise<Map<string, ValidationResult>> => {
  const images = products.map(p => ({
    url: p.image_url,
    category: p.category,
    productName: p.name_english
  }))
  return imageValidator.validateBatch(images)
}

export const getImageRecommendations = (category: string): string[] => {
  return imageValidator.getRecommendedSources(category)
}

export const autoFixImageIssue = async (
  imageUrl: string,
  issue: string
): Promise<string | null> => {
  return imageValidator.autoFixImage(imageUrl, issue)
}