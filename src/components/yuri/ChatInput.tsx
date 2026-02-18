'use client'

import { useState, useRef, useCallback } from 'react'
import { Send, Loader2, ImagePlus, X } from 'lucide-react'
import { compressImageToDataUrl } from '@/lib/utils/image-compress'

interface ChatInputProps {
  onSend: (message: string, imageUrls?: string[]) => void
  disabled?: boolean
  placeholder?: string
}

const MAX_IMAGES = 4

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask Yuri anything about K-beauty...',
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [isCompressing, setIsCompressing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canSend = (value.trim() || pendingImages.length > 0) && !disabled && !isCompressing

  const handleSubmit = useCallback(() => {
    if (!canSend) return

    const trimmed = value.trim()
    const message = trimmed || (pendingImages.length > 0 ? 'Analyze this image' : '')
    if (!message) return

    onSend(message, pendingImages.length > 0 ? pendingImages : undefined)
    setValue('')
    setPendingImages([])

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, pendingImages, canSend, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsCompressing(true)
    try {
      const newImages: string[] = []
      const remaining = MAX_IMAGES - pendingImages.length

      for (let i = 0; i < Math.min(files.length, remaining); i++) {
        const file = files[i]
        if (!file.type.startsWith('image/')) continue
        const dataUrl = await compressImageToDataUrl(file)
        newImages.push(dataUrl)
      }

      setPendingImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES))
    } catch (err) {
      console.error('Image compression failed:', err)
    } finally {
      setIsCompressing(false)
      // Reset file input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [pendingImages.length])

  const removeImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <div className="bg-seoul-card/90 backdrop-blur-md border-t border-white/10">
      {/* Image preview strip */}
      {pendingImages.length > 0 && (
        <div className="flex gap-2 px-3 pt-3 pb-1 overflow-x-auto scrollbar-hide">
          {pendingImages.map((dataUrl, index) => (
            <div key={index} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUrl}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                aria-label={`Remove image ${index + 1}`}
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          {isCompressing && (
            <div className="flex-shrink-0 w-16 h-16 rounded-lg border border-white/10 flex items-center justify-center bg-white/5">
              <Loader2 className="w-4 h-4 text-gold animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 p-3">
        {/* Image upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || pendingImages.length >= MAX_IMAGES || isCompressing}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-all duration-200 hover:bg-gold/10 hover:border-gold/30 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Attach image"
        >
          <ImagePlus className="w-4.5 h-4.5 text-white/50" strokeWidth={1.75} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={pendingImages.length > 0 ? 'Add a message (optional)...' : placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none dark-input text-sm py-2.5 px-4 max-h-[120px] rounded-2xl"
          aria-label="Message Yuri"
        />

        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-gold to-gold-light text-seoul-dark flex items-center justify-center transition-all duration-200 hover:shadow-glow-gold disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          {disabled ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  )
}
