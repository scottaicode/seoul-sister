'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  name_english: string
  name_korean: string
  brand: string
  seoul_price: number
  us_price: number
  savings_percentage: number
  category: string
  in_stock: boolean
  image_url?: string
}

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const router = useRouter()

  // Analytics data (would be fetched from API in production)
  const analytics = {
    totalRevenue: 47892,
    monthlyGrowth: 234,
    totalOrders: 312,
    conversionRate: 5.8,
    avgSavings: 73,
    totalCustomers: 1847
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    try {
      const response = await fetch('/api/products')
      const data = await response.json()
      setProducts(data.products)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProduct(product: Partial<Product>) {
    try {
      const method = product.id ? 'PUT' : 'POST'
      const url = product.id ? `/api/products/${product.id}` : '/api/products'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      })

      if (response.ok) {
        await fetchProducts()
        setEditingProduct(null)
        setShowAddForm(false)
      }
    } catch (error) {
      console.error('Error saving product:', error)
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (response.ok) {
        await fetchProducts()
      }
    } catch (error) {
      console.error('Error deleting product:', error)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
        <div className="bg-zinc-900/50 border border-[#D4A574]/20 p-6 rounded-lg">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Total Revenue</p>
          <p className="text-2xl font-light text-white">${analytics.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-green-400 mt-2">+{analytics.monthlyGrowth}% this month</p>
        </div>

        <div className="bg-zinc-900/50 border border-[#D4A574]/20 p-6 rounded-lg">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Total Orders</p>
          <p className="text-2xl font-light text-white">{analytics.totalOrders}</p>
          <p className="text-xs text-[#D4A574]/60 mt-2">Last 30 days</p>
        </div>

        <div className="bg-zinc-900/50 border border-[#D4A574]/20 p-6 rounded-lg">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Conversion Rate</p>
          <p className="text-2xl font-light text-white">{analytics.conversionRate}%</p>
          <p className="text-xs text-green-400 mt-2">Above industry avg</p>
        </div>

        <div className="bg-zinc-900/50 border border-[#D4A574]/20 p-6 rounded-lg">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Avg Savings</p>
          <p className="text-2xl font-light text-white">{analytics.avgSavings}%</p>
          <p className="text-xs text-[#D4A574]/60 mt-2">Per customer</p>
        </div>

        <div className="bg-zinc-900/50 border border-[#D4A574]/20 p-6 rounded-lg">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Total Customers</p>
          <p className="text-2xl font-light text-white">{analytics.totalCustomers.toLocaleString()}</p>
          <p className="text-xs text-[#D4A574]/60 mt-2">Seoul Sisters</p>
        </div>

        <div className="bg-zinc-900/50 border border-[#D4A574]/20 p-6 rounded-lg">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Quick Actions</p>
          <div className="space-y-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="block text-[#D4A574] hover:text-white transition-colors text-sm"
            >
              + Add Product
            </button>
            <Link
              href="/admin/scraper"
              className="block text-[#D4A574] hover:text-white transition-colors text-sm"
            >
              → Price Scraper
            </Link>
          </div>
        </div>
      </div>

      {/* Product Management Section */}
      <div className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-lg p-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-light text-[#D4A574] tracking-wider">
            PRODUCT INVENTORY
          </h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-6 py-2 border border-[#D4A574] text-[#D4A574] hover:bg-[#D4A574] hover:text-black transition-all duration-300 text-sm tracking-wider"
          >
            ADD NEW PRODUCT
          </button>
        </div>

        {loading ? (
          <p className="text-[#D4A574]/60 text-center py-8">Loading products...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D4A574]/20">
                  <th className="text-left py-4 px-2 text-xs text-[#D4A574]/60 uppercase tracking-wider">Product</th>
                  <th className="text-left py-4 px-2 text-xs text-[#D4A574]/60 uppercase tracking-wider">Brand</th>
                  <th className="text-left py-4 px-2 text-xs text-[#D4A574]/60 uppercase tracking-wider">Seoul Price</th>
                  <th className="text-left py-4 px-2 text-xs text-[#D4A574]/60 uppercase tracking-wider">US Price</th>
                  <th className="text-left py-4 px-2 text-xs text-[#D4A574]/60 uppercase tracking-wider">Savings</th>
                  <th className="text-left py-4 px-2 text-xs text-[#D4A574]/60 uppercase tracking-wider">Status</th>
                  <th className="text-left py-4 px-2 text-xs text-[#D4A574]/60 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id} className="border-b border-[#D4A574]/10 hover:bg-[#D4A574]/5 transition-colors">
                    <td className="py-4 px-2">
                      <div>
                        <p className="text-white">{product.name_english}</p>
                        <p className="text-xs text-[#D4A574]/40">{product.category}</p>
                      </div>
                    </td>
                    <td className="py-4 px-2 text-white/80">{product.brand}</td>
                    <td className="py-4 px-2 text-green-400">${product.seoul_price}</td>
                    <td className="py-4 px-2 text-red-400">${product.us_price}</td>
                    <td className="py-4 px-2">
                      <span className="text-[#D4A574] font-bold">{product.savings_percentage}%</span>
                    </td>
                    <td className="py-4 px-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${product.in_stock ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {product.in_stock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="text-[#D4A574] hover:text-white text-sm mr-4 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-red-400 hover:text-red-300 text-sm transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {(showAddForm || editingProduct) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-[#D4A574]/20 rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-light text-[#D4A574] tracking-wider mb-6">
              {editingProduct ? 'EDIT PRODUCT' : 'ADD NEW PRODUCT'}
            </h3>

            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const product = {
                id: editingProduct?.id,
                name_english: formData.get('name_english') as string,
                name_korean: formData.get('name_korean') as string,
                brand: formData.get('brand') as string,
                category: formData.get('category') as string,
                seoul_price: parseFloat(formData.get('seoul_price') as string),
                us_price: parseFloat(formData.get('us_price') as string),
                savings_percentage: Math.round(((parseFloat(formData.get('us_price') as string) - parseFloat(formData.get('seoul_price') as string)) / parseFloat(formData.get('us_price') as string)) * 100),
                image_url: formData.get('image_url') as string,
                in_stock: formData.get('in_stock') === 'true'
              }
              handleSaveProduct(product)
            }}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">English Name</label>
                  <input
                    name="name_english"
                    defaultValue={editingProduct?.name_english}
                    required
                    className="w-full bg-black border border-[#D4A574]/20 text-white px-4 py-2 rounded focus:border-[#D4A574] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Korean Name</label>
                  <input
                    name="name_korean"
                    defaultValue={editingProduct?.name_korean}
                    required
                    className="w-full bg-black border border-[#D4A574]/20 text-white px-4 py-2 rounded focus:border-[#D4A574] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Brand</label>
                  <input
                    name="brand"
                    defaultValue={editingProduct?.brand}
                    required
                    className="w-full bg-black border border-[#D4A574]/20 text-white px-4 py-2 rounded focus:border-[#D4A574] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Category</label>
                  <select
                    name="category"
                    defaultValue={editingProduct?.category}
                    required
                    className="w-full bg-black border border-[#D4A574]/20 text-white px-4 py-2 rounded focus:border-[#D4A574] outline-none"
                  >
                    <option value="Serum">Serum</option>
                    <option value="Essence">Essence</option>
                    <option value="Mask">Mask</option>
                    <option value="Cleanser">Cleanser</option>
                    <option value="Toner">Toner</option>
                    <option value="Moisturizer">Moisturizer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Seoul Price ($)</label>
                  <input
                    name="seoul_price"
                    type="number"
                    step="0.01"
                    defaultValue={editingProduct?.seoul_price}
                    required
                    className="w-full bg-black border border-[#D4A574]/20 text-white px-4 py-2 rounded focus:border-[#D4A574] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">US Price ($)</label>
                  <input
                    name="us_price"
                    type="number"
                    step="0.01"
                    defaultValue={editingProduct?.us_price}
                    required
                    className="w-full bg-black border border-[#D4A574]/20 text-white px-4 py-2 rounded focus:border-[#D4A574] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Stock Status</label>
                  <select
                    name="in_stock"
                    defaultValue={editingProduct?.in_stock ? 'true' : 'false'}
                    className="w-full bg-black border border-[#D4A574]/20 text-white px-4 py-2 rounded focus:border-[#D4A574] outline-none"
                  >
                    <option value="true">In Stock</option>
                    <option value="false">Out of Stock</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Image URL</label>
                <input
                  name="image_url"
                  defaultValue={editingProduct?.image_url}
                  className="w-full bg-black border border-[#D4A574]/20 text-white px-4 py-2 rounded focus:border-[#D4A574] outline-none"
                />
              </div>

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null)
                    setShowAddForm(false)
                  }}
                  className="px-6 py-2 border border-[#D4A574]/20 text-[#D4A574]/60 hover:text-[#D4A574] hover:border-[#D4A574] transition-all duration-300 text-sm tracking-wider"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#D4A574] text-black hover:bg-[#D4A574]/80 transition-all duration-300 text-sm tracking-wider font-medium"
                >
                  {editingProduct ? 'UPDATE PRODUCT' : 'ADD PRODUCT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}