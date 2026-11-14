'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, ShieldCheck, Search, Sparkles,
  Brain, ListOrdered, ArrowRight,
  Menu, X, FlaskConical, Sun, CloudSun,
  BookOpen, Heart, Beaker, DollarSign, TrendingUp,
  Filter, Package, Layers, PiggyBank, HeartPulse, Smartphone
} from 'lucide-react'
import PricingCards from '@/components/pricing/PricingCards'
import TryYuriSection from '@/components/widget/TryYuriSection'
import OfferSavedLine from '@/components/widget/OfferSavedLine'
import InstallBanner from '@/components/pwa/InstallBanner'
import SignedInRedirect from '@/components/auth/SignedInRedirect'
import { MAX_FREE_MESSAGES } from '@/lib/utils/widget-session'
import { LANDING_CHAT_OPEN, gatedSignupHref, heroBadge, heroFootnote, talkToYuriLabel, yuriAccessSentence } from '@/lib/landing-chat'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

// Honesty pass, Nov 13 2026: the cards below were checked against the code and
// the production database, then attacked by a second model. Cut: Community
// Reviews (20 reviews from 2 accounts, none since February), Expiration
// Tracking (0 rows ever), Cycle-Aware Routine (on for 0 of 61 profiles), batch
// code checks (0 rows ever; the model recalls, nothing is looked up), "wait
// times" (no such column), the "Viral" / "Popular" badges, and the two
// testimonials (the owner and co-owner labelled "Early user"). NOT verified by
// use: Dupe Finder, Sunscreen Finder and Glass Skin sharing exist in code but
// have no usage record to check. Put a claim back only with a production row.
const coreFeatures = [
  { icon: Camera, title: 'Korean Label Decoder', desc: 'Photograph a Korean label and get the ingredient list in English, with a safety read on what is in it.' },
  { icon: Sparkles, title: 'AI Beauty Advisor', desc: 'Yuri is your personal AI advisor backed by 6 built-in AI specialists, cross-session memory, and your full skin profile.' },
  { icon: ListOrdered, title: 'A Routine Built With Yuri', desc: 'Yuri builds your morning and evening routine with you in chat: the order, how often to use each product, and what should not be layered together.' },
  { icon: ShieldCheck, title: 'Counterfeit Warning Signs', desc: 'Ask Yuri what to check on the packaging and the seller before you buy. We hold known counterfeit markers for a small number of brands so far.' },
  { icon: Search, title: 'Where to Buy', desc: 'Authorized stores that ship to you, with the US price where we have one and the international price for comparison.' },
  { icon: BookOpen, title: 'Ingredient Encyclopedia', desc: 'Look up an ingredient to see what it does, its safety and comedogenic ratings, and which products contain it.' },
]

const advancedFeatures = [
  { icon: FlaskConical, title: 'Glass Skin Score', desc: 'AI photo analysis scores your skin across 5 dimensions. Track progress over time and share your results.' },
  { icon: DollarSign, title: 'K-Beauty Dupe Finder', desc: 'Compare ingredient lists to find lower-priced products with the same key actives, and see exactly where they overlap.' },
  { icon: Sun, title: 'Sunscreen Finder', desc: 'Filter Korean sunscreens by PA rating, white cast, finish, and how they sit under makeup.' },
  { icon: Package, title: 'Shelf Scan', desc: 'Photograph your shelf and each product is identified and matched against our database. Then ask Yuri what she makes of it.' },
  { icon: Filter, title: 'Search by Ingredient', desc: 'Ask Yuri for products with the ingredients you want and without the ones you avoid, across 5,300+ products.' },
  { icon: CloudSun, title: 'Local Weather and UV', desc: 'Once you add your location, Yuri\'s check-in notes read the week\'s forecast where you live, and your dashboard shows today\'s humidity and UV.' },
]

const specialists = [
  { icon: FlaskConical, name: 'Ingredient Analyst', desc: 'Deep ingredient science: safety ratings, comedogenic scores, interaction warnings, and INCI translation.' },
  { icon: Layers, name: 'Routine Architect', desc: 'Builds your morning and evening routines with you: the layering order and how often to use each product.' },
  { icon: ShieldCheck, name: 'Authenticity Investigator', desc: 'Walks you through the packaging and seller warning signs to check before you buy.' },
  { icon: TrendingUp, name: 'Trend Scout', desc: 'Olive Young bestseller rankings and Reddit K-beauty mentions, refreshed daily. Shows what is selling in Korea that English-speaking communities are not talking about yet.' },
  { icon: PiggyBank, name: 'Budget Optimizer', desc: 'Finds products with the same key actives at a lower price, and shows where the ingredient lists overlap.' },
  { icon: HeartPulse, name: 'Sensitivity Guardian', desc: 'Allergy and reaction prevention. Flags irritants, cross-references your history, and protects sensitive skin.' },
]

