'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, ShieldCheck, Search, Sparkles, Users,
  ScanLine, Brain, ListOrdered, Star, ArrowRight,
  Menu, X, FlaskConical, Sun, Timer, CloudSun,
  Activity, BookOpen, Heart, Beaker, DollarSign, TrendingUp,
  Filter, Package, Layers, PiggyBank, HeartPulse
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

const coreFeatures = [
  { icon: Camera, title: 'Korean Label Decoder', desc: 'Point your camera at any Korean label for instant ingredient translation, safety scoring, and personalized skin match.' },
  { icon: Sparkles, title: 'AI Beauty Advisor', desc: 'Yuri — your personal AI advisor backed by 6 specialist agents, cross-session memory, and your full skin profile.' },
  { icon: ListOrdered, title: 'Smart Routine Builder', desc: 'AI-generated routines with ingredient conflict detection, layering order, wait times, and skin cycling schedules.' },
  { icon: ShieldCheck, title: 'Counterfeit Detection', desc: 'Spot fakes before you buy with AI-powered packaging analysis, batch code verification, and crowdsourced signals.' },
  { icon: Search, title: 'Price Comparison', desc: 'Compare prices across Korea and US retailers — YesStyle, Soko Glam, Olive Young, Amazon, and more.' },
  { icon: Users, title: 'Community Reviews', desc: 'Reviews filtered by skin type, Fitzpatrick scale, age, and concern — not just star ratings.' },
]

const advancedFeatures = [
  { icon: FlaskConical, title: 'Glass Skin Score', desc: 'AI photo analysis scores your skin across 5 dimensions. Track progress over time and share your results.', badge: 'Viral' },
  { icon: DollarSign, title: 'K-Beauty Dupe Finder', desc: 'Find $12 alternatives to $94 products. Ingredient-level matching shows exactly where the overlap is.', badge: 'Popular' },
  { icon: Sun, title: 'Sunscreen Finder', desc: 'Filter by PA rating, white cast, finish, under-makeup compatibility — every detail K-beauty sunscreen lovers need.', badge: 'High Intent' },
  { icon: Package, title: 'Shelf Scan', desc: 'Photograph your entire collection. Get a routine grade, redundancy alerts, gap analysis, and estimated value.', badge: 'Unique' },
  { icon: Filter, title: 'Ingredient Filters', desc: 'Search 6,200+ products by ingredients you want and ingredients you avoid. Fragrance-free and low-comedogenic shortcuts built in.', badge: 'Power User' },
  { icon: Timer, title: 'Expiration Tracking', desc: 'Track when you opened each product. Get alerts before they expire. No more guessing if that serum is still good.', badge: 'Unique' },
  { icon: CloudSun, title: 'Weather-Adaptive Alerts', desc: 'Real-time weather data adjusts your routine. High humidity? Skip the oil. UV spike? Reapply sunscreen reminder.', badge: 'Proactive' },
  { icon: Activity, title: 'Cycle-Aware Routine', desc: 'Opt-in hormonal cycle tracking adjusts your skincare by phase. Luteal breakouts get BHA, not just moisturizer.', badge: 'Unique' },
]

const specialists = [
  { icon: FlaskConical, name: 'Ingredient Analyst', desc: 'Deep ingredient science — safety ratings, comedogenic scores, interaction warnings, and INCI translation.' },
  { icon: Layers, name: 'Routine Architect', desc: 'Builds personalized AM/PM routines with Korean layering order, wait times, and skin cycling schedules.' },
  { icon: ShieldCheck, name: 'Authenticity Investigator', desc: 'Spots counterfeits through packaging analysis, batch codes, seller reputation, and crowdsourced signals.' },
  { icon: TrendingUp, name: 'Trend Scout', desc: 'Tracks what\'s trending in Seoul — TikTok virality, Reddit buzz, and Korean market signals before they hit the US.' },
  { icon: PiggyBank, name: 'Budget Optimizer', desc: 'Finds ingredient-matched dupes at a fraction of the price. Same key actives, dramatically lower cost.' },
  { icon: HeartPulse, name: 'Sensitivity Guardian', desc: 'Allergy and reaction prevention — flags irritants, cross-references your history, and protects sensitive skin.' },
]

const steps = [
  { icon: ScanLine, step: '01', title: 'Scan or Search', desc: 'Camera scan a Korean label or search 6,200+ products across 590+ brands.' },
  { icon: Brain, step: '02', title: 'Get AI Intelligence', desc: 'Yuri and 6 specialist agents decode ingredients, flag conflicts, check authenticity, and compare prices.' },
  { icon: ListOrdered, step: '03', title: 'Build Your Routine', desc: 'Add to your personalized routine with conflict detection, layering order, wait times, and skin cycling.' },
  { icon: Heart, step: '04', title: 'Track and Improve', desc: 'Monitor your Glass Skin Score, track product expiry, get weather alerts, and discover dupes.' },
]

