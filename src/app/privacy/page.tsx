'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AuthHeader from '@/components/AuthHeader'

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-lg font-light text-gray-300">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm">
            <div className="prose prose-invert max-w-none">
              <div className="space-y-8 text-gray-300">

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">1. Information We Collect</h2>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">Personal Information</h3>
                  <p className="mb-4 font-light">
                    We collect information you provide directly to us, including:
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Account information (name, email address, phone number)</li>
                    <li>Profile information (skin type, beauty concerns, preferences)</li>
                    <li>Photos you upload for AI skin analysis</li>
                    <li>Payment information (processed securely by Stripe)</li>
                    <li>Communication data (support tickets, WhatsApp messages)</li>
                    <li>Purchase history and product preferences</li>
                  </ul>

                  <h3 className="text-xl font-medium text-luxury-gold mb-3">Automatically Collected Information</h3>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Usage data and analytics</li>
                    <li>Device information and IP address</li>
                    <li>Cookies and similar tracking technologies</li>
                    <li>Location data (if permitted)</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">2. How We Use Your Information</h2>
                  <p className="mb-4 font-light">
                    We use the information we collect to:
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Provide personalized Korean beauty recommendations</li>
                    <li>Process AI skin analysis and generate customized advice</li>
                    <li>Manage your subscription and process payments</li>
                    <li>Facilitate WhatsApp ordering and customer service</li>
                    <li>Send product updates and promotional content (with consent)</li>
                    <li>Improve our AI algorithms and user experience</li>
                    <li>Comply with legal obligations and prevent fraud</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">3. Information Sharing and Disclosure</h2>
                  <p className="mb-4 font-light">
                    We do not sell, trade, or otherwise transfer your personal information to third parties except:
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li><strong>Service Providers:</strong> Stripe (payment processing), Supabase (data storage), WhatsApp Business API</li>
                    <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                    <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                    <li><strong>Consent:</strong> With your explicit consent for specific purposes</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">4. Data Security</h2>
                  <p className="mb-4 font-light">
                    We implement industry-standard security measures to protect your personal information:
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Encrypted data transmission and storage</li>
                    <li>Secure payment processing through Stripe</li>
                    <li>Regular security audits and updates</li>
                    <li>Access controls and employee training</li>
                    <li>Automated threat monitoring</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">5. Your Rights Under GDPR</h2>
                  <p className="mb-4 font-light">
                    If you are a resident of the European Union, you have the following rights:
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li><strong>Right to Access:</strong> Request copies of your personal data</li>
                    <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete data</li>
                    <li><strong>Right to Erasure:</strong> Request deletion of your personal data</li>
                    <li><strong>Right to Restrict Processing:</strong> Limit how we use your data</li>
                    <li><strong>Right to Data Portability:</strong> Receive your data in a portable format</li>
                    <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
                    <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
                  </ul>
                  <p className="mb-4 font-light">
                    To exercise these rights, contact us at privacy@seoulsister.com or through our support system.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">6. Data Retention</h2>
                  <p className="mb-4 font-light">
                    We retain your personal information for as long as necessary to:
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Provide our services and maintain your account</li>
                    <li>Comply with legal obligations</li>
                    <li>Resolve disputes and enforce our agreements</li>
                    <li>Improve our AI algorithms (anonymized data only)</li>
                  </ul>
                  <p className="mb-4 font-light">
                    Account data is typically deleted within 30 days of account closure, except where retention is required by law.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">7. International Data Transfers</h2>
                  <p className="mb-4 font-light">
                    Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place, including:
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Standard Contractual Clauses approved by the European Commission</li>
                    <li>Adequacy decisions by relevant data protection authorities</li>
                    <li>Certification schemes and codes of conduct</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">8. Children's Privacy</h2>
                  <p className="mb-4 font-light">
                    Our services are not intended for children under 16. We do not knowingly collect personal information from children under 16. If we discover we have collected such information, we will delete it promptly.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">9. Cookies and Tracking</h2>
                  <p className="mb-4 font-light">
                    We use cookies and similar technologies to:
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Remember your preferences and settings</li>
                    <li>Analyze website usage and improve performance</li>
                    <li>Provide personalized content and recommendations</li>
                    <li>Measure the effectiveness of our marketing campaigns</li>
                  </ul>
                  <p className="mb-4 font-light">
                    You can control cookies through your browser settings. Some features may not function properly if cookies are disabled.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">10. Changes to Privacy Policy</h2>
                  <p className="mb-4 font-light">
                    We may update this Privacy Policy from time to time. We will notify you of any material changes by:
                  </p>
                  <ul className="list-disc list-inside mb-4 space-y-2 font-light">
                    <li>Posting the updated policy on our website</li>
                    <li>Sending email notifications to registered users</li>
                    <li>Displaying prominent notices in our app</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 tracking-wide">11. Contact Us</h2>
                  <p className="mb-4 font-light">
                    If you have questions about this Privacy Policy or our data practices, contact us:
                  </p>
                  <ul className="list-none mb-4 space-y-2 font-light">
                    <li><strong>Email:</strong> privacy@seoulsister.com</li>
                    <li><strong>Support:</strong> <Link href="/support" className="text-luxury-gold hover:text-luxury-gold/80">Submit a support ticket</Link></li>
                    <li><strong>WhatsApp:</strong> +1 (234) 567-8900</li>
                    <li><strong>Data Protection Officer:</strong> dpo@seoulsister.com</li>
                  </ul>
                </section>

              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/terms"
              className="text-luxury-gold hover:text-luxury-gold/80 font-medium underline"
            >
              View Terms of Service →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}