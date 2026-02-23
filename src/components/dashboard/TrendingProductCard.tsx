import { ChevronRight, Flame, Heart, Package, Sparkles, Star } from 'lucide-react'

export interface TrendingProduct {
  id: string
  name: string
  brand: string
  category: string
  trendSignal: string
  rating: number
  isEmerging?: boolean
}

interface TrendingProductCardProps {
  product: TrendingProduct
  skinRelevant?: boolean
}

export default function TrendingProductCard({ product, skinRelevant }: TrendingProductCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3 hover:bg-white/10 transition-all duration-300">
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
        <Package className="w-5 h-5 text-gold/60" strokeWidth={1.5} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm text-white truncate">
          {product.name}
        </p>
        <p className="text-xs text-white/40">{product.brand}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
            product.isEmerging
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
              : 'bg-gold/10 text-gold-light border border-gold/20'
          }`}>
            {product.isEmerging ? <Sparkles className="w-2.5 h-2.5" /> : <Flame className="w-2.5 h-2.5" />}
            {product.trendSignal}
          </span>
          {skinRelevant && (
            <span className="text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <Heart className="w-2.5 h-2.5" />
              Good for your skin
            </span>
          )}
          <span className="flex items-center gap-0.5 text-[10px] text-white/40">
            <Star className="w-2.5 h-2.5 fill-gold text-gold" />
            {product.rating}
          </span>
        </div>
      </div>

      <ChevronRight className="flex-shrink-0 w-4 h-4 text-white/20" />
    </div>
  )
}
