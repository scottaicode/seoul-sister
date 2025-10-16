'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AuthHeader from '@/components/AuthHeader'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black">
      <AuthHeader />

      <div className="container mx-auto px-4 pt-24 pb-8">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-luxury-gold transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Home</span>
          </Link>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-light text-white mb-4 tracking-wide">
              Terms of Service
            </h1>
            <p className="text-lg font-light text-gray-300">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm">
            <div className="prose prose-invert max-w-none">
              <div className="space-y-8 text-gray-300">

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">1. Acceptance of Terms</h2>
                  <p className="mb-4 font-light">
                    By accessing and using Seoul Sister's platform, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use our services.
                  </p>
                  <p className="mb-4 font-light">
                    These terms constitute a legally binding agreement between you and Seoul Sister. We may update these terms at any time, and continued use of our services constitutes acceptance of any changes.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">2. Service Description</h2>
                  <p className="mb-4 font-light">
                    Seoul Sister is a premium membership platform providing:
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li><strong>AI-Powered Skin Analysis:</strong> Personalized beauty recommendations based on uploaded photos</li>
                    <li><strong>Seoul Wholesale Access:</strong> Authentic Korean beauty products at wholesale pricing</li>
                    <li><strong>WhatsApp Ordering:</strong> Personal shopping service with Seoul-based team</li>
                    <li><strong>Ingredient Intelligence:</strong> Compatibility analysis and allergen detection</li>
                    <li><strong>Trending Product Alerts:</strong> Early access to viral Korean beauty discoveries</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">3. Subscription and Billing</h2>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">Premium Membership</h3>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Monthly subscription fee: $20.00 USD</li>
                    <li>7-day free trial for new subscribers</li>
                    <li>Automatic renewal unless canceled</li>
                    <li>Access to all premium features during active subscription</li>
                  </ul>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">Payment Terms</h3>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Payments processed securely through Stripe</li>
                    <li>Charges occur on your billing date each month</li>
                    <li>Failed payments may result in service suspension</li>
                    <li>No refunds for partial months of service</li>
                  </ul>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">Cancellation</h3>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Cancel anytime through your billing dashboard</li>
                    <li>Service continues until end of current billing period</li>
                    <li>No cancellation fees or penalties</li>
                    <li>Reactivation available at any time</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">4. User Responsibilities</h2>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">Account Security</h3>
                  <p className="mb-4 font-light">You are responsible for:</p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Maintaining the confidentiality of your account credentials</li>
                    <li>All activities that occur under your account</li>
                    <li>Immediately notifying us of unauthorized account access</li>
                    <li>Providing accurate and current information</li>
                  </ul>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">Acceptable Use</h3>
                  <p className="mb-4 font-light">You agree not to:</p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Use our services for illegal or unauthorized purposes</li>
                    <li>Share account access with others</li>
                    <li>Attempt to reverse engineer our AI algorithms</li>
                    <li>Upload inappropriate or harmful content</li>
                    <li>Interfere with our services or other users' access</li>
                    <li>Violate any applicable laws or regulations</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">5. AI Analysis and Recommendations</h2>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">Service Limitations</h3>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>AI analysis is for informational purposes only</li>
                    <li>Not a substitute for professional dermatological advice</li>
                    <li>Results may vary based on photo quality and conditions</li>
                    <li>We do not guarantee specific outcomes from product use</li>
                  </ul>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">Photo Upload</h3>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>You grant us license to process uploaded photos for analysis</li>
                    <li>Photos are used solely for providing personalized recommendations</li>
                    <li>We implement strong security measures to protect your images</li>
                    <li>You may request deletion of your photos at any time</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">6. Product Ordering and Fulfillment</h2>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">WhatsApp Ordering</h3>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Orders processed through WhatsApp messaging service</li>
                    <li>Our Seoul-based team sources products from authorized distributors</li>
                    <li>Pricing subject to exchange rates and availability</li>
                    <li>Estimated delivery times are approximate</li>
                  </ul>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">Product Authenticity</h3>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>All products sourced from authorized Korean distributors</li>
                    <li>We verify authenticity through established supplier relationships</li>
                    <li>Authenticity verification available upon request</li>
                    <li>We do not guarantee product effectiveness for individual users</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">7. Intellectual Property</h2>
                  <p className="mb-4 font-light">
                    Seoul Sister and its content, features, and functionality are owned by us and protected by international copyright, trademark, and other intellectual property laws.
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>You may not reproduce, distribute, or create derivative works</li>
                    <li>Our AI algorithms and analysis methods are proprietary</li>
                    <li>User-generated content may be used to improve our services</li>
                    <li>You retain ownership of photos and personal data you provide</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">8. Disclaimers and Limitations</h2>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">Service Availability</h3>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Services provided "as is" without warranties of any kind</li>
                    <li>We do not guarantee uninterrupted or error-free service</li>
                    <li>Maintenance and updates may temporarily affect availability</li>
                    <li>Third-party service dependencies may impact functionality</li>
                  </ul>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">Health and Safety</h3>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>AI recommendations are not medical advice</li>
                    <li>Consult healthcare professionals for skin concerns</li>
                    <li>Perform patch tests before using new products</li>
                    <li>We are not liable for allergic reactions or adverse effects</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">9. Liability Limitation</h2>
                  <p className="mb-4 font-light">
                    To the maximum extent permitted by law, Seoul Sister shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities.
                  </p>
                  <p className="mb-4 font-light">
                    Our total liability for any claims arising from these terms or your use of our services shall not exceed the amount you paid us in the 12 months preceding the claim.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">10. Indemnification</h2>
                  <p className="mb-4 font-light">
                    You agree to indemnify and hold harmless Seoul Sister from any claims, damages, or expenses arising from:
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Your use of our services</li>
                    <li>Violation of these terms</li>
                    <li>Infringement of third-party rights</li>
                    <li>Your negligence or willful misconduct</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">11. Termination</h2>
                  <p className="mb-4 font-light">
                    We may terminate or suspend your account and access to our services:
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>For violation of these terms</li>
                    <li>For suspected fraudulent activity</li>
                    <li>If required by law or regulation</li>
                    <li>At our sole discretion with reasonable notice</li>
                  </ul>
                  <p className="mb-4 font-light">
                    Upon termination, your right to use our services ceases immediately, but these terms remain in effect regarding past use.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">12. Governing Law and Disputes</h2>
                  <p className="mb-4 font-light">
                    These terms are governed by the laws of [Jurisdiction] without regard to conflict of law principles. Any disputes will be resolved through binding arbitration in accordance with [Arbitration Rules].
                  </p>
                  <p className="mb-4 font-light">
                    EU residents may also file complaints with their local data protection authority.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">13. Contact Information</h2>
                  <p className="mb-4 font-light">
                    For questions about these Terms of Service:
                  </p>
                  <ul className="list-none mb-4 space-y-2 font-light">
                    <li><strong>Email:</strong> legal@seoulsister.com</li>
                    <li><strong>Support:</strong> <Link href="/support" className="text-luxury-gold hover:text-luxury-gold/80">Submit a support ticket</Link></li>
                    <li><strong>WhatsApp:</strong> +1 (234) 567-8900</li>
                    <li><strong>Address:</strong> [Company Address]</li>
                  </ul>
                </section>

              </div>
            </div>
          </div>

          <div className="mt-8 text-center space-x-6">
            <Link
              href="/privacy"
              className="text-luxury-gold hover:text-luxury-gold/80 font-medium underline"
            >
              ← Privacy Policy
            </Link>
            <Link
              href="/support"
              className="text-luxury-gold hover:text-luxury-gold/80 font-medium underline"
            >
              Contact Support →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}