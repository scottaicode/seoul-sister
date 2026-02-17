'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Camera, Layers, ShieldCheck, Search, Sparkles, Users,
  ScanLine, Brain, ListOrdered, Check, Star, ArrowRight
} from 'lucide-react'
import PricingCards from '@/components/pricing/PricingCards'
import TryYuriSection from '@/components/widget/TryYuriSection'
import YuriBubble from '@/components/widget/YuriBubble'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

const features = [
  { icon: Camera, title: 'Korean Label Decoder', desc: 'Point your camera at any Korean label for instant ingredient translation and safety scoring.', badge: 'badge-pink' },
  { icon: Sparkles, title: 'AI Beauty Advisor', desc: 'Yuri — your personal AI beauty advisor backed by 6 specialist agents and your full skin profile.', badge: 'badge-blue' },
  { icon: Users, title: 'Community Reviews', desc: 'Reviews filtered by skin type, Fitzpatrick scale, age, and concern — not just star ratings.', badge: 'badge-pink' },
  { icon: ShieldCheck, title: 'Counterfeit Detection', desc: 'Spot fakes before you buy with AI-powered packaging analysis and crowdsourced signals.', badge: 'badge-blue' },
  { icon: Search, title: 'Price Comparison', desc: 'Compare prices across Korea and US retailers — know exactly what you should be paying.', badge: 'badge-pink' },
  { icon: Layers, title: 'Trend Discovery', desc: 'What\'s trending in Seoul right now? From PDRN serums to centella — stay ahead.', badge: 'badge-blue' },
]

const steps = [
  { icon: ScanLine, step: '01', title: 'Scan or Search', desc: 'Camera scan a Korean label or search 10,000+ products.' },
  { icon: Brain, step: '02', title: 'Get AI Intelligence', desc: 'Yuri and her specialist agents decode ingredients, flag conflicts, and check authenticity.' },
  { icon: ListOrdered, step: '03', title: 'Build Your Routine', desc: 'Add to your personalized routine with layering order, timing, and skin cycling schedule.' },
]

