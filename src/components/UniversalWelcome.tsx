'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Globe, Heart, Shield, TrendingUp, Users } from 'lucide-react'

const welcomeMessages = [
  {
    primary: "Your Personal Beauty Intelligence Concierge",
    secondary: "Save like an insider. Shop like an expert.",
    icon: Sparkles
  },
  {
    primary: "Welcome to Brilliant Savings",
    secondary: "Where smart meets beautiful—at any age, any stage, any style.",
    icon: Heart
  },
  {
    primary: "Beauty Without Borders",
    secondary: "Curated intelligence from Seoul to your doorstep.",
    icon: Globe
  },
  {
    primary: "Your Trusted Beauty Advisor",
    secondary: "Verified authenticity. Unbeatable prices. Personalized for you.",
    icon: Shield
  },
  {
    primary: "Join 50,000+ Smart Shoppers",
    secondary: "Average member saves $127 monthly on authentic K-beauty.",
    icon: TrendingUp
  },
  {
    primary: "Beauty Democracy Starts Here",
    secondary: "Luxury intelligence accessible to everyone.",
    icon: Users
  }
]

interface UniversalWelcomeProps {
  userName?: string
  isReturning?: boolean
  onGetStarted?: () => void
}

export default function UniversalWelcome({
  userName,
  isReturning = false,
  onGetStarted
}: UniversalWelcomeProps) {
  const [currentMessage, setCurrentMessage] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Rotate messages for first-time visitors
    if (!isReturning) {
      const interval = setInterval(() => {
        setCurrentMessage((prev) => (prev + 1) % welcomeMessages.length)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [isReturning])

  const message = isReturning
    ? {
        primary: userName ? `Welcome back, ${userName}` : "Welcome back to brilliance",
        secondary: "Your personalized beauty intelligence is ready.",
        icon: Sparkles
      }
    : welcomeMessages[currentMessage]

  const Icon = message.icon

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentMessage}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="universal-welcome"
      >
        <div className="welcome-container">
          {/* Luxury Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="luxury-pattern" />
          </div>

          {/* Main Content */}
          <div className="relative z-10 text-center px-6 py-12 max-w-4xl mx-auto">
            {/* Icon with Gold Glow */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mb-6 inline-block"
            >
              <div className="icon-wrapper">
                <Icon className="w-12 h-12 text-gold" />
                <div className="icon-glow" />
              </div>
            </motion.div>

            {/* Primary Message */}
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-5xl font-thin tracking-wide mb-4 text-white"
            >
              {message.primary}
            </motion.h1>

            {/* Secondary Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-lg md:text-xl text-gold/80 font-light mb-8"
            >
              {message.secondary}
            </motion.p>

            {/* CTA Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <button
                onClick={onGetStarted}
                className="luxury-button-primary"
              >
                <span>Start Your Intelligence Journey</span>
                <span className="ml-2">→</span>
              </button>

              <button className="luxury-button-secondary">
                <span>Browse as Guest</span>
              </button>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-gray-400"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gold/60" />
                <span>Verified Authentic</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gold/60" />
                <span>Ships Worldwide</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-gold/60" />
                <span>50K+ Members</span>
              </div>
            </motion.div>

            {/* Subtle Animation Elements */}
            <div className="floating-elements">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="floating-dot"
                  animate={{
                    y: [0, -20, 0],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 3,
                    delay: i * 0.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  style={{
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #D4AF37, #F7E7CE)',
                    left: `${20 + i * 30}%`,
                    top: `${30 + i * 10}%`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <style jsx>{`
          .universal-welcome {
            background: linear-gradient(180deg, #0A0A0A 0%, #1E1E1E 100%);
            min-height: 500px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
          }

          .welcome-container {
            width: 100%;
            position: relative;
          }

          .luxury-pattern {
            background-image:
              repeating-linear-gradient(
                45deg,
                #D4AF37,
                #D4AF37 1px,
                transparent 1px,
                transparent 15px
              ),
              repeating-linear-gradient(
                -45deg,
                #D4AF37,
                #D4AF37 1px,
                transparent 1px,
                transparent 15px
              );
            width: 100%;
            height: 100%;
          }

          .icon-wrapper {
            position: relative;
            padding: 20px;
            border-radius: 50%;
            background: linear-gradient(135deg, #0A0A0A, #1E1E1E);
            border: 1px solid #D4AF37;
          }

          .icon-glow {
            position: absolute;
            inset: -20px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, transparent 70%);
            animation: pulse 3s ease-in-out infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.1); }
          }

          .text-gold {
            color: #D4AF37;
          }

          .luxury-button-primary {
            background: linear-gradient(135deg, #D4AF37 0%, #F7E7CE 100%);
            color: #0A0A0A;
            font-weight: 500;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            padding: 16px 32px;
            transition: all 300ms ease;
            border: 1px solid #D4AF37;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            font-size: 14px;
          }

          .luxury-button-primary:hover {
            box-shadow: 0 8px 32px rgba(212, 175, 55, 0.3);
            transform: translateY(-2px);
          }

          .luxury-button-secondary {
            background: transparent;
            color: #D4AF37;
            font-weight: 400;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            padding: 16px 32px;
            transition: all 300ms ease;
            border: 1px solid #D4AF37;
            cursor: pointer;
            font-size: 14px;
          }

          .luxury-button-secondary:hover {
            background: rgba(212, 175, 55, 0.1);
            box-shadow: 0 4px 16px rgba(212, 175, 55, 0.2);
          }

          .floating-elements {
            pointer-events: none;
            position: absolute;
            inset: 0;
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  )
}