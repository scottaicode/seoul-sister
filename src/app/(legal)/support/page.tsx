import Link from 'next/link'

export const metadata = {
  title: 'Support - Seoul Sister',
  description: 'Get help with your Seoul Sister account, billing, or K-beauty questions.',
}

export default function SupportPage() {
  return (
    <div className="space-y-8">
      <div className="glass-card p-6 md:p-10 text-white/80">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-3">
          Need Help?
        </h1>
        <p className="text-white/60 text-sm mb-8">
          Seoul Sister is built around Yuri, your AI beauty advisor. For most questions,
          she&apos;s faster and more helpful than any support ticket.
        </p>

        {/* Yuri First */}
        <section className="rounded-xl border border-gold/30 bg-gold/5 p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">유</span>
            </div>
            <div>
              <h2 className="text-gold font-semibold text-lg mb-2">Ask Yuri First</h2>
              <p className="text-white/70 text-sm mb-4">
                Yuri can help with skincare questions, product recommendations, ingredient analysis,
                routine building, and navigating Seoul Sister features. She has access to our full
                product database and remembers your skin profile.
              </p>
              <Link
                href="/yuri"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg text-sm font-medium transition-colors"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat with Yuri
              </Link>
            </div>
          </div>
        </section>

        {/* Account & Billing */}
        <section className="space-y-4 mb-8">
          <h2 className="text-white font-semibold text-lg">Account &amp; Billing</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-white font-medium text-sm mb-2">Manage Subscription</h3>
              <p className="text-white/50 text-xs mb-3">
                Update payment method, view invoices, or cancel your subscription.
              </p>
              <Link
                href="/profile"
                className="text-glass-blue hover:text-glass-blue/80 text-xs font-medium transition-colors"
              >
                Go to Profile &rarr;
              </Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-white font-medium text-sm mb-2">Billing Issues</h3>
              <p className="text-white/50 text-xs mb-3">
                Payment problems, refund requests, or account access issues.
              </p>
              <a
                href="mailto:support@seoulsister.com?subject=Billing%20Issue"
                className="text-glass-blue hover:text-glass-blue/80 text-xs font-medium transition-colors"
              >
                support@seoulsister.com &rarr;
              </a>
            </div>
          </div>
        </section>

        {/* Common Questions */}
        <section className="space-y-4 mb-8">
          <h2 className="text-white font-semibold text-lg">Common Questions</h2>
          <div className="space-y-3">
            {[
              {
                q: 'How do I scan a Korean product label?',
                a: 'Go to the Scan page from the main menu. Point your camera at any Korean beauty product label and Yuri will translate ingredients, check safety, and compare prices instantly.',
              },
              {
                q: 'Can Yuri help me build a skincare routine?',
                a: 'Yes. Ask Yuri "Build me a routine" or visit the Routine page. She\'ll create a personalized K-beauty routine based on your skin type, concerns, and budget.',
              },
              {
                q: 'How does the Glass Skin Score work?',
                a: 'Take a selfie on the Glass Skin page. Yuri\'s AI analyzes 5 dimensions of skin health (luminosity, smoothness, clarity, hydration, evenness) and tracks your progress over time.',
              },
              {
                q: 'What happens if I cancel my subscription?',
                a: 'You keep access through the end of your billing period. Your skin profile, conversation history, and routines are preserved if you resubscribe later.',
              },
              {
                q: 'Is my skin data private?',
                a: 'Yes. Your skin profile, conversations with Yuri, and scan history are private to your account. We never sell personal data. See our Privacy Policy for details.',
              },
            ].map((faq, i) => (
              <details
                key={i}
                className="rounded-xl border border-white/10 bg-white/5 overflow-hidden group"
              >
                <summary className="px-5 py-4 text-white text-sm font-medium cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between">
                  {faq.q}
                  <svg className="w-4 h-4 text-white/40 group-open:rotate-180 transition-transform flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-5 pb-4 text-white/50 text-xs leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Contact Fallback */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-white/50 text-sm mb-2">
            Still need help? Email us directly.
          </p>
          <a
            href="mailto:support@seoulsister.com"
            className="text-gold hover:text-gold/80 font-medium transition-colors"
          >
            support@seoulsister.com
          </a>
          <p className="text-white/30 text-xs mt-2">
            We typically respond within 24 hours.
          </p>
        </section>
      </div>
    </div>
  )
}
