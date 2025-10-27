'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, X, RotateCcw, Check } from 'lucide-react'

interface PhotoUploadProps {
  onPhotoCapture: (file: File, metadata?: PhotoMetadata) => void
  onAnalysisComplete?: (analysis: SkinAnalysis) => void
  maxFileSize?: number // in MB
  acceptedFormats?: string[]
  isAnalyzing?: boolean
}

interface PhotoMetadata {
  captureMethod: 'camera' | 'upload'
  timestamp: string
  lighting?: 'natural' | 'indoor' | 'outdoor' | 'artificial'
  skinArea?: 'face' | 'specific_concern'
  notes?: string
}

interface SkinAnalysis {
  skinType: string
  concerns: string[]
  recommendations: string[]
  compatibleIngredients: string[]
  ingredientsToAvoid: string[]
  confidenceScore: number
}

export default function PhotoUpload({
  onPhotoCapture,
  onAnalysisComplete,
  maxFileSize = 10,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/webp'],
  isAnalyzing = false
}: PhotoUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<Partial<PhotoMetadata>>({
    lighting: 'natural',
    skinArea: 'face'
  })
  const [step, setStep] = useState<'upload' | 'review' | 'metadata'>('upload')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((file: File) => {
    if (!acceptedFormats.includes(file.type)) {
      alert(`Please select a valid image format: ${acceptedFormats.join(', ')}`)
      return
    }

    if (file.size > maxFileSize * 1024 * 1024) {
      alert(`File size must be less than ${maxFileSize}MB`)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
      setCurrentFile(file)
      setStep('review')
    }
    reader.readAsDataURL(file)
  }, [acceptedFormats, maxFileSize])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [handleFileSelect])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const captureMethod = e.target === cameraInputRef.current ? 'camera' : 'upload'
      setMetadata(prev => ({ ...prev, captureMethod }))
      handleFileSelect(e.target.files[0])
    }
  }

  const handleConfirm = () => {
    if (currentFile) {
      const fullMetadata: PhotoMetadata = {
        captureMethod: metadata.captureMethod || 'upload',
        timestamp: new Date().toISOString(),
        lighting: metadata.lighting || 'natural',
        skinArea: metadata.skinArea || 'face',
        notes: metadata.notes
      }

      onPhotoCapture(currentFile, fullMetadata)
      setStep('metadata')
    }
  }

  const handleRetake = () => {
    setPreview(null)
    setCurrentFile(null)
    setStep('upload')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2 tracking-wide">
          📦 Upload Product Photo
        </h3>
        <p className="text-gray-300 font-light">
          Take or upload a clear photo of your skincare product for AI analysis
        </p>
      </div>

      {/* Drag and Drop Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          dragActive
            ? 'border-[#d4a574] bg-[#d4a574]/10'
            : 'border-[#d4a574]/30 hover:border-[#d4a574]/60'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <div className="text-4xl mb-4">📦</div>
          <div>
            <p className="text-lg font-medium text-white mb-2">
              Drag and drop your product photo here
            </p>
            <p className="text-gray-400 text-sm font-light">
              or use the buttons below
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[#d4a574] hover:bg-[#d4a574]/90 text-black rounded-lg font-medium transition-all"
            >
              <Camera size={20} />
              Take Product Photo
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800/50 hover:bg-gray-800/70 text-gray-300 border border-[#d4a574]/30 rounded-lg font-medium transition-all"
            >
              <Upload size={20} />
              Upload File
            </button>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats.join(',')}
            onChange={handleFileInput}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      </div>

      {/* Upload Guidelines */}
      <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
        <h4 className="font-medium text-blue-300 mb-2 tracking-wide">📋 Product Photo Guidelines</h4>
        <ul className="text-blue-200 text-sm space-y-1 font-light">
          <li>• Product should be well-lit and clearly visible</li>
          <li>• Include the ingredient list if possible</li>
          <li>• Show the product name and brand clearly</li>
          <li>• Use natural lighting when possible</li>
          <li>• Avoid shadows covering important text</li>
        </ul>
      </div>
    </div>
  )

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2 tracking-wide">
          📝 Review Product Photo
        </h3>
        <p className="text-gray-300 font-light">
          Make sure your product photo is clear and text is readable
        </p>
      </div>

      {/* Photo Preview */}
      <div className="relative">
        <div className="aspect-square max-w-md mx-auto rounded-xl overflow-hidden border border-[#d4a574]/30">
          {preview && (
            <img
              src={preview}
              alt="Photo preview"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <button
          onClick={handleRetake}
          className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Metadata Inputs */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Lighting Conditions
          </label>
          <select
            value={metadata.lighting}
            onChange={(e) => setMetadata(prev => ({ ...prev, lighting: e.target.value as any }))}
            className="w-full p-3 bg-gray-800/30 border border-[#d4a574]/30 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] text-white"
          >
            <option value="natural">Natural daylight</option>
            <option value="indoor">Indoor lighting</option>
            <option value="outdoor">Outdoor shade</option>
            <option value="artificial">Artificial lighting</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Product Type
          </label>
          <select
            value={metadata.skinArea}
            onChange={(e) => setMetadata(prev => ({ ...prev, skinArea: e.target.value as any }))}
            className="w-full p-3 bg-gray-800/30 border border-[#d4a574]/30 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] text-white"
          >
            <option value="cleanser">Cleanser</option>
            <option value="toner">Toner/Essence</option>
            <option value="serum">Serum/Treatment</option>
            <option value="moisturizer">Moisturizer</option>
            <option value="sunscreen">Sunscreen</option>
            <option value="mask">Mask</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Additional Notes (Optional)
          </label>
          <textarea
            value={metadata.notes || ''}
            onChange={(e) => setMetadata(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Any specific concerns or areas to focus on..."
            className="w-full p-3 bg-gray-800/30 border border-[#d4a574]/30 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] text-white placeholder-gray-400"
            rows={3}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleRetake}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800/50 hover:bg-gray-800/70 text-gray-300 border border-[#d4a574]/30 rounded-lg font-medium transition-all"
        >
          <RotateCcw size={20} />
          Retake
        </button>

        <button
          onClick={handleConfirm}
          disabled={!currentFile}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#d4a574] hover:bg-[#d4a574]/90 text-black rounded-lg font-medium transition-all disabled:opacity-50"
        >
          <Check size={20} />
          Analyze Photo
        </button>
      </div>
    </div>
  )

  const renderAnalyzingStep = () => (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-[#d4a574]/20 border border-[#d4a574]/30 rounded-full mb-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4a574]"></div>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2 tracking-wide">
        🔬 Analyzing Your Skin
      </h3>
      <p className="text-gray-300 font-light mb-4">
        Our AI is examining your photo to provide personalized recommendations
      </p>
      <div className="text-sm text-gray-400">
        This may take 10-30 seconds...
      </div>
    </div>
  )

  if (isAnalyzing) {
    return (
      <div className="bg-gray-800/20 rounded-xl p-6 border border-[#d4a574]/20 backdrop-blur-sm">
        {renderAnalyzingStep()}
      </div>
    )
  }

  return (
    <div className="bg-gray-800/20 rounded-xl p-6 border border-[#d4a574]/20 backdrop-blur-sm">
      {step === 'upload' && renderUploadStep()}
      {step === 'review' && renderReviewStep()}
    </div>
  )
}