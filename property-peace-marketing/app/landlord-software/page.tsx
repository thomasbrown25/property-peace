import type { Metadata } from "next";
import Link from 'next/link';
import { FiCheck, FiArrowRight } from 'react-icons/fi';
import StructuredData from '@/components/SEO/StructuredData';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/landlord-software/', {
  title: "Best Landlord Software for Independent Rental Owners",
  description: "The all-in-one landlord software for independent owners. Automate rent, track expenses, and manage tenants with ease. Start for free.",
  keywords: "landlord software, landlord management software, property management software for landlords, rental property management software, landlord tools",
  openGraph: {
    title: "Best Landlord Software for Independent Rental Owners",
    description: "The all-in-one landlord software for independent owners. Automate rent, track expenses, and manage tenants with ease. Start for free.",
    type: 'website',
  },
});

const features = [
  'Rent ledger, overdue balances, late fees, and reminders',
  'Tenant portal for messages, documents, and requests',
  'Maintenance request tracking with photo uploads',
  'Lease document and renewal management',
  'Financial reporting and tax-ready exports',
  'Property and unit management',
  'Real-time tenant communication',
  'Document storage and organization',
  'Automated lease renewal reminders',
  'Mobile access from any device',
];

export default function LandlordSoftwarePage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Property Peace - Landlord Software',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'Landlord software for 1–50 units. Manage rent, tenants, leases, maintenance, expenses, and documents in one calm dashboard. Start free.',
    featureList: features,
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-[#F5F5F5] to-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-main mb-6"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            All-in-One Landlord Software for Small Portfolios
          </h1>
          <p
            className="text-lg md:text-xl text-[#737373] mb-8 max-w-2xl mx-auto"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Complete property management software designed specifically for landlords managing 1-50 units. Streamline rent tracking, tenant management, and maintenance workflows—all in one platform. Online payment processing is not currently available.
          </p>
          <Link
            href="https://app.propertypeace.io/register"
            className="inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-none font-semibold transition-all duration-300 hover:from-green-600 hover:to-green-700 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(34,197,94,0.25)]"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            <span>Get Started</span>
            <FiArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-12 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Everything You Need in Landlord Software
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start space-x-3">
                <FiCheck className="w-6 h-6 text-[#217eff] flex-shrink-0 mt-1" />
                <p
                  className="text-lg text-primary-main"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  {feature}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#F5F5F5]">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-12 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Why Choose Property Peace Landlord Software?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Designed for Small Landlords
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Unlike enterprise solutions, Property Peace is built specifically for landlords managing 1-50 units. No unnecessary complexity, just the features you need.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Affordable Pricing
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Free for up to 2 units. No per-unit fees, no setup costs. Premium features like LeaseShield available on higher plans.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Real-Time Updates
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                See recorded rent status, maintenance requests, and messages in one place. Built with modern technology for speed and reliability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center bg-[#061e35] rounded-2xl p-12 text-white">
          <h2
            className="text-3xl md:text-4xl font-bold mb-6"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Ready to Transform Your Property Management?
          </h2>
          <p
            className="text-xl text-[#E5E5E5] mb-8"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Free for up to 2 units. Simple, flat pricing — no per-unit fees. Cancel anytime.
          </p>
          <Link
            href="https://app.propertypeace.io/register"
            className="inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-none font-semibold transition-all duration-300 hover:from-green-600 hover:to-green-700 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(34,197,94,0.25)]"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            <span>Get Started</span>
            <FiArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Related Links */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-t border-[#E5E5E5]">
        <div className="max-w-6xl mx-auto">
          <p
            className="text-center text-[#737373] mb-4"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Learn more about property management:
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/features" className="inline-flex min-h-11 items-center text-[#217eff] hover:underline">Features</Link>
            <Link href="/pricing" className="inline-flex min-h-11 items-center text-[#217eff] hover:underline">Pricing</Link>
            <Link href="/blog" className="inline-flex min-h-11 items-center text-[#217eff] hover:underline">Blog</Link>
            <Link href="/property-management-app" className="inline-flex min-h-11 items-center text-[#217eff] hover:underline">Property Management App</Link>
            <Link href="/rental-management-software" className="inline-flex min-h-11 items-center text-[#217eff] hover:underline">Rental Management Software</Link>
          </div>
        </div>
      </section>

      <StructuredData data={structuredData} />
    </div>
  );
}
