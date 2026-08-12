import type { Metadata } from "next";
import Link from 'next/link';
import { FiCheck, FiArrowRight } from 'react-icons/fi';
import StructuredData from '@/components/SEO/StructuredData';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/rental-management-software/', {
  title: "Rental Management Software for Independent Landlords | Property Peace",
  description: "Rental management software for independent landlords. Organize tenants, rent records, maintenance, leases, expenses, and reports. Online payments are not currently available.",
  keywords: "rental management software, rental property management software, rental management system, property rental software, rental management tools",
  openGraph: {
    title: "Rental Management Software for Independent Landlords | Property Peace",
    description: "Organize tenants, rent records, maintenance, lease documents, expenses, and reports.",
    type: 'website',
  },
});

const rentalFeatures = [
  'Complete tenant management system',
  'Rent ledger, overdue balances, and reminders',
  'Maintenance request management',
  'Lease document and renewal management',
  'Financial reporting and analytics',
  'Property and unit organization',
  'Document storage and management',
  'Automated reminders and notifications',
  'Tenant portal for self-service',
  'Mobile access from any device',
];

export default function RentalManagementSoftwarePage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Property Peace - Rental Management Software',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'Rental management software for landlords to manage tenants, record rent, track maintenance, organize lease documents, and generate financial reports. Online payment processing is not currently available.',
    featureList: rentalFeatures,
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
            Complete Rental Management Software
          </h1>
          <p
            className="text-lg md:text-xl text-[#737373] mb-8 max-w-2xl mx-auto"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Keep tenant management, rent records, maintenance tracking, lease documents, and financial reporting in one platform. Online payment processing and integrated e-signature are not currently available.
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

      <section className="px-4 py-12 sm:px-6 lg:px-8"><div className="max-w-4xl mx-auto border-l-4 border-blue-600 bg-blue-50/60 p-6"><h2 className="text-2xl font-bold text-primary-main">Organized rental workflows give Percy supported context</h2><p className="mt-3 leading-7 text-[#405a70]">Structured lease, recorded rent, maintenance, and tenant-conversation records let landlords open Percy Pilot for a current review of supported context. Percy is read-only and does not take actions or monitor continuously.</p></div></section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-12 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Everything You Need for Rental Management
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {rentalFeatures.map((feature, index) => (
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
            Why Property Peace Rental Management Software?
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                All-in-One Solution
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                No need for multiple tools or spreadsheets. Everything you need for rental management is in one platform—from tenant onboarding to financial reporting.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Automated Workflows
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Automate rent reminders, lease renewal alerts, and maintenance follow-ups. Set it once and let the system work for you.
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
                See recorded rent status, maintenance requests, and tenant messages together as records are updated.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Designed for Your Scale
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Built specifically for landlords managing 1-50 units. No enterprise bloat, just the features you need at a price you can afford.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-12 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Perfect for All Types of Rental Properties
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Single-Family Homes
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Manage individual rental houses with complete tenant and lease management, maintenance tracking, and financial reporting.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Multi-Unit Properties
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Perfect for small apartment buildings and duplexes. Track each unit separately while managing the property as a whole.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Property Portfolios
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Manage multiple properties from one dashboard. Track performance, generate portfolio-wide reports, and stay organized.
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
            Start Managing Your Rentals More Efficiently
          </h2>
          <p
            className="text-xl text-[#E5E5E5] mb-8"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Get started with Property Peace rental management software free. No credit card required. Experience the difference comprehensive rental management software can make.
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
            Learn more:
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/features" className="text-[#217eff] hover:underline">Features</Link>
            <Link href="/landlord-software" className="text-[#217eff] hover:underline">Landlord Software</Link>
            <Link href="/blog" className="text-[#217eff] hover:underline">Blog</Link>
            <Link href="/small-landlord-tools" className="text-[#217eff] hover:underline">Small Landlord Tools</Link>
          </div>
        </div>
      </section>

      <StructuredData data={structuredData} />
    </div>
  );
}
