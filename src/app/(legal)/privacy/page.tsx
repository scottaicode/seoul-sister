import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy - Seoul Sister',
  description: 'How Seoul Sister collects, uses, and protects your personal information.',
}

export default function PrivacyPage() {
  return (
    <article className="glass-card p-6 md:p-10 space-y-8 text-white/70 text-sm leading-relaxed">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">
          Privacy Policy
        </h1>
        <p className="text-white/40 text-xs">Effective Date: February 18, 2026</p>
      </header>

      {/* Privacy Promise */}
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
        <h3 className="text-green-400 font-semibold text-sm mb-2">Our Privacy Promise</h3>
        <p className="mb-2"><strong className="text-white">We will NEVER:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Sell your data to anyone</li>
          <li>Share your personal skincare data with third parties for advertising</li>
          <li>Use your data for purposes other than improving your Seoul Sister experience</li>
          <li>Send your data to data brokers or ad networks</li>
        </ul>
      </div>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          1. Information We Collect
        </h2>
        <h3 className="text-white/90 font-medium mb-2">Information You Provide:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-white/90">Account information:</strong> Email address, password (hashed)</li>
          <li><strong className="text-white/90">Skin profile:</strong> Skin type, concerns, allergies, Fitzpatrick scale, climate, age range, budget</li>
          <li><strong className="text-white/90">Product interactions:</strong> Scanned labels, reviews, routines, wishlists, reactions</li>
          <li><strong className="text-white/90">Conversations:</strong> Messages with Yuri AI advisor</li>
        </ul>

        <h3 className="text-white/90 font-medium mb-2 mt-4">Information Collected Automatically:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Device type and browser for responsive design</li>
          <li>IP address for rate limiting and abuse prevention</li>
          <li>Usage patterns (pages visited, features used) for product improvement</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          2. How We Use Your Information
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-white/90">Personalization:</strong> Tailoring Yuri&apos;s recommendations to your skin type and concerns</li>
          <li><strong className="text-white/90">Product intelligence:</strong> Ingredient conflict detection, routine building, compatibility scoring</li>
          <li><strong className="text-white/90">Learning engine:</strong> Anonymized, aggregated data across users improves recommendations for everyone (e.g., &ldquo;users with oily skin found Product X effective&rdquo;)</li>
          <li><strong className="text-white/90">Account management:</strong> Authentication, subscription billing, support</li>
          <li><strong className="text-white/90">Service improvement:</strong> Understanding which features are used to improve the product</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          3. AI Processing &amp; Third-Party Services
        </h2>
        <div className="rounded-xl border border-gold/20 bg-gold/5 p-5 mb-4">
          <h3 className="text-gold font-semibold text-sm mb-2">AI-Powered Features</h3>
          <p>Seoul Sister uses Anthropic&apos;s Claude AI to power Yuri conversations, label scanning, ingredient analysis, and routine building. Your messages and images are sent to Anthropic&apos;s API for processing. Anthropic does not use your data to train their models.</p>
        </div>
        <p className="mb-2">We use the following third-party services:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-white/90">Supabase:</strong> Database and authentication (hosted in the US)</li>
          <li><strong className="text-white/90">Anthropic:</strong> AI processing for Yuri advisor and scanning features</li>
          <li><strong className="text-white/90">Stripe:</strong> Payment processing for subscriptions</li>
          <li><strong className="text-white/90">Vercel:</strong> Application hosting and delivery</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          4. Cross-User Learning (Anonymized)
        </h2>
        <p>Seoul Sister&apos;s learning engine aggregates anonymized data across users to improve recommendations. This means:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Your skin type + product reactions contribute to effectiveness scores (e.g., &ldquo;88% of users with dry skin rated this moisturizer positively&rdquo;)</li>
          <li>All learning data is fully anonymized &mdash; no personally identifiable information is stored in learning patterns</li>
          <li>You cannot be identified from aggregated learning data</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          5. Data Retention
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-white/90">Account data:</strong> Retained while your account is active</li>
          <li><strong className="text-white/90">Conversation history:</strong> Retained for cross-session memory while account is active</li>
          <li><strong className="text-white/90">Anonymous widget conversations:</strong> Not stored; streamed and discarded</li>
          <li><strong className="text-white/90">After deletion:</strong> All personal data is deleted within 30 days. Anonymized learning contributions are retained.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          6. Your Rights &amp; Controls
        </h2>
        <p className="mb-2">You have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-white/90">Access:</strong> View all data we have about you (available on your Profile page)</li>
          <li><strong className="text-white/90">Delete:</strong> Delete your account and all associated data (Settings &rarr; Delete Account)</li>
          <li><strong className="text-white/90">Export:</strong> Request a copy of your data by contacting us</li>
          <li><strong className="text-white/90">Correct:</strong> Update your skin profile at any time through Yuri onboarding</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          7. Cookies &amp; Local Storage
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-white/90">Authentication:</strong> Session tokens stored in browser for login</li>
          <li><strong className="text-white/90">Widget tracking:</strong> localStorage tracks anonymous widget message count (resets after 30 days)</li>
          <li><strong className="text-white/90">No third-party tracking cookies:</strong> We do not use Google Analytics, Facebook Pixel, or similar tracking tools</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          8. Children&apos;s Privacy
        </h2>
        <p>Seoul Sister is intended for users aged 13 and older. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us personal information, please contact us for immediate deletion.</p>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          9. California Privacy Rights (CCPA)
        </h2>
        <p>California residents have the right to know what personal information is collected, request deletion, and opt out of the sale of personal information. We do not sell personal information. To exercise these rights, contact us at the email below.</p>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          10. Security
        </h2>
        <p>We protect your data with:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>HTTPS encryption for all data in transit</li>
          <li>Row Level Security (RLS) on all database tables</li>
          <li>Passwords hashed via Supabase Auth (bcrypt)</li>
          <li>API keys stored as environment variables, never in client code</li>
          <li>Rate limiting on all public endpoints</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          11. Changes to This Policy
        </h2>
        <p>We may update this policy from time to time. We will notify you of material changes by posting a notice on the app or sending an email. Continued use after changes constitutes acceptance.</p>
      </section>

      <section>
        <h2 className="text-white font-semibold text-lg mb-3 pt-4 border-t border-white/10">
          12. Contact
        </h2>
        <p>For privacy questions, data requests, or concerns:</p>
        <p className="mt-2">
          <strong className="text-white/90">Email:</strong>{' '}
          <a href="mailto:privacy@seoulsister.com" className="text-gold-light hover:text-gold transition-colors">
            privacy@seoulsister.com
          </a>
        </p>
      </section>

      {/* Footer nav */}
      <div className="flex flex-wrap gap-4 pt-6 border-t border-white/10">
        <Link
          href="/terms"
          className="text-sm text-gold-light hover:text-gold transition-colors"
        >
          Terms of Service &rarr;
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
