/**
 * Client-side image compression and base64 conversion for Yuri chat.
 * Resizes images to max 1600px (longest side) and converts to JPEG base64 data URL.
 */

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.8
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB after compression

export async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // Resize if larger than max dimension
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)

      // Check compressed size (base64 portion only)
      const base64Length = dataUrl.length - 'data:image/jpeg;base64,'.length
      const byteSize = (base64Length * 3) / 4

      if (byteSize > MAX_FILE_SIZE) {
        reject(new Error('Image too large even after compression. Please use a smaller image.'))
        return
      }

      resolve(dataUrl)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}
