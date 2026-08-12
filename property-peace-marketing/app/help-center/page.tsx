import type { Metadata } from "next";
import Link from "next/link";
import { FiMail, FiCalendar, FiBook, FiZap } from "react-icons/fi";
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/help-center/', {
  title: "Help Center | Property Peace",
  description:
    "Property Peace help center. Find answers to frequently asked questions, get support, and learn how to use our property management software.",
  keywords: "help center, Property Peace help, property management software support, landlord software FAQ",
  openGraph: {
    title: "Help Center | Property Peace",
    description: "Get help with Property Peace property management software.",
    type: "website",
  },
});

const faqs = [
  {
    question: "What is Property Peace?",
    answer:
      "Property Peace is property management software designed for independent landlords. It helps you track rent records, manage maintenance, organize leases, and handle tenant communication—all in one place.",
  },
  {
    question: "Is Property Peace free?",
    answer:
      "Property Peace has a free plan for up to 5 units, with no credit card required to get started. Paid plans add features and capacity; check the pricing page for the current plan details.",
  },
  {
    question: "Can tenants pay rent online through Property Peace?",
    answer:
      "Not currently. Online payment processing is on the roadmap. Today, landlords can record payments, track overdue balances and late fees, and organize rent reminders in Property Peace.",
  },
  {
    question: "Can I manage multiple properties?",
    answer:
      "Yes. The permanent Free plan supports up to 5 total units, while Premium supports unlimited units. Both plans organize properties, units, tenants, leases, maintenance, and financial records in one workspace; advanced reporting depends on plan entitlement and feature readiness.",
  },
  {
    question: "How do I get support?",
    answer:
      "Contact us at support@propertypeace.io for help. Response times vary by request volume and issue complexity.",
  },
];

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        {/* Header Section */}
        <div className="text-center mb-16">
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-main mb-6"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Help Center
          </h1>
          <p
            className="text-lg md:text-xl text-[#737373] max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Find answers, get support, and learn how to make the most of Property Peace.
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <Link
            href="/contact-us"
            className="flex items-start space-x-4 p-6 bg-[#F5F5F5] border border-[#E5E5E5] rounded-none hover:border-primary-main/30 transition-colors"
          >
            <div className="w-12 h-12 bg-primary-main/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <FiMail className="w-6 h-6 text-primary-main" />
            </div>
            <div>
              <h2
                className="text-xl font-bold text-primary-main mb-2"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Contact Us
              </h2>
              <p className="text-[#737373] text-sm" style={{ fontFamily: '"Inter", sans-serif' }}>
                Email support is available for account help and product questions.
              </p>
            </div>
          </Link>
          <Link
            href="/demo"
            className="flex items-start space-x-4 p-6 bg-[#F5F5F5] border border-[#E5E5E5] rounded-none hover:border-primary-main/30 transition-colors"
          >
            <div className="w-12 h-12 bg-primary-main/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <FiCalendar className="w-6 h-6 text-primary-main" />
            </div>
            <div>
              <h2
                className="text-xl font-bold text-primary-main mb-2"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Watch Demo
              </h2>
              <p className="text-[#737373] text-sm" style={{ fontFamily: '"Inter", sans-serif' }}>
                Schedule a personalized demo to see Property Peace in action.
              </p>
            </div>
          </Link>
          <Link
            href="/blog"
            className="flex items-start space-x-4 p-6 bg-[#F5F5F5] border border-[#E5E5E5] rounded-none hover:border-primary-main/30 transition-colors"
          >
            <div className="w-12 h-12 bg-primary-main/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <FiBook className="w-6 h-6 text-primary-main" />
            </div>
            <div>
              <h2
                className="text-xl font-bold text-primary-main mb-2"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Blog
              </h2>
              <p className="text-[#737373] text-sm" style={{ fontFamily: '"Inter", sans-serif' }}>
                Tips, guides, and insights for landlords and property managers.
              </p>
            </div>
          </Link>
          <a
            href="https://app.propertypeace.io/register"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start space-x-4 p-6 bg-[#F5F5F5] border border-[#E5E5E5] rounded-none hover:border-primary-main/30 transition-colors"
          >
            <div className="w-12 h-12 bg-primary-main/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <FiZap className="w-6 h-6 text-primary-main" />
            </div>
            <div>
              <h2
                className="text-xl font-bold text-primary-main mb-2"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Get Started
              </h2>
              <p className="text-[#737373] text-sm" style={{ fontFamily: '"Inter", sans-serif' }}>
                Create a Free account. No credit card required.
              </p>
            </div>
          </a>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <h2
            className="text-2xl md:text-3xl font-bold text-primary-main mb-8"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl p-6"
              >
                <h3
                  className="text-lg font-semibold text-primary-main mb-3"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  {faq.question}
                </h3>
                <p
                  className="text-[#737373] leading-relaxed"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-[#F5F5F5] rounded-2xl p-8 md:p-12 border border-[#E5E5E5]">
          <h2
            className="text-2xl md:text-3xl font-bold text-primary-main mb-4"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Still Have Questions?
          </h2>
          <p
            className="text-lg text-[#737373] max-w-xl mx-auto mb-6"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Reach out to our team. We&apos;re here to help.
          </p>
          <Link
            href="/contact-us"
            className="inline-flex items-center justify-center px-8 py-4 bg-primary-main text-white rounded-none font-semibold hover:bg-primary-hover transition-colors"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