// Step 1 is "Talk to Yuri", not "Scan or Search" (July 19 2026): usage data
// showed essentially every real user starts (and lives) in Yuri chat — the
// v11.0.0 Yuri-as-orchestrator repositioning. Scanning/search is a capability
// inside the journey, not the front door.
const steps = [
  { icon: Sparkles, step: '01', title: 'Talk to Yuri', desc: `Tell her about your skin, your products, and your goals. ${LANDING_CHAT_OPEN ? 'Free to start, no signup.' : yuriAccessSentence()}` },
  { icon: Brain, step: '02', title: 'Get AI Intelligence', desc: 'Yuri and her 6 built-in AI specialists decode ingredients, flag conflicts, point out counterfeit warning signs, and compare prices. Scan a Korean label or search 5,300+ products.' },
  { icon: ListOrdered, step: '03', title: 'Build Your Routine', desc: 'Yuri builds your routine with you: the order, how often to use each product, and what not to layer.' },
  { icon: Heart, step: '04', title: 'Track and Improve', desc: 'Track your Glass Skin Score over time, and check in with Yuri as your skin, the season and your shelf change.' },
]

// The one label for every button that leads to sign-up, matching the hero.
const SIGNUP_LABEL = 'Create my free account'
/** Sign-up link. Tagged `gate_<source>` only while the landing chat is closed, which is what the tag means. */
const signupHref = (source: string) => (LANDING_CHAT_OPEN ? '/register' : gatedSignupHref(source, ''))

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Ingredients', href: '/ingredients' },
  { label: 'Products', href: '/products' },
  { label: 'Best Products', href: '/best' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Blog', href: '/blog' },
]