const stats = [
  { value: '6,200+', label: 'Products Tracked' },
  { value: '590+', label: 'K-Beauty Brands' },
  { value: '10,300+', label: 'Ingredients Decoded' },
  { value: '6', label: 'AI Specialists' },
]

const testimonials = [
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
  {
    quote: 'My Glass Skin Score went from 54 to 73 in two months. Seeing the radar chart improve keeps me consistent with my routine.',
    name: 'Jenna T.',
    skin: 'Normal skin, Fitzpatrick IV',
  },
  {
    quote: 'The sunscreen finder finally helped me find a PA++++ with zero white cast that works under makeup. Game changer for daily wear.',
    name: 'Priya S.',
    skin: 'Oily skin, Fitzpatrick V',
  },
]

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Try Yuri', href: '#try-yuri' },
  { label: 'Pricing', href: '#pricing' },
]

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-seoul-dark font-sans">

      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-seoul-dark/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-display font-bold text-xl text-white tracking-tight">
            Seoul Sister
          </span>
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link key={link.label} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/register" className="glass-button-primary text-sm py-2 px-5">
              Get Started
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-white/70" />
              ) : (
                <Menu className="w-5 h-5 text-white/70" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-white/5"
            >
              <div className="px-4 py-3 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 px-3 text-sm text-white/60 hover:text-gold hover:bg-white/5 rounded-lg transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero */}
      <section className="relative bg-hero-gradient pt-20 pb-24 px-4 overflow-hidden">
        {/* Gold glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gold/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-[300px] h-[300px] bg-gold/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.div variants={fadeUp}>
              <span className="badge-gold mb-4 inline-block">World&apos;s First English K-Beauty Intelligence Platform</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="font-display font-bold text-4xl md:text-6xl lg:text-7xl text-white leading-tight mb-6">
              K-Beauty Intelligence,
              <br />
              <span className="text-gradient">Powered by AI</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-white/50 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              6,200+ products. 10,300+ ingredients decoded. 6 AI specialist agents. From label scanning to routine building — every decision backed by real intelligence.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="glass-button-primary text-base py-3 px-8">
                Get Started
              </Link>
              <Link href="#features" className="dark-button-outline text-base py-3 px-8">
                See All Features
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
            <div className="dark-card-gold p-6 text-left shadow-glow-gold">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold to-gold-light flex items-center justify-center">
                  <Camera className="w-4 h-4 text-seoul-dark" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white">Scanning label...</p>
                  <p className="text-xs text-white/40">COSRX Advanced Snail 96</p>
                </div>
                <span className="ml-auto badge-gold animate-pulse-soft">Live</span>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Snail Secretion Filtrate', score: 96 },
                  { name: 'Sodium Hyaluronate', score: 88 },
                  { name: 'Allantoin', score: 92 },
                ].map((ing) => (
                  <div key={ing.name} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-white/80">{ing.name}</p>
                      <div className="h-1 bg-white/5 rounded-full mt-1">
                        <div className="h-1 bg-gradient-to-r from-gold to-gold-light rounded-full" style={{ width: `${ing.score}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-gold">{ing.score}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gold/70 font-medium">No conflicts with your routine</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Core Intelligence Features */}
      <section id="features" className="py-20 px-4 bg-seoul-darker">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="badge-gold mb-3 inline-block">Core Intelligence</span>
            <h2 className="section-heading mb-3">The Foundation of Smarter Skincare</h2>
            <p className="section-subheading mx-auto">Six AI-powered pillars — from label to routine to community.</p>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {coreFeatures.map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp} className="dark-card p-6 hover:border-gold/20 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-gold" />
                </div>
                <h3 className="font-display font-semibold text-base text-white mb-2">{title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Advanced Features — What Makes Seoul Sister Different */}
      <section className="py-20 px-4 bg-seoul-dark">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="badge-gold mb-3 inline-block">Beyond the Basics</span>
            <h2 className="section-heading mb-3">Features No Other K-Beauty App Has</h2>
            <p className="section-subheading mx-auto">Built for the ingredient-obsessed, the budget-conscious, and the routine-perfectionists.</p>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {advancedFeatures.map(({ icon: Icon, title, desc, badge }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                className="dark-card p-5 hover:border-gold/20 transition-all duration-300 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-gold" />
                  </div>
                  <span className="text-[10px] font-medium text-gold/60 bg-gold/5 px-2 py-0.5 rounded-full border border-gold/10">{badge}</span>
                </div>
                <h3 className="font-display font-semibold text-sm text-white mb-1.5">{title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Meet the Specialists */}
      <section className="py-20 px-4 bg-seoul-darker">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="badge-gold mb-3 inline-block">Meet the Team</span>
            <h2 className="section-heading mb-3">6 Specialist AI Agents. One Advisor.</h2>
            <p className="section-subheading mx-auto">Yuri routes every question to the right specialist — each with deep domain expertise in Korean beauty.</p>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {specialists.map(({ icon: Icon, name, desc }) => (
              <motion.div
                key={name}
                variants={fadeUp}
                className="dark-card p-6 hover:border-gold/20 transition-all duration-300 group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                    <Icon className="w-5 h-5 text-gold" />
                  </div>
                  <h3 className="font-display font-semibold text-base text-white">{name}</h3>
                </div>
                <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
          <div className="text-center mt-8">
            <p className="text-white/30 text-sm">All specialists report to <span className="text-gold/70 font-medium">Yuri</span> — your personal AI beauty advisor who knows your skin profile, history, and preferences.</p>
          </div>
        </div>
      </section>

      {/* Try Yuri - Layer 2 */}
      <TryYuriSection />

      {/* How It Works */}
      <section className="py-20 px-4 bg-seoul-dark">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="section-heading mb-3">How It Works</h2>
          <p className="section-subheading mx-auto mb-12">Four steps from curiosity to confident skin.</p>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8"
          >
            {steps.map(({ icon: Icon, step, title, desc }) => (
              <motion.div key={step} variants={fadeUp} className="flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center shadow-glow-gold">
                    <Icon className="w-7 h-7 text-gold" />
                  </div>
                  <span className="absolute -top-2 -right-2 text-xs font-bold text-seoul-dark bg-gold rounded-full w-6 h-6 flex items-center justify-center">{step}</span>
                </div>
                <h3 className="font-display font-semibold text-white mb-2">{title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* What Sets Us Apart */}
      <section className="py-20 px-4 bg-seoul-darker">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="section-heading mb-3">Why Seoul Sister Exists</h2>
            <p className="section-subheading mx-auto">Korean consumers have Hwahae — 187,000 products, 5.7M reviews, ingredient-level intelligence. English speakers have nothing. Until now.</p>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
          >
            {[
              {
                icon: Beaker,
                title: 'Ingredient-Level Intelligence',
                desc: '10,300+ ingredients decoded with safety ratings, comedogenic scores, and function explanations. Every product analyzed down to the INCI list.',
              },
              {
                icon: BookOpen,
                title: 'Learning Engine',
                desc: 'Every scan, review, and routine adjustment teaches the system. Recommendations improve as the community grows — a dataset no competitor can replicate.',
              },
              {
                icon: TrendingUp,
                title: 'Real-Time Korean Trends',
                desc: 'Track what\'s trending in Seoul before it hits the US market. TikTok, Reddit, Instagram, and Korean market signals — all in one feed.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp} className="dark-card p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-gold" />
                </div>
                <h3 className="font-display font-semibold text-white mb-2">{title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4 bg-seoul-dark">
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
              <motion.div key={label} variants={fadeUp} className="dark-card-gold p-5 text-center">
                <p className="text-2xl md:text-3xl font-bold text-gradient">{value}</p>
                <p className="text-xs text-white/40 mt-1">{label}</p>
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
            {testimonials.map((t) => (
              <motion.div key={t.name} variants={fadeUp} className="dark-card p-6">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-gold fill-current" />
                  ))}
                </div>
                <p className="text-sm text-white/70 leading-relaxed mb-4">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="text-xs font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-white/40">{t.skin}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-seoul-darker">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="section-heading mb-3">Simple, Transparent Pricing</h2>
          <p className="section-subheading mx-auto mb-12">One plan. Full AI intelligence. Cancel anytime.</p>
          <PricingCards />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-20 px-4 bg-seoul-dark overflow-hidden">
        {/* Gold glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-gold/6 rounded-full blur-[100px] pointer-events-none" />
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          className="relative max-w-2xl mx-auto text-center"
        >
          <h2 className="font-display font-bold text-3xl md:text-4xl text-white mb-4">
            Start Your K-Beauty Journey
          </h2>
          <p className="text-white/40 text-base md:text-lg mb-8 leading-relaxed">
            Join the community of ingredient-literate K-beauty lovers who make smarter skincare decisions.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 glass-button-primary text-base py-3.5 px-10"
          >
            Start Your Journey <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-white/30 mt-4">Try Yuri free before you subscribe. 5 preview messages, no signup required.</p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-seoul-darker border-t border-white/5 py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="font-display font-bold text-lg text-white">Seoul Sister</span>
            <p className="text-xs text-white/30 mt-1">The world&apos;s first English K-beauty intelligence platform.</p>
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
          <div className="flex gap-4 text-xs text-white/30">
            <Link href="/privacy" className="hover:text-gold transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gold transition-colors">Terms</Link>
          </div>
        </div>
        <p className="text-center text-xs text-white/20 mt-8">&copy; 2026 Seoul Sister. All rights reserved.</p>
      </footer>

      {/* Layer 1: Floating Yuri Bubble */}
      <YuriBubble />
    </div>
  )
}
