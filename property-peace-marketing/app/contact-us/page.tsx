import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowRight, FiCalendar, FiCheckCircle, FiClock, FiHelpCircle, FiMail, FiMessageSquare } from "react-icons/fi";
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/contact-us/', {
  title: "Contact Us | Property Peace",
  description:
    "Get in touch with Property Peace support at support@propertypeace.io for product questions, billing help, demo requests, and landlord software support.",
  keywords:
    "contact Property Peace, property management support, landlord software support, customer support",
  openGraph: {
    title: "Contact Us | Property Peace",
    description:
      "Need help with Property Peace? Contact our support team or book a walkthrough.",
    type: "website",
  },
});

const supportTopics = [
  "Product questions before signing up",
  "Billing, plan, or account help",
  "Walkthroughs for 1–50 unit landlords",
  "Bug reports or setup questions",
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden px-4 pt-32 pb-20 sm:px-6 md:pt-40 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#f4f8fc] to-white" />
        <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-200/20 blur-3xl" />

        <div className="relative mx-auto max-w-5xl">
          {/* Header Section */}
          <div className="mx-auto mb-14 max-w-3xl text-center md:mb-16">
            <p
              className="mb-4 text-xs font-bold uppercase tracking-[0.26em] text-primary-main"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Contact Property Peace
            </p>
            <h1
              className="text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-primary-main md:text-5xl lg:text-6xl"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Get support without the runaround.
            </h1>
            <p
              className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#737373] md:text-xl"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Have a product question, billing issue, or want a quick walkthrough? Send us a note and we&apos;ll help you get back to a calmer landlord workflow.
            </p>
          </div>

          {/* Contact Info Cards */}
          <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr] md:items-stretch">
            <div className="rounded-3xl border border-[#dce8f3] bg-white p-8 shadow-[0_20px_70px_rgba(4,34,56,0.08)] md:p-10">
              <div className="mb-8 flex items-start gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary-main/10 text-primary-main">
                  <FiMail className="h-7 w-7" />
                </div>
                <div>
                  <h2
                    className="text-2xl font-semibold text-primary-main"
                    style={{ fontFamily: '"Poppins", sans-serif' }}
                  >
                    Email our support team
                  </h2>
                  <p
                    className="mt-2 text-sm leading-6 text-[#737373]"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    Best for account help, product questions, feedback, billing, or anything that needs a thoughtful answer.
                  </p>
                </div>
              </div>

              <a
                href="mailto:support@propertypeace.io"
                className="group inline-flex max-w-full items-center gap-3 rounded-none bg-[#f4f8fc] px-4 py-3 text-base font-semibold text-primary-main ring-1 ring-[#dce8f3] transition-all hover:-translate-y-0.5 hover:bg-white hover:text-primary-hover hover:shadow-lg hover:shadow-blue-900/10 sm:text-lg"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                <span className="truncate">support@propertypeace.io</span>
                <FiArrowRight className="h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-1" />
              </a>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {supportTopics.map((topic) => (
                  <div key={topic} className="flex items-start gap-3 rounded-2xl bg-[#f7fafc] p-4 ring-1 ring-[#e6eef6]">
                    <FiCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-main" />
                    <p className="text-sm leading-5 text-[#405a70]" style={{ fontFamily: '"Inter", sans-serif' }}>
                      {topic}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-[#E5E5E5] bg-[#F5F5F5] p-8 shadow-sm">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-main shadow-sm">
                  <FiClock className="h-6 w-6" />
                </div>
                <h2
                  className="text-xl font-semibold text-primary-main"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  Support hours
                </h2>
                <p
                  className="mt-3 text-2xl font-semibold text-primary-main"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  24/7 inbox monitoring
                </p>
                <p
                  className="mt-3 text-sm leading-6 text-[#737373]"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  We monitor incoming support emails around the clock and aim to respond within 24 hours.
                </p>
              </div>

              <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-[#eef6ff] to-white p-8 shadow-sm">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-main shadow-sm">
                  <FiCalendar className="h-6 w-6" />
                </div>
                <h2
                  className="text-xl font-semibold text-primary-main"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  Prefer a walkthrough?
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#737373]" style={{ fontFamily: '"Inter", sans-serif' }}>
                  If you want to see how Property Peace fits your rentals, book a demo instead of writing a long email.
                </p>
                <Link
                  href="/demo"
                  className="mt-5 inline-flex items-center gap-2 rounded-none bg-primary-main px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-main hover:shadow-lg hover:shadow-blue-900/15"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  Book a demo
                  <FiArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-10 overflow-hidden rounded-3xl border border-[#E5E5E5] bg-[#F5F5F5] p-8 text-center shadow-sm md:p-12">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary-main shadow-sm">
              <FiMessageSquare className="h-7 w-7" />
            </div>
            <h2
              className="text-2xl font-bold text-primary-main md:text-3xl"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Ready to get organized?
            </h2>
            <p
              className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[#737373]"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Start free if you&apos;re ready to try it now, or email us if you want help choosing the right setup for your portfolio.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="https://app.propertypeace.io/register"
                className="inline-flex items-center justify-center gap-2 rounded-none bg-primary-main px-8 py-4 font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg hover:shadow-blue-900/15"
                style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
              >
                Start free
                <FiArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/help-center"
                className="inline-flex items-center justify-center gap-2 rounded-none border border-[#dce8f3] bg-white px-8 py-4 font-semibold text-primary-main transition-all hover:-translate-y-0.5 hover:border-primary-main/30 hover:text-primary-main hover:shadow-lg hover:shadow-blue-900/10"
                style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
              >
                <FiHelpCircle className="h-4 w-4" />
                Visit help center
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