export default function HomeClient() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // Mobile-only: reveal the sticky "Ask Yuri" bar once the visitor scrolls past
  // the hero. Without this the bar shipped permanently hidden (translate-y-full,
  // never toggled), so a mobile visitor who scrolled past the buried widget had
  // no one-tap route back to the input. Reveal after ~1 viewport of scroll.
  const [showStickyCTA, setShowStickyCTA] = useState(false)
  useEffect(() => {
    const onScroll = () => setShowStickyCTA(window.scrollY > window.innerHeight * 0.9)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-seoul-dark font-sans">

      {/* A signed-in visitor gets sent to the app instead of being shown the
          signup pitch. This page is the PWA's start_url, so without it every
          launch of the installed icon showed a paying subscriber "Get Started"
          and "Talk to Yuri Free — no signup", which is indistinguishable from
          having been logged out. That is what Bailey was reporting for three
          rounds of session fixes. Renders nothing and never gates the page —
          anonymous visitors and the Yuri widget are untouched. */}
      <SignedInRedirect />

      {/* Install offer for returning mobile visitors. The footer link and the menu
          item only reach someone who goes looking; this is the one surface that
          reaches a visitor who wasn't. Second visit onward, mobile only, hidden
          once installed, and a BAR rather than a modal so it can never cover the
          Yuri widget. */}
      <InstallBanner />

      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-seoul-dark/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Mark + wordmark. This is the FIRST brand impression for every cold
              visitor and every AI-citation click, so the landing nav carries the
              monogram too — not just the authenticated Header. */}
          <span className="flex items-center gap-2.5">
            <img
              src="/icons/icon-mark.svg"
              alt=""
              aria-hidden="true"
              width={36}
              height={36}
              className="w-9 h-9 rounded-lg"
            />
            <span className="font-display font-bold text-xl text-white tracking-tight">
              Seoul Sister
            </span>
          </span>
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link key={link.label} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {/* Shown from sm, except at md where the six links share the row
                and it does not fit (not rendered in a browser; check it).
                Phones get it as the first item of the menu below; the hero
                carries the same button below lg. */}
            <Link href={signupHref('nav')} className="hidden sm:inline-flex md:hidden lg:inline-flex glass-button-primary text-sm py-2 px-5 whitespace-nowrap">
              {SIGNUP_LABEL}
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
                <Link
                  href={signupHref('menu')}
                  onClick={() => setMobileMenuOpen(false)}
                  className="sm:hidden mb-2 glass-button-primary text-sm py-2.5 px-3 text-center"
                >
                  {SIGNUP_LABEL}
                </Link>
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

                {/* Install lives in the MENU, not just the footer (July 29 2026).
                    Scott refreshed the landing page looking for install help and
                    could not find it: the only link was 12px grey text at the
                    bottom of a very long page. The hamburger is where a phone user
                    actually looks for "app", so it goes here — and styled as its
                    own item rather than a seventh grey link, because it is a
                    different KIND of action from a content page. */}
                <Link
                  href="/install"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-2 py-2.5 px-3 flex items-center gap-2 text-sm font-medium text-gold-light bg-gold/10 border border-gold/20 rounded-lg hover:bg-gold/15 transition-colors"
                >
                  <Smartphone className="w-4 h-4" />
                  Add to Home Screen
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero — Widget as Hero (50/50 grid) */}
      <section className="relative bg-hero-gradient pt-12 pb-16 md:pt-16 md:pb-20 px-4 overflow-hidden">
        {/* Gold glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gold/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-[300px] h-[300px] bg-gold/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-start">
          {/* Left — Value Proposition */}
          <motion.div variants={stagger} initial="hidden" animate="show" className="pt-4 lg:pt-8">
            <motion.div variants={fadeUp}>
              <span className="badge-gold mb-4 inline-block">{heroBadge()}</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="font-display font-bold text-3xl md:text-5xl lg:text-5xl text-white leading-tight mb-5">
              Stop guessing
              <br />
              <span className="text-gradient">which K-beauty actually works.</span>
            </motion.h1>
            <motion.div variants={fadeUp} className="text-white/50 text-base md:text-lg max-w-lg mb-8 leading-relaxed space-y-3">
              <p>
                Whether you&apos;re drowning in products or don&apos;t own a single one yet, Yuri makes skincare simple.
              </p>
              <p>
                She gets to know your skin, your life, and what you&apos;re actually after. She&apos;ll tell you what&apos;s working, what&apos;s holding your skin back, and which products are worth your money. Members get a routine built around all of it, adjusted as their skin changes month to month.
              </p>
              <p className="text-white/40 text-sm">
                {LANDING_CHAT_OPEN ? 'Talk to her free, no signup.' : 'It starts with a free account.'} She just gets sharper once she really knows you.
              </p>
            </motion.div>

            {/* Quick stats row */}
            <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 mb-8 max-w-sm">
              {[
                { value: '5,900+', label: 'Products' },
                { value: '14,900+', label: 'Ingredients' },
                { value: '6', label: 'AI Specialists' },
                { value: '575+', label: 'Brands' },
              ].map(({ value, label }) => (
                <div key={label} className="dark-card p-3 text-center">
                  <p className="text-lg font-bold text-gradient">{value}</p>
                  <p className="text-[10px] text-white/40">{label}</p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
              {/* Closed landing chat, on a phone: the sign-up card sits two
                  screens down, below this column, so the first button a
                  visitor reaches is the sign-up itself. Desktop keeps "View
                  Plans" because the card and its button are beside it. */}
              {!LANDING_CHAT_OPEN && (
                <Link href={gatedSignupHref('hero_button', '')} className="lg:hidden glass-button-primary text-sm py-3 px-6">
                  Create my free account
                </Link>
              )}
              <Link href="#pricing" className={`${LANDING_CHAT_OPEN ? '' : 'hidden lg:inline-flex '}glass-button-primary text-sm py-3 px-6`}>
                View Plans
              </Link>
              <Link href="#features" className="dark-button-outline text-sm py-3 px-6">
                See All Features
              </Link>
            </motion.div>

            <motion.p variants={fadeUp} className="text-xs text-white/30 mt-4">
              {heroFootnote(MAX_FREE_MESSAGES)}
            </motion.p>
          </motion.div>

          {/* Right — Yuri Chat Widget (Hero position) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <TryYuriSection variant="hero" />
            <OfferSavedLine />
          </motion.div>
        </div>

        {/* Mobile sticky CTA bar — appears on scroll past hero */}
        <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-seoul-dark/95 backdrop-blur-md border-t border-gold/20 p-3 transition-transform duration-300 ${showStickyCTA ? 'translate-y-0' : 'translate-y-full'}`} id="mobile-sticky-cta">
          {LANDING_CHAT_OPEN ? (
            <button
              onClick={() => {
                document.getElementById('hero-yuri')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="glass-button-primary w-full text-sm py-3"
            >
              Ask Yuri About Your Skin
            </button>
          ) : (
            // Closed: scrolling to a card whose only action is this same
            // button was one tap too many.
            <Link href={gatedSignupHref('sticky', '')} className="glass-button-primary w-full text-sm py-3 block text-center">
              Create my free account
            </Link>
          )}
        </div>
      </section>

      {/* Core Intelligence Features */}
      <section id="features" className="py-20 px-4 bg-seoul-darker">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="badge-gold mb-3 inline-block">Core Intelligence</span>
            <h2 className="section-heading mb-3">The Foundation of Smarter Skincare</h2>
            <p className="section-subheading mx-auto">From the label on the bottle to the routine you actually follow.</p>
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
            <h2 className="section-heading mb-3">More Inside the Membership</h2>
            <p className="section-subheading mx-auto">Built for the ingredient-obsessed, the budget-conscious, and the routine-perfectionists.</p>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {advancedFeatures.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                className="dark-card p-5 hover:border-gold/20 transition-all duration-300 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-gold" />
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
            <h2 className="section-heading mb-3">6 Built-in AI Specialists. One Advisor.</h2>
            <p className="section-subheading mx-auto">Yuri draws on six specialist modes depending on what you ask, each with deep domain expertise in Korean beauty.</p>
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
            <p className="text-white/30 text-sm">All specialists report to <span className="text-gold/70 font-medium">Yuri</span>, your personal AI beauty advisor who knows your skin profile, history, and preferences.</p>
          </div>
        </div>
      </section>

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
            <p className="section-subheading mx-auto">Rankings, reviews and ingredient lists for Korean skincare are easy to find. Seoul Sister adds what a ranking cannot: an advisor who knows your skin and your shelf, and who will tell you when to keep what you already have.</p>
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
                desc: '14,900+ ingredients decoded with safety ratings, comedogenic scores, and function explanations. Products are broken down to the ingredient list wherever we have it.',
              },
              {
                icon: BookOpen,
                title: 'Memory That Carries Over',
                desc: 'Yuri keeps what you tell her between conversations: your skin, your shelf, what reacted badly, and what the two of you decided.',
              },
              {
                icon: TrendingUp,
                title: 'Daily Korean Trend Data',
                desc: 'Olive Young bestseller rankings and Reddit K-beauty mention counts, refreshed daily. A gap score flags what is selling in Korea that Reddit is not talking about yet.',
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

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-seoul-darker">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="section-heading mb-3">Simple, Transparent Pricing</h2>
          <p className="section-subheading mx-auto mb-12">One plan. Cancel anytime.</p>
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
            Your Skin Deserves Intelligence
          </h2>
          <p className="text-white/40 text-base md:text-lg mb-8 leading-relaxed">
            Tell Yuri about your skin and what is on your shelf. She will tell you what is working, what is not, and what is worth your money.
          </p>
          {/* Two exits, honestly labeled (July 19 2026): the caption promised a
              free no-signup chat while the only button led to /register — the
              convinced-but-not-ready scroller had no path back to the widget.
              The secondary CTA returns them to the hero widget (#hero-yuri,
              same anchor the mobile prefill flow uses). */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={signupHref('final_cta')}
              className="inline-flex items-center gap-2 glass-button-primary text-base py-3.5 px-10"
            >
              {SIGNUP_LABEL} <ArrowRight className="w-4 h-4" />
            </Link>
            {/* Open chat only. Closed, the hero card this scrolls to has one
                action, the same sign-up, so a second button with another
                label led to the same place. */}
            {LANDING_CHAT_OPEN && (<button
              onClick={() =>
                document.getElementById('hero-yuri')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
              className="inline-flex items-center gap-2 dark-button-outline text-base py-3.5 px-10"
            >
              <Sparkles className="w-4 h-4 text-gold" /> {talkToYuriLabel()}
            </button>)}
          </div>
          <p className="text-xs text-white/30 mt-4">{heroFootnote(MAX_FREE_MESSAGES)}</p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-seoul-darker border-t border-white/5 py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            {/* Mark beside the footer wordmark, matching the nav. The footer is the
                last thing a visitor sees before leaving, and the header had a mark
                while this said the name in bare text. */}
            <span className="flex items-center gap-2.5">
              <img
                src="/icons/icon-mark.svg"
                alt=""
                aria-hidden="true"
                width={32}
                height={32}
                className="w-8 h-8 rounded-lg"
              />
              <span className="font-display font-bold text-lg text-white">Seoul Sister</span>
            </span>
            <p className="text-xs text-white/30 mt-1">An English-language AI advisor for Korean skincare.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            {[
              { label: 'Features', href: '#features' },
              { label: 'Ingredients', href: '/ingredients' },
              { label: 'Products', href: '/products' },
              { label: 'Best Products', href: '/best' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'Blog', href: '/blog' },
            ].map((link) => (
              <Link key={link.label} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-4 text-xs text-white/30">
            {/* Install help must be reachable WITHOUT logging in. Scott and Bailey
                deleted their icons to re-add them and could not find any install
                instructions, because every copy lived on /dashboard — behind
                login, behind the paywall, and dismissible. */}
            <Link href="/install" className="hover:text-gold transition-colors">Get the app</Link>
            <Link href="/privacy" className="hover:text-gold transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gold transition-colors">Terms</Link>
            <Link href="/support" className="hover:text-gold transition-colors">Support</Link>
          </div>
        </div>
        <p className="text-center text-xs text-white/20 mt-8">&copy; 2026 Seoul Sister. All rights reserved.</p>
      </footer>

    </div>
  )
}
