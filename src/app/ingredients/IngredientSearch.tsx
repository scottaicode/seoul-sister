'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { toSlug } from '@/lib/utils/slug'

interface SearchResult {
  id: string
  name_inci: string
  name_en: string
  function: string | null
  is_active: boolean
}

export default function IngredientSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.ingredients || [])
          setOpen(true)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div ref={ref} className="relative max-w-xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search ingredients (e.g. niacinamide, retinol, hyaluronic acid)"
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
          {results.map((ing) => (
            <button
              key={ing.id}
              onClick={() => {
                setOpen(false)
                router.push(`/ingredients/${toSlug(ing.name_inci)}`)
              }}
              className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-white font-medium text-sm">
                  {ing.name_en || ing.name_inci}
                </span>
                {ing.is_active && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/20 text-emerald-300">
                    Active
                  </span>
                )}
              </div>
              {ing.name_en !== ing.name_inci && (
                <p className="text-xs text-white/40 font-mono mt-0.5">{ing.name_inci}</p>
              )}
              {ing.function && (
                <p className="text-xs text-white/50 mt-0.5 line-clamp-1">{ing.function}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
