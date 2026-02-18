import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service - Seoul Sister',
  description: 'Terms and conditions for using Seoul Sister K-beauty intelligence platform.',
}

export default function TermsPage() {
  return (
    <article className="glass-card p-6 md:p-10 space-y-8 text-white/70 text-sm leading-relaxed">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">
          Terms of Service
        </h1>
        <p className="text-white/40 text-xs">Effective Date: February 18, 2026</p>
      </header>

      {/* What Seoul Sister IS and IS NOT */}
      <div className="rounded-xl border border-gold/20 bg-gold/5 p-5">
        <h3 className="text-gold font-semibold text-sm mb-3">What Seoul Sister IS and IS NOT</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-white/90 font-medium mb-1">Seoul Sister IS:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>A K-beauty intelligence and education platform</li>
              <li>An AI-powered skincare advisor for ingredient analysis and routine building</li>
              <li>A community for sharing product experiences</li>
              <li>A tool for comparing prices and detecting counterfeits</li>
            </ul>
          </div>
          <div>
            <p className="text-white/90 font-medium mb-1">Seoul Sister IS NOT:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>A medical service or dermatological provider</li>
              <li>A diagnostic tool for skin conditions</li>
              <li>A replacement for professional medical advice</li>
              <li>An e-commerce store (we do not sell products)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Medical disclaimer */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <h3 className="text-amber-400 font-semibold text-sm mb-2">Important: Not Medical Advice</h3>
        <p>Seoul Sister provides skincare information and AI-powered recommendations for educational purposes only. Our ingredient analysis, routine suggestions, and Yuri conversations are NOT medical advice. If you have a skin condition, allergies, or health concerns, consult a board-certified dermatologist or healthcare provider before using any skincare products.</p>
      </div>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          1. Acceptance of Terms
        </h2>
        <p>By creating an account or using Seoul Sister, you agree to these Terms of Service, our <Link href="/privacy" className="text-gold-light hover:text-gold">Privacy Policy</Link>, and all applicable laws. If you do not agree, do not use the service.</p>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          2. Eligibility
        </h2>
        <p>You must be at least 13 years old to use Seoul Sister. If you are under 18, you represent that a parent or guardian has reviewed and agreed to these terms on your behalf.</p>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          3. Account Responsibilities
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>You are responsible for maintaining the security of your account credentials</li>
          <li>You must provide accurate information during registration and onboarding</li>
          <li>You must not share your account with others or create multiple accounts</li>
          <li>You are responsible for all activity that occurs under your account</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          4. Subscriptions &amp; Billing
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Free tier features are available at no charge</li>
          <li>Pro subscriptions are billed monthly or annually through Stripe</li>
          <li>You can cancel anytime; access continues through the end of the billing period</li>
          <li>Refunds are handled on a case-by-case basis within 7 days of charge</li>
          <li>We reserve the right to change pricing with 30 days notice to existing subscribers</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          5. AI Features &amp; Limitations
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Yuri and all specialist agents are AI-powered and may occasionally provide inaccurate information</li>
          <li>AI recommendations are based on available data and should be used as one input among many</li>
          <li>Ingredient conflict warnings are informational, not diagnostic</li>
          <li>Counterfeit detection is probabilistic, not guaranteed &mdash; always verify through authorized retailers</li>
          <li>Label scanning accuracy depends on image quality and may not capture all ingredients</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          6. Your Content
        </h2>
        <p className="mb-2">When you submit reviews, photos, or other content:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You retain ownership of your content</li>
          <li>You grant Seoul Sister a license to display, distribute, and use your content within the platform</li>
          <li>You represent that your content is truthful and based on genuine product experience</li>
          <li>We may remove content that violates these terms or is reported as harmful</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          7. Acceptable Use
        </h2>
        <p className="mb-2">You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Submit fake reviews or manipulate community ratings</li>
          <li>Attempt to bypass rate limits, message limits, or subscription restrictions</li>
          <li>Use the service to spam, harass, or harm others</li>
          <li>Scrape, crawl, or reverse-engineer any part of the service</li>
          <li>Upload malicious content or attempt to compromise the platform</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          8. Affiliate Links &amp; Recommendations
        </h2>
        <p>Seoul Sister may include affiliate links to third-party retailers (Olive Young, Soko Glam, YesStyle, Amazon, etc.). When you purchase through these links, we may earn a commission at no additional cost to you. Affiliate relationships do not influence our AI recommendations or ingredient analysis.</p>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          9. Limitation of Liability
        </h2>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, SEOUL SISTER AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO SKIN REACTIONS, ALLERGIC RESPONSES, FINANCIAL LOSSES FROM COUNTERFEIT PRODUCTS, OR RELIANCE ON AI RECOMMENDATIONS. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE SERVICE IN THE 12 MONTHS PRECEDING THE CLAIM.</p>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          10. Indemnification
        </h2>
        <p>You agree to indemnify and hold harmless Seoul Sister from any claims, damages, or expenses arising from your use of the service, your content, or your violation of these terms.</p>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          11. Service Modifications
        </h2>
        <p>We may modify, suspend, or discontinue any part of the service at any time. We will provide reasonable notice for material changes that affect paid subscribers.</p>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          12. Termination
        </h2>
        <p>We may suspend or terminate your account for violation of these terms. You may delete your account at any time through Settings. Upon termination, your data will be handled according to our Privacy Policy.</p>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          13. Governing Law
        </h2>
        <p>These terms are governed by the laws of the State of California, United States, without regard to conflict of law principles.</p>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          14. Contact
        </h2>
        <p>For questions about these terms:</p>
        <p className="mt-2">
          <strong className="text-white/90">Email:</strong>{' '}
          <a href="mailto:legal@seoulsister.com" className="text-gold-light hover:text-gold transition-colors">
            legal@seoulsister.com
          </a>
        </p>
      </section>

      {/* Plain English Summary */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-white font-semibold text-sm mb-2">Plain English Summary</h3>
        <p>We built Seoul Sister to help you make smarter K-beauty decisions. Yuri is an AI, not a doctor &mdash; always check with a dermatologist for medical concerns. Your data is yours; we use it to personalize your experience and delete it when you ask. We earn money through subscriptions and affiliate links, but those never influence our AI recommendations. Be honest in reviews, don&apos;t game the system, and we&apos;ll all have a better experience.</p>
      </div>

      {/* Footer nav */}
      <div className="flex flex-wrap gap-4 pt-6 border-t border-white/10">
        <Link
          href="/privacy"
          className="text-sm text-gold-light hover:text-gold transition-colors"
        >
          Privacy Policy &rarr;
        </Link>
        <Link
          href="/"
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Back to Seoul Sister
        </Link>
      </div>
    </article>
  )
}
