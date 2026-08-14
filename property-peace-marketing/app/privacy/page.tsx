import type { Metadata } from "next";
import Link from "next/link";
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/privacy/', {
  title: "Privacy Policy | Property Peace",
  description:
    "Property Peace privacy policy. Learn how we collect, use, and protect your information when you use our property management software.",
  keywords: "privacy policy, Property Peace privacy, property management software privacy, data protection",
  openGraph: {
    title: "Privacy Policy | Property Peace",
    description: "Learn how Property Peace collects, uses, and protects your information.",
    type: "website",
  },
});

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        {/* Header Section */}
        <div className="mb-16">
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-main mb-6"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Privacy Policy
          </h1>
          <p
            className="text-lg text-[#737373]"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Last updated: August 2026
          </p>
        </div>

        {/* Content */}
        <div
          className="prose prose-lg max-w-none space-y-8"
          style={{ fontFamily: '"Inter", sans-serif' }}
        >
          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Introduction
            </h2>
            <p className="text-[#737373] leading-relaxed">
              Property Peace (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our property management software and related services.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Information We Collect
            </h2>
            <p className="text-[#737373] leading-relaxed mb-4">
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 text-[#737373] space-y-2">
              <li>Account information (name, email address, password)</li>
              <li>Property and tenant information you enter into the platform</li>
              <li>Payment information (processed securely through Stripe)</li>
              <li>Communications and support requests</li>
              <li>Lease documents and related files</li>
            </ul>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              How We Use Your Information
            </h2>
            <p className="text-[#737373] leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 text-[#737373] space-y-2">
              <li>Provide, maintain, and improve our property management software</li>
              <li>Process payments and send related communications</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, investigate, and prevent fraudulent transactions</li>
            </ul>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Data Storage and Security
            </h2>
            <p className="text-[#737373] leading-relaxed">
              We store your data on secure cloud infrastructure (Microsoft Azure) with industry-standard encryption. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Third-Party Services
            </h2>
            <p className="text-[#737373] leading-relaxed mb-4">
              We use trusted third-party services to operate our platform:
            </p>
            <ul className="list-disc pl-6 text-[#737373] space-y-2">
              <li><strong>Stripe</strong> — A payment processing provider used only if and when online rent processing is operationally enabled. Online rent processing is currently unavailable.</li>
              <li><strong>DocuSign</strong> — A document signing provider used only if and when integrated digital lease signing is operationally enabled. Integrated digital lease signing is currently unavailable.</li>
              <li><strong>Google</strong> — Optional authentication, aggregate analytics, and advertising measurement. Google storage is denied by default and is granted only after you accept analytics cookies.</li>
              <li><strong>Plausible Analytics</strong> — Privacy-focused aggregate measurement of marketing-site traffic and selected actions, without setting analytics cookies or collecting form contents.</li>
              <li><strong>Microsoft Clarity</strong> — Optional session insights and heatmaps that load only after you accept analytics cookies. Sensitive form fields are not intentionally included in analytics events.</li>
            </ul>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Cookies and Similar Technologies
            </h2>
            <p className="text-[#737373] leading-relaxed">
              We use essential storage to operate the website and remember your privacy choice. Our marketing site may use privacy-focused, cookie-free aggregate analytics automatically. Google Analytics, Google advertising storage, and Microsoft Clarity session insights remain denied or unloaded unless you choose “Accept all.” You can decline optional analytics using the cookie notice or clear your saved choice through your browser storage settings.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Your Rights
            </h2>
            <p className="text-[#737373] leading-relaxed mb-4">
              Depending on your location, you may have the right to:
            </p>
            <ul className="list-disc pl-6 text-[#737373] space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal information</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability</li>
            </ul>
            <p className="text-[#737373] leading-relaxed mt-4">
              To exercise these rights, contact us at{" "}
              <a href="mailto:support@propertypeace.io" className="text-primary-main hover:text-primary-hover transition-colors">
                support@propertypeace.io
              </a>
              .
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Changes to This Policy
            </h2>
            <p className="text-[#737373] leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the &quot;Last updated&quot; date. We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Contact Us
            </h2>
            <p className="text-[#737373] leading-relaxed">
              If you have questions about this Privacy Policy or our practices, please contact us at{" "}
              <a href="mailto:support@propertypeace.io" className="text-primary-main hover:text-primary-hover transition-colors">
                support@propertypeace.io
              </a>
              .
            </p>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center bg-[#F5F5F5] rounded-2xl p-8 md:p-12 border border-[#E5E5E5]">
          <h2
            className="text-2xl md:text-3xl font-bold text-primary-main mb-4"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Ready to Get Started?
          </h2>
          <p
            className="text-lg text-[#737373] max-w-xl mx-auto mb-6"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Sign up free and start managing your properties with Property Peace today.
          </p>
          <Link
            href="https://app.propertypeace.io/register"
            className="inline-flex items-center justify-center px-8 py-4 bg-primary-main text-white rounded-none font-semibold hover:bg-primary-hover transition-colors"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
