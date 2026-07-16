import type { Metadata } from "next";
import Link from 'next/link';
import { FiCheck, FiArrowRight } from 'react-icons/fi';
import StructuredData from '@/components/SEO/StructuredData';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/small-landlord-tools/', {
  title: "Small Landlord Tools for 1–50 Rental Units | Property Peace",
  description: "Tools for small landlords to organize rent, tenants, leases, maintenance, expenses, and documents. Built for 1–50 rental units. Start free.",
  keywords: "small landlord tools, property management tools for small landlords, landlord software for small portfolios, small property management software, tools for small landlords",
  openGraph: {
    title: "Small Landlord Tools for 1–50 Rental Units | Property Peace",
    description: "Tools for small landlords to organize rent, tenants, leases, maintenance, expenses, and documents.",
    type: 'website',
  },
});

const tools = [
  'Online rent collection system',
  'Tenant management database',
  'Maintenance request tracker',
  'Digital lease management',
  'Financial reporting tools',
  'Document storage system',
  'Automated reminder system',
  'Tenant portal',
  'Mobile property management',
  'Tax-ready financial reports',
];

export default function SmallLandlordToolsPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Property Peace - Small Landlord Tools',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'Essential tools for small landlords managing 1–50 units. Organize rent, tenants, leases, maintenance, expenses, and documents. Start free.',
    featureList: tools,
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
            Essential Tools for Small Landlords
          </h1>
          <p
            className="text-lg md:text-xl text-[#737373] mb-8 max-w-2xl mx-auto"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Property management tools designed specifically for small landlords managing 1-50 units. Affordable, easy to use, and packed with everything you need to manage your rental properties efficiently.
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

      {/* Tools Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-12 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            All the Tools You Need in One Platform
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {tools.map((tool, index) => (
              <div key={index} className="flex items-start space-x-3">
                <FiCheck className="w-6 h-6 text-[#217eff] flex-shrink-0 mt-1" />
                <p
                  className="text-lg text-primary-main"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  {tool}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Small Landlords Need These Tools */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#F5F5F5]">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-12 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Why Small Landlords Need These Tools
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Save Time
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Small landlords often manage properties part-time or alongside other work. These tools automate routine tasks, saving 5-10 hours per month that you can spend on growing your portfolio or enjoying your life.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Reduce Errors
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Manual tracking with spreadsheets leads to mistakes—missed rent payments, forgotten maintenance requests, lost documents. These tools prevent errors and keep everything organized.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Look Professional
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Professional tools help you present yourself as a serious landlord. Online rent collection, organized communication, and quick responses improve tenant relationships and attract better tenants.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Scale Efficiently
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                As you add properties, good tools become essential. Start with the right systems from the beginning, and scaling from 5 to 15 to 50 units becomes manageable instead of overwhelming.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Affordable Pricing */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-6"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Affordable Tools for Small Landlords
          </h2>
          <p
            className="text-lg text-[#737373] mb-8"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Unlike enterprise solutions that cost hundreds per month, Property Peace is designed for small landlords. Free for up to 2 units — no credit card required. Premium features like LeaseShield are available on higher plans.
          </p>
          <div className="bg-[#F5F5F5] rounded-lg p-8 border border-[#E5E5E5]">
            <p
              className="text-2xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Get Started
            </p>
            <p
              className="text-[#737373] mb-6"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Free for up to 2 units. No credit card required. See how these tools can transform your property management.
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
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#061e35]">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2
            className="text-3xl md:text-4xl font-bold mb-6"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Ready to Upgrade Your Property Management?
          </h2>
          <p
            className="text-xl text-[#E5E5E5] mb-8"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Join thousands of small landlords who use Property Peace to manage their rental properties more efficiently.
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
            <Link href="/property-management-app" className="text-[#217eff] hover:underline">Property Management App</Link>
          </div>
        </div>
      </section>

      <StructuredData data={structuredData} />
    </div>
  );
}
