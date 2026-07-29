import type { ScanResultData } from './ScanResults'

// ─── Shared types + helpers for the label scanner upload queue ─────────

export type ScanQueueStatus = 'ready' | 'scanning' | 'done' | 'error'

export interface ScanQueueItem {
  id: string
  dataUrl: string // compressed data URL, ready for upload
  fileName: string
  status: ScanQueueStatus
  result: ScanResultData | null
  error: string | null
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB per-file guard

let queueIdCounter = 0

/** Stable unique id for queue items (thumbnail keys, targeted state updates). */
export function makeQueueId(): string {
  queueIdCounter += 1
  return `scan-${Date.now()}-${queueIdCounter}`
}

/**
 * Compress an image data URL to JPEG at a target max dimension and quality.
 * Returns a compressed base64 data URL suitable for API upload.
 */
export function compressImage(dataUrl: string, maxDimension = 1500, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image for compression'))
    img.src = dataUrl
  })
}

/** Read a File as a base64 data URL (typed — no cast on FileReader result). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        resolve(result)
      } else {
        reject(new Error('Failed to read image file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}
