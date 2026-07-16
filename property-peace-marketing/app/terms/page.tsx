import type { Metadata } from "next";
import Link from "next/link";
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/terms/', {
  title: "Terms of Use | Property Peace",
  description:
    "Property Peace terms of use. Read the terms and conditions governing your use of our property management software and related services.",
  keywords: "terms of use, Property Peace terms, property management software terms, terms and conditions",
  openGraph: {
    title: "Terms of Use | Property Peace",
    description: "Terms and conditions governing your use of Property Peace.",
    type: "website",
  },
});

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        {/* Header Section */}
        <div className="mb-16">
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-main mb-6"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Property Peace: Terms of Use for Property Management Software
          </h1>
          <p
            className="text-lg text-[#737373]"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Last updated: February 2026
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
              Agreement to Terms
            </h2>
            <p className="text-[#737373] leading-relaxed">
              By accessing or using Property Peace (&quot;the Service&quot;) operated by Brownstone Hub LLC (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), you agree to be bound by these Terms of Use. If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Use of Service
            </h2>
            <p className="text-[#737373] leading-relaxed mb-4">
              You agree to use the Service only for lawful purposes and in accordance with these Terms. You must not:
            </p>
            <ul className="list-disc pl-6 text-[#737373] space-y-2">
              <li>Use the Service in any way that violates applicable laws or regulations</li>
              <li>Attempt to gain unauthorized access to any part of the Service or related systems</li>
              <li>Transmit any viruses, malware, or other harmful code</li>
              <li>Use the Service to harass, abuse, or harm another person</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
            </ul>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Account Responsibility
            </h2>
            <p className="text-[#737373] leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Intellectual Property
            </h2>
            <p className="text-[#737373] leading-relaxed">
              The Service and its original content, features, and functionality are owned by Brownstone Hub LLC and are protected by international copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of our Service without prior written permission.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Limitation of Liability
            </h2>
            <p className="text-[#737373] leading-relaxed">
              To the maximum extent permitted by law, Property Peace and Brownstone Hub LLC shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service. Our total liability shall not exceed the amount you paid us in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Termination
            </h2>
            <p className="text-[#737373] leading-relaxed">
              We may terminate or suspend your access to the Service immediately, without prior notice, for any reason, including breach of these Terms. Upon termination, your right to use the Service will cease immediately.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Changes to Terms
            </h2>
            <p className="text-[#737373] leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify you of any material changes by posting the new Terms on this page and updating the &quot;Last updated&quot; date. Your continued use of the Service after such changes constitutes acceptance of the new Terms.
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
              If you have questions about these Terms of Use, please contact us at{" "}
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