const stats = [
  { value: '10,000+', label: 'Products Tracked' },
  { value: '30+', label: 'K-Beauty Brands' },
  { value: '6', label: 'AI Specialists' },
  { value: '55+', label: 'Ingredients Decoded' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-seoul-cream font-sans">

      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-white/50 shadow-glass">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-display font-bold text-xl text-seoul-charcoal tracking-tight">
            Seoul Sister
          </span>
          <div className="hidden md:flex items-center gap-6">
            {[
              { label: 'Features', href: '#features' },
              { label: 'Try Yuri', href: '#try-yuri' },
              { label: 'Pricing', href: '#pricing' },
            ].map((link) => (
              <Link key={link.label} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
          </div>
          <Link href="/register" className="glass-button-primary text-sm py-2 px-5">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-hero-gradient pt-20 pb-24 px-4 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.div variants={fadeUp}>
              <span className="badge-pink mb-4 inline-block">World&apos;s First English K-Beauty Intelligence Platform</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="font-display font-bold text-4xl md:text-6xl text-seoul-charcoal leading-tight mb-6">
              K-Beauty Intelligence,
              <br />
              <span className="text-gradient">Powered by AI</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-seoul-soft text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              Your AI-powered guide to Korean skincare — personalized routines, real ingredients, verified products.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="glass-button-primary text-base py-3 px-8">
                Start Free
              </Link>
              <Link href="#features" className="glass-button text-base py-3 px-8 text-seoul-charcoal">
                See How It Works
              </Link>
            </motion.div>
          </motion.div>

          {/* Glass product scan preview */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-16 mx-auto max-w-sm animate-float"
          >
            <div className="glass-card p-6 text-left shadow-glass-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-gold to-glass-500 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-seoul-charcoal">Scanning label...</p>
                  <p className="text-xs text-seoul-soft">COSRX Advanced Snail 96</p>
                </div>
                <span className="ml-auto badge-blue animate-pulse-soft">Live</span>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Snail Secretion Filtrate', score: 96, color: 'bg-glass-400' },
                  { name: 'Sodium Hyaluronate', score: 88, color: 'bg-glass-400' },
                  { name: 'Allantoin', score: 92, color: 'bg-glass-400' },
                ].map((ing) => (
                  <div key={ing.name} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-seoul-charcoal">{ing.name}</p>
                      <div className="h-1 bg-seoul-pearl rounded-full mt-1">
                        <div className={`h-1 ${ing.color} rounded-full`} style={{ width: `${ing.score}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-glass-600">{ing.score}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-glass-600 font-medium">No conflicts with your routine</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-seoul-gradient">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="section-heading mb-3">Six Reasons K-Beauty Lovers Stay</h2>
            <p className="section-subheading mx-auto">From label to routine to community — intelligence at every step.</p>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {features.map(({ icon: Icon, title, desc, badge }) => (
              <motion.div key={title} variants={fadeUp} className="glass-card p-6 hover:shadow-glass-lg transition-shadow duration-300">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-seoul-blush to-glass-100 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-rose-gold" />
                </div>
                <h3 className="font-display font-semibold text-base text-seoul-charcoal mb-2">{title}</h3>
                <p className="text-seoul-soft text-sm leading-relaxed">{desc}</p>
                <span className={`${badge} mt-4 inline-block`}>AI-powered</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-seoul-cream">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="section-heading mb-3">How It Works</h2>
          <p className="section-subheading mx-auto mb-12">Three steps from curiosity to confident skin.</p>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {steps.map(({ icon: Icon, step, title, desc }) => (
              <motion.div key={step} variants={fadeUp} className="flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-seoul-pink to-glass-100 flex items-center justify-center shadow-glow-pink">
                    <Icon className="w-7 h-7 text-rose-gold" />
                  </div>
                  <span className="absolute -top-2 -right-2 text-xs font-bold text-rose-gold bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-glass">{step}</span>
                </div>
                <h3 className="font-display font-semibold text-seoul-charcoal mb-2">{title}</h3>
                <p className="text-seoul-soft text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Try Yuri - Layer 2 */}
      <TryYuriSection />

      {/* Social Proof */}
      <section className="py-20 px-4 bg-seoul-cream">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="section-heading mb-3">Trusted by K-Beauty Enthusiasts</h2>
            <p className="section-subheading mx-auto">The intelligence platform built for ingredient-literate skincare lovers.</p>
          </div>

          {/* Stats */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-12"
          >
            {stats.map(({ value, label }) => (
              <motion.div key={label} variants={fadeUp} className="glass-card p-5 text-center">
                <p className="text-2xl md:text-3xl font-bold text-gradient">{value}</p>
                <p className="text-xs text-seoul-soft mt-1">{label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Testimonials */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {[
              {
                quote: 'Yuri caught a retinol-AHA conflict in my routine I\'d been ignoring for months. My skin barrier has never been better.',
                name: 'Maya K.',
                skin: 'Combination skin, Fitzpatrick III',
              },
              {
                quote: 'I saved $40 on my Sulwhasoo by finding the same key ingredients in a $12 alternative. Budget Optimizer is unreal.',
                name: 'Lily C.',
                skin: 'Dry skin, Fitzpatrick II',
              },
            ].map((t) => (
              <motion.div key={t.name} variants={fadeUp} className="glass-card p-6">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-rose-gold fill-current" />
                  ))}
                </div>
                <p className="text-sm text-seoul-charcoal leading-relaxed mb-4">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="text-xs font-semibold text-seoul-charcoal">{t.name}</p>
                  <p className="text-xs text-seoul-soft">{t.skin}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-seoul-gradient">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="section-heading mb-3">Simple, Transparent Pricing</h2>
          <p className="section-subheading mx-auto mb-12">Start free. Go Pro when you&apos;re ready for the full intelligence suite.</p>
          <PricingCards />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-hero-gradient">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="font-display font-bold text-3xl md:text-4xl text-seoul-charcoal mb-4">
            Start Your K-Beauty Journey
          </h2>
          <p className="text-seoul-soft text-base md:text-lg mb-8 leading-relaxed">
            Join the community of ingredient-literate K-beauty lovers who make smarter skincare decisions.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 glass-button-primary text-base py-3.5 px-10"
          >
            Create Free Account <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-seoul-soft mt-4">No credit card required. Free tier is free forever.</p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-white/60 backdrop-blur-md border-t border-white/50 py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="font-display font-bold text-lg text-seoul-charcoal">Seoul Sister</span>
            <p className="text-xs text-seoul-soft mt-1">The world&apos;s first English K-beauty intelligence platform.</p>
          </div>
          <div className="flex gap-6 text-sm">
            {[
              { label: 'Features', href: '#features' },
              { label: 'Try Yuri', href: '#try-yuri' },
              { label: 'Pricing', href: '#pricing' },
            ].map((link) => (
              <Link key={link.label} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-4 text-xs text-seoul-soft">
            <Link href="/privacy" className="hover:text-seoul-charcoal transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-seoul-charcoal transition-colors">Terms</Link>
          </div>
        </div>
        <p className="text-center text-xs text-seoul-soft/60 mt-8">&copy; 2026 Seoul Sister. All rights reserved.</p>
      </footer>

      {/* Layer 1: Floating Yuri Bubble */}
      <YuriBubble />
    </div>
  )
}
