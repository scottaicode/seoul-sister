'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Volume2, Sparkles, Search, ShoppingBag, Heart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Voice command patterns with multiple language support
const voiceCommands = {
  en: {
    search: ['find', 'search', 'show me', 'look for', 'find me'],
    filter: ['filter', 'only show', 'just', 'under', 'below'],
    recommend: ['recommend', 'suggest', 'what should', 'help me'],
    save: ['save', 'bookmark', 'add to wishlist', 'favorite'],
    buy: ['buy', 'purchase', 'order', 'get', 'add to cart'],
    help: ['help', 'what can you', 'how do I'],
    price: ['price', 'cost', 'how much', 'cheapest', 'best deal']
  },
  ko: {
    search: ['찾아', '검색', '보여줘'],
    filter: ['필터', '만 보여줘'],
    recommend: ['추천', '제안', '도와줘'],
    save: ['저장', '북마크', '찜'],
    buy: ['구매', '주문', '카트에'],
    help: ['도움', '어떻게'],
    price: ['가격', '얼마', '저렴한']
  },
  es: {
    search: ['buscar', 'encontrar', 'muéstrame'],
    filter: ['filtrar', 'solo mostrar'],
    recommend: ['recomendar', 'sugerir', 'ayúdame'],
    save: ['guardar', 'favorito'],
    buy: ['comprar', 'ordenar', 'añadir'],
    help: ['ayuda', 'cómo'],
    price: ['precio', 'cuánto', 'mejor oferta']
  }
}

// Accessibility phrases in multiple languages
const accessibilityPhrases = {
  en: {
    greeting: "Hi, I'm Seoul Sister. How can I help you today?",
    listening: "I'm listening...",
    processing: "Let me find that for you...",
    error: "I didn't catch that. Could you try again?",
    ready: "Voice control ready. Say 'Hey Seoul Sister' to start."
  },
  ko: {
    greeting: "안녕하세요, 서울 시스터입니다. 무엇을 도와드릴까요?",
    listening: "듣고 있습니다...",
    processing: "찾아보겠습니다...",
    error: "다시 한 번 말씀해 주세요.",
    ready: "음성 제어 준비됨. '헤이 서울 시스터'라고 말하세요."
  },
  es: {
    greeting: "Hola, soy Seoul Sister. ¿Cómo puedo ayudarte?",
    listening: "Te escucho...",
    processing: "Déjame buscar eso...",
    error: "No entendí. ¿Puedes intentar de nuevo?",
    ready: "Control de voz listo. Di 'Hola Seoul Sister' para empezar."
  }
}

interface VoiceControlProps {
  onCommand?: (command: string, params: any) => void
  language?: 'en' | 'ko' | 'es'
  alwaysOn?: boolean
}

export default function VoiceControl({
  onCommand,
  language = 'en',
  alwaysOn = false
}: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)

  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Check for browser support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition ||
                                (window as any).webkitSpeechRecognition

      if (SpeechRecognition && window.speechSynthesis) {
        setIsSupported(true)

        // Initialize speech recognition
        const recognition = new SpeechRecognition()
        recognition.continuous = alwaysOn
        recognition.interimResults = true
        recognition.lang = language === 'ko' ? 'ko-KR' : language === 'es' ? 'es-ES' : 'en-US'

        recognition.onresult = handleSpeechResult
        recognition.onerror = handleSpeechError
        recognition.onend = handleSpeechEnd

        recognitionRef.current = recognition

        // Initialize speech synthesis
        synthRef.current = new SpeechSynthesisUtterance()
        synthRef.current.lang = recognition.lang
        synthRef.current.rate = 0.9
        synthRef.current.pitch = 1.1
        synthRef.current.volume = 0.8
      }
    }
  }, [language, alwaysOn])

  // Wake word detection for always-on mode
  useEffect(() => {
    if (alwaysOn && isSupported && voiceEnabled && !isListening) {
      startListening()
    }
  }, [alwaysOn, isSupported, voiceEnabled, isListening])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return

    try {
      recognitionRef.current.start()
      setIsListening(true)
      setFeedback(accessibilityPhrases[language].listening)

      // Visual feedback
      if (window.navigator.vibrate) {
        window.navigator.vibrate(200) // Haptic feedback
      }
    } catch (error) {
      console.error('Speech recognition error:', error)
      setFeedback(accessibilityPhrases[language].error)
    }
  }, [language, isListening])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return

    try {
      recognitionRef.current.stop()
      setIsListening(false)
    } catch (error) {
      console.error('Error stopping recognition:', error)
    }
  }, [isListening])

  const handleSpeechResult = useCallback((event: any) => {
    const current = event.resultIndex
    const transcript = event.results[current][0].transcript.toLowerCase()

    setTranscript(transcript)

    if (event.results[current].isFinal) {
      processVoiceCommand(transcript)
    }
  }, [])

  const handleSpeechError = useCallback((event: any) => {
    console.error('Speech recognition error:', event.error)
    setIsListening(false)
    setFeedback(accessibilityPhrases[language].error)
  }, [language])

  const handleSpeechEnd = useCallback(() => {
    if (alwaysOn && voiceEnabled) {
      // Restart listening for always-on mode
      setTimeout(() => startListening(), 1000)
    } else {
      setIsListening(false)
    }
  }, [alwaysOn, voiceEnabled])

  const processVoiceCommand = useCallback(async (text: string) => {
    setIsProcessing(true)
    setFeedback(accessibilityPhrases[language].processing)

    // Check for wake word
    const wakeWords = ['hey seoul sister', 'seoul sister', '서울 시스터', 'hola seoul sister']
    const hasWakeWord = wakeWords.some(word => text.includes(word))

    if (alwaysOn && !hasWakeWord && !isListening) {
      setIsProcessing(false)
      return
    }

    // Parse command
    const commands = voiceCommands[language]
    let commandType = null
    let parameters = {}

    // Search commands
    if (commands.search.some(cmd => text.includes(cmd))) {
      commandType = 'search'
      const searchTerm = text.split(commands.search.find(cmd => text.includes(cmd))!)[1]?.trim()
      parameters = { query: searchTerm }
      speak(`Searching for ${searchTerm}`)
    }

    // Price commands
    else if (commands.price.some(cmd => text.includes(cmd))) {
      commandType = 'price'
      const product = text.match(/(?:for|of)\s+(.+)/)?.[1]
      parameters = { product }
      speak(`Finding the best price for ${product}`)
    }

    // Recommend commands
    else if (commands.recommend.some(cmd => text.includes(cmd))) {
      commandType = 'recommend'
      const category = text.match(/(?:for|with)\s+(.+)/)?.[1]
      parameters = { category }
      speak(`I'll find the perfect products for you`)
    }

    // Filter commands
    else if (commands.filter.some(cmd => text.includes(cmd))) {
      commandType = 'filter'
      const filter = text.match(/(?:under|below|above)\s+\$?(\d+)/)?.[1]
      parameters = { priceLimit: filter }
      speak(`Filtering products under ${filter} dollars`)
    }

    // Save/wishlist commands
    else if (commands.save.some(cmd => text.includes(cmd))) {
      commandType = 'save'
      speak(`Added to your wishlist`)
    }

    // Help commands
    else if (commands.help.some(cmd => text.includes(cmd))) {
      commandType = 'help'
      speak(getHelpMessage())
    }

    // Execute command callback
    if (commandType && onCommand) {
      onCommand(commandType, parameters)
    }

    setIsProcessing(false)

    // Haptic feedback for command completion
    if (window.navigator.vibrate) {
      window.navigator.vibrate([100, 50, 100])
    }
  }, [language, alwaysOn, isListening, onCommand])

  const speak = useCallback((text: string) => {
    if (!synthRef.current || !window.speechSynthesis) return

    synthRef.current.text = text
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(synthRef.current)
  }, [])

  const getHelpMessage = () => {
    const messages = {
      en: "You can ask me to find products, check prices, get recommendations, or save items to your wishlist. Just say what you need!",
      ko: "제품 찾기, 가격 확인, 추천 받기, 위시리스트 저장 등을 요청하실 수 있습니다.",
      es: "Puedes pedirme que busque productos, verifique precios, obtenga recomendaciones o guarde artículos."
    }
    return messages[language]
  }

  const toggleVoiceControl = () => {
    if (!voiceEnabled) {
      setVoiceEnabled(true)
      speak(accessibilityPhrases[language].greeting)
      if (!alwaysOn) {
        startListening()
      }
    } else {
      setVoiceEnabled(false)
      stopListening()
    }
  }

  if (!isSupported) {
    return null // Gracefully degrade if not supported
  }

  return (
    <>
      {/* Floating Voice Button */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="voice-control-container"
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleVoiceControl}
          className={`voice-button ${voiceEnabled ? 'active' : ''} ${isListening ? 'listening' : ''}`}
          aria-label={voiceEnabled ? 'Disable voice control' : 'Enable voice control'}
        >
          {isListening ? (
            <Mic className="w-6 h-6" />
          ) : voiceEnabled ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}

          {/* Pulse animation when listening */}
          {isListening && (
            <div className="pulse-ring" />
          )}
        </motion.button>

        {/* Voice Feedback Tooltip */}
        <AnimatePresence>
          {(feedback || transcript) && voiceEnabled && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="voice-feedback"
            >
              {isProcessing && (
                <div className="processing-indicator">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
              )}
              <p className="feedback-text">
                {feedback || transcript}
              </p>
              {isListening && (
                <div className="sound-waves">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice Commands Help */}
        {voiceEnabled && !isListening && !feedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="voice-help"
          >
            <p className="text-xs text-gold/60">
              Say "Hey Seoul Sister" or tap to start
            </p>
          </motion.div>
        )}
      </motion.div>

      <style jsx>{`
        .voice-control-container {
          position: fixed;
          bottom: 80px;
          right: 20px;
          z-index: 1000;
        }

        .voice-button {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #D4AF37, #F7E7CE);
          border: 2px solid #D4AF37;
          color: #0A0A0A;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(212, 175, 55, 0.3);
        }

        .voice-button:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 30px rgba(212, 175, 55, 0.4);
        }

        .voice-button.active {
          background: #0A0A0A;
          color: #D4AF37;
        }

        .voice-button.listening {
          animation: glow 1.5s ease-in-out infinite;
        }

        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(212, 175, 55, 0.5); }
          50% { box-shadow: 0 0 40px rgba(212, 175, 55, 0.8); }
        }

        .pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid #D4AF37;
          animation: pulse-expand 1.5s ease-out infinite;
        }

        @keyframes pulse-expand {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }

        .voice-feedback {
          position: absolute;
          bottom: 70px;
          right: 0;
          background: #1E1E1E;
          border: 1px solid #D4AF37;
          border-radius: 8px;
          padding: 12px 16px;
          min-width: 200px;
          max-width: 300px;
        }

        .feedback-text {
          color: #FAFAFA;
          font-size: 14px;
          margin: 0;
        }

        .processing-indicator {
          color: #D4AF37;
          margin-bottom: 8px;
        }

        .sound-waves {
          display: flex;
          gap: 4px;
          margin-top: 8px;
        }

        .sound-waves span {
          width: 3px;
          height: 20px;
          background: #D4AF37;
          border-radius: 3px;
          animation: wave 0.6s ease-in-out infinite;
        }

        .sound-waves span:nth-child(2) {
          animation-delay: 0.2s;
          height: 25px;
        }

        .sound-waves span:nth-child(3) {
          animation-delay: 0.4s;
          height: 15px;
        }

        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }

        .voice-help {
          position: absolute;
          bottom: -30px;
          right: 0;
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .voice-control-container {
            bottom: 70px;
            right: 15px;
          }

          .voice-button {
            width: 50px;
            height: 50px;
          }
        }
      `}</style>
    </>
  )
}