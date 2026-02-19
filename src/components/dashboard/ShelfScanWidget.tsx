'use client'

import Link from 'next/link'
import { Layers, ChevronRight, Camera } from 'lucide-react'

export default function ShelfScanWidget() {
  return (
    <Link
      href="/shelf-scan"
      className="glass-card p-4 flex items-center gap-3 hover:bg-white/[0.06] transition-colors duration-200 group"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/20 to-gold-light/20 flex items-center justify-center">
        <Camera className="w-5 h-5 text-gold" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">Scan Your Shelf</p>
        <p className="text-xs text-white/40 mt-0.5">
          Photo your collection for a full analysis and routine grade
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-gold transition-colors" />
    </Link>
  )
}
