/**
 * Haptic Feedback System
 * Premium tactile feedback for mobile devices
 * Creates a luxury experience through subtle vibrations
 */

// Haptic patterns for different interactions
export const HapticPatterns = {
  // Navigation & Selection
  tap: [10], // Light tap
  select: [30], // Selection confirmation
  navigate: [20, 10], // Page navigation
  swipe: [15], // Swipe gesture

  // Success States
  success: [50, 100, 50], // Achievement feeling
  addToCart: [30, 60, 30], // Product added
  save: [40, 20, 40], // Item saved
  complete: [100, 50, 100, 50], // Task completed

  // Premium Interactions
  luxury: [20, 40, 20, 40, 60], // Premium feature access
  gold: [30, 10, 30, 10, 30, 10], // Gold tier interaction
  exclusive: [100, 30, 100, 30, 100], // Exclusive content

  // Notifications
  alert: [100, 100], // Important alert
  notification: [50], // General notification
  message: [30, 20, 30], // New message

  // Errors & Warnings
  error: [200], // Error state
  warning: [100, 50], // Warning state
  invalid: [50, 50, 50], // Invalid input

  // Special Effects
  shimmer: [10, 5, 10, 5, 10, 5, 10], // Shimmer effect
  pulse: [20, 10, 40, 10, 60, 10, 40, 10, 20], // Pulse effect
  wave: [10, 20, 30, 40, 30, 20, 10], // Wave effect

  // Loading & Progress
  loading: [30, 30, 30], // Loading state
  progress: [20], // Progress update

  // AI Interactions
  aiThinking: [10, 10, 10, 10, 10], // AI processing
  aiResponse: [30, 50, 30], // AI response ready

  // AR/Camera
  capture: [100], // Photo capture
  arLock: [50, 50], // AR tracking locked

  // Voice
  voiceStart: [30], // Voice recording start
  voiceEnd: [20, 20], // Voice recording end
} as const

// Haptic intensity levels
export enum HapticIntensity {
  LIGHT = 0.3,
  MEDIUM = 0.6,
  STRONG = 1.0,
  ADAPTIVE = -1 // Adapts based on user settings
}

// Device capability detection
class HapticCapabilities {
  private static instance: HapticCapabilities
  private hasVibrationAPI: boolean = false
  private hasHapticAPI: boolean = false
  private isIOSSafari: boolean = false
  private userPreference: boolean = true // Default enabled

  private constructor() {
    this.detectCapabilities()
  }

  static getInstance(): HapticCapabilities {
    if (!HapticCapabilities.instance) {
      HapticCapabilities.instance = new HapticCapabilities()
    }
    return HapticCapabilities.instance
  }

  private detectCapabilities() {
    if (typeof window === 'undefined') return

    // Check for Vibration API
    this.hasVibrationAPI = 'vibrate' in navigator

    // Check for iOS Haptic Feedback (Taptic Engine)
    this.isIOSSafari = /iPhone|iPad|iPod/.test(navigator.userAgent) &&
                      'ontouchstart' in window

    // Future: Check for Haptic API when standardized
    this.hasHapticAPI = 'haptics' in navigator

    // Check user preference from localStorage
    const stored = localStorage.getItem('haptic-feedback')
    if (stored !== null) {
      this.userPreference = stored === 'true'
    }
  }

  canVibrate(): boolean {
    return this.hasVibrationAPI && this.userPreference
  }

  isIOS(): boolean {
    return this.isIOSSafari
  }

  setUserPreference(enabled: boolean) {
    this.userPreference = enabled
    localStorage.setItem('haptic-feedback', enabled.toString())
  }
}

// Main Haptic Feedback Controller
export class HapticFeedback {
  private static instance: HapticFeedback
  private capabilities: HapticCapabilities
  private intensity: HapticIntensity = HapticIntensity.MEDIUM
  private queue: number[][] = []
  private isPlaying: boolean = false

  private constructor() {
    this.capabilities = HapticCapabilities.getInstance()
  }

  static getInstance(): HapticFeedback {
    if (!HapticFeedback.instance) {
      HapticFeedback.instance = new HapticFeedback()
    }
    return HapticFeedback.instance
  }

  /**
   * Play a haptic pattern
   */
  play(pattern: keyof typeof HapticPatterns | number[], intensity?: HapticIntensity) {
    if (!this.capabilities.canVibrate()) return

    const vibrationPattern = typeof pattern === 'string'
      ? HapticPatterns[pattern]
      : pattern

    const adjustedPattern = this.adjustPattern(vibrationPattern, intensity || this.intensity)

    try {
      navigator.vibrate(adjustedPattern)
    } catch (error) {
      console.debug('Haptic feedback not available:', error)
    }
  }

  /**
   * Play a sequence of patterns
   */
  async playSequence(patterns: (keyof typeof HapticPatterns)[], delay: number = 100) {
    for (const pattern of patterns) {
      this.play(pattern)
      await new Promise(resolve => setTimeout(resolve,
        HapticPatterns[pattern].reduce((a, b) => a + b, 0) + delay))
    }
  }

  /**
   * Adjust pattern intensity
   */
  private adjustPattern(pattern: number[], intensity: HapticIntensity): number[] {
    if (intensity === HapticIntensity.ADAPTIVE) {
      // Use device/user preference
      intensity = this.getAdaptiveIntensity()
    }

    return pattern.map(duration => Math.round(duration * intensity))
  }

  /**
   * Get adaptive intensity based on context
   */
  private getAdaptiveIntensity(): HapticIntensity {
    // Check time of day (lighter at night)
    const hour = new Date().getHours()
    const isNightTime = hour >= 22 || hour <= 6

    // Check battery level if available
    const battery = (navigator as any).battery || (navigator as any).getBattery
    const isLowBattery = battery?.level < 0.2

    if (isNightTime || isLowBattery) {
      return HapticIntensity.LIGHT
    }

    return HapticIntensity.MEDIUM
  }

  /**
   * Set global intensity
   */
  setIntensity(intensity: HapticIntensity) {
    this.intensity = intensity
  }

  /**
   * Enable/disable haptic feedback
   */
  setEnabled(enabled: boolean) {
    this.capabilities.setUserPreference(enabled)
  }

  /**
   * Check if haptics are available
   */
  isAvailable(): boolean {
    return this.capabilities.canVibrate()
  }

  /**
   * Premium interaction feedback
   */
  luxuryTap() {
    this.play('luxury', HapticIntensity.LIGHT)
  }

  /**
   * Gold interaction feedback
   */
  goldInteraction() {
    this.play('gold', HapticIntensity.MEDIUM)
  }

  /**
   * Success feedback
   */
  success() {
    this.play('success', HapticIntensity.MEDIUM)
  }

  /**
   * Error feedback
   */
  error() {
    this.play('error', HapticIntensity.STRONG)
  }

  /**
   * Selection feedback
   */
  select() {
    this.play('select', HapticIntensity.LIGHT)
  }

  /**
   * AI interaction feedback
   */
  aiInteraction(state: 'thinking' | 'response') {
    if (state === 'thinking') {
      this.play('aiThinking', HapticIntensity.LIGHT)
    } else {
      this.play('aiResponse', HapticIntensity.MEDIUM)
    }
  }
}

// React Hook for Haptic Feedback
export function useHaptic() {
  const haptic = HapticFeedback.getInstance()

  return {
    play: (pattern: keyof typeof HapticPatterns | number[], intensity?: HapticIntensity) =>
      haptic.play(pattern, intensity),
    playSequence: (patterns: (keyof typeof HapticPatterns)[], delay?: number) =>
      haptic.playSequence(patterns, delay),
    luxuryTap: () => haptic.luxuryTap(),
    goldInteraction: () => haptic.goldInteraction(),
    success: () => haptic.success(),
    error: () => haptic.error(),
    select: () => haptic.select(),
    aiInteraction: (state: 'thinking' | 'response') => haptic.aiInteraction(state),
    setIntensity: (intensity: HapticIntensity) => haptic.setIntensity(intensity),
    setEnabled: (enabled: boolean) => haptic.setEnabled(enabled),
    isAvailable: () => haptic.isAvailable(),
  }
}

// Singleton instance export
const hapticFeedback = HapticFeedback.getInstance()
export default hapticFeedback