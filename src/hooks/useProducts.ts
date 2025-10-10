import { useState, useEffect } from 'react'

export interface Product {
  id: string
  name_korean: string
  name_english: string
  brand: string
  seoul_price: number
  us_price: number
  savings_percentage: number
  category: string
  description?: string
  image_url?: string
  korean_site_url?: string
  us_site_url?: string
  skin_type?: string
  in_stock: boolean
}

export function useProducts(featured = false) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProducts() {
      try {
        const params = new URLSearchParams()
        if (featured) {
          params.append('featured', 'true')
        }

        const response = await fetch(`/api/products?${params}`)
        if (!response.ok) {
          throw new Error('Failed to fetch products')
        }

        const data = await response.json()
        setProducts(data.products)
      } catch (err) {
        console.error('Error fetching products:', err)
        setError(err instanceof Error ? err.message : 'Failed to load products')

        // Fallback to static data if API fails
        setProducts([
          {
            id: '1',
            name_korean: '퍼스트 케어 액티베이팅 세럼',
            name_english: 'First Care Activating Serum',
            brand: 'Sulwhasoo',
            seoul_price: 28.00,
            us_price: 94.00,
            savings_percentage: 70,
            category: 'Serum',
            image_url: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&h=600&fit=crop',
            in_stock: true
          },
          {
            id: '2',
            name_korean: '글로우 딥 세럼',
            name_english: 'Glow Deep Serum',
            brand: 'Beauty of Joseon',
            seoul_price: 8.50,
            us_price: 45.00,
            savings_percentage: 82,
            category: 'Serum',
            image_url: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=600&h=600&fit=crop',
            in_stock: true
          },
          {
            id: '3',
            name_korean: '달팽이 96 뮤신 에센스',
            name_english: 'Snail 96 Mucin Essence',
            brand: 'COSRX',
            seoul_price: 12.00,
            us_price: 89.00,
            savings_percentage: 74,
            category: 'Essence',
            image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop',
            in_stock: true
          },
          {
            id: '4',
            name_korean: '워터 슬리핑 마스크',
            name_english: 'Water Sleeping Mask',
            brand: 'Laneige',
            seoul_price: 12.00,
            us_price: 34.00,
            savings_percentage: 65,
            category: 'Mask',
            image_url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=600&fit=crop',
            in_stock: true
          }
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [featured])

  return { products, loading, error }
}