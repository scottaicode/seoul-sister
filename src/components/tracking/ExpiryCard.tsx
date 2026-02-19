'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Clock,
  Package,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { UserProductTracking } from '@/types/database'

interface ExpiryCardProps {
  item: UserProductTracking
  onStatusChange: (id: string, status: 'finished' | 'discarded') => void
  onDelete: (id: string) => void
}

function getDaysRemaining(expiryDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getProgressPercent(openedDate: string, expiryDate: string): number {
  const opened = new Date(openedDate).getTime()
  const expiry = new Date(expiryDate).getTime()
  const now = Date.now()
  const total = expiry - opened
  if (total <= 0) return 100
  const elapsed = now - opened
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
}

function getStatusColor(daysRemaining: number): {
  bg: string
  bar: string
  text: string
  badge: string
} {
  if (daysRemaining <= 0)
    return { bg: 'bg-red-500/10', bar: 'bg-red-500', text: 'text-red-400', badge: 'Expired' }
  if (daysRemaining <= 14)
    return { bg: 'bg-red-500/10', bar: 'bg-red-500', text: 'text-red-400', badge: 'Expiring Soon' }
  if (daysRemaining <= 30)
    return { bg: 'bg-amber-500/10', bar: 'bg-amber-500', text: 'text-amber-400', badge: 'Expiring Soon' }
  return { bg: 'bg-green-500/10', bar: 'bg-green-500', text: 'text-green-400', badge: 'Active' }
}

export default function ExpiryCard({ item, onStatusChange, onDelete }: ExpiryCardProps) {
  const [expanded, setExpanded] = useState(false)

  const name = item.product?.name_en || item.custom_product_name || 'Unknown Product'
  const brand = item.product?.brand_en || null
  const category = item.product?.category || null

  const hasExpiry = !!item.expiry_date
  const daysRemaining = hasExpiry ? getDaysRemaining(item.expiry_date!) : null
  const progress = hasExpiry ? getProgressPercent(item.opened_date, item.expiry_date!) : 0
  const colors = daysRemaining !== null ? getStatusColor(daysRemaining) : getStatusColor(999)

  const isInactive = item.status === 'finished' || item.status === 'discarded'

  return (
    <div className={`glass-card p-4 ${isInactive ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
          {item.product?.image_url ? (
            <img
              src={item.product.image_url}
              alt={name}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <Package className={`w-4 h-4 ${colors.text}`} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {item.product_id ? (
              <Link
                href={`/products/${item.product_id}`}
                className="text-sm font-medium text-white hover:text-gold-light transition-colors truncate"
              >
                {name}
              </Link>
            ) : (
              <span className="text-sm font-medium text-white truncate">{name}</span>
            )}
          </div>

          {(brand || category) && (
            <p className="text-[10px] text-white/40 mt-0.5">
              {brand}{brand && category ? ' · ' : ''}{category}
            </p>
          )}

          {/* Status badges */}
          <div className="flex items-center gap-2 mt-1.5">
            {isInactive ? (
              <span className="text-[10px] font-medium text-white/30 bg-white/5 px-2 py-0.5 rounded-full capitalize">
                {item.status}
              </span>
            ) : hasExpiry && daysRemaining !== null ? (
              <>
                <span className={`text-[10px] font-medium ${colors.text} ${colors.bg} px-2 py-0.5 rounded-full`}>
                  {daysRemaining <= 0
                    ? 'Expired'
                    : daysRemaining === 1
                      ? '1 day left'
                      : `${daysRemaining} days left`}
                </span>
                {item.pao_months && (
                  <span className="text-[10px] text-white/30">
                    PAO {item.pao_months}M
                  </span>
                )}
              </>
            ) : (
              <span className="text-[10px] text-white/30">No expiry set</span>
            )}
          </div>

          {/* Progress bar */}
          {hasExpiry && !isInactive && (
            <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-white/20 hover:text-white/50 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-white/30">Opened</span>
              <p className="text-white/70">{new Date(item.opened_date).toLocaleDateString()}</p>
            </div>
            {item.expiry_date && (
              <div>
                <span className="text-white/30">Expires</span>
                <p className="text-white/70">{new Date(item.expiry_date).toLocaleDateString()}</p>
              </div>
            )}
            {item.purchase_date && (
              <div>
                <span className="text-white/30">Purchased</span>
                <p className="text-white/70">{new Date(item.purchase_date).toLocaleDateString()}</p>
              </div>
            )}
            {item.batch_code && (
              <div>
                <span className="text-white/30">Batch Code</span>
                <p className="text-white/70">{item.batch_code}</p>
              </div>
            )}
          </div>

          {item.notes && (
            <p className="text-[11px] text-white/50">{item.notes}</p>
          )}

          {/* Actions */}
          {!isInactive && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => onStatusChange(item.id, 'finished')}
                className="flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-500/10 px-2.5 py-1.5 rounded-lg hover:bg-green-500/20 transition-colors"
              >
                <CheckCircle2 className="w-3 h-3" /> Finished
              </button>
              <button
                onClick={() => onStatusChange(item.id, 'discarded')}
                className="flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors"
              >
                <XCircle className="w-3 h-3" /> Discarded
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-500/10 px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors ml-auto"
              >
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
