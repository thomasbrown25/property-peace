import type { Metadata } from "next";
import Link from 'next/link';
import { FiCheck, FiArrowRight, FiSmartphone } from 'react-icons/fi';
import StructuredData from '@/components/SEO/StructuredData';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/property-management-app/', {
  title: "Property Management App for Small Landlords | Property Peace",
  description: "A mobile-friendly property management app for small landlords managing 1–50 units. Track rent, tenants, maintenance, leases, and expenses. Start free.",
  keywords: "property management app, best property management app, landlord app, property management mobile app, rental property management app",
  openGraph: {
    title: "Property Management App for Small Landlords | Property Peace",
    description: "Mobile-friendly landlord software for rent, tenants, maintenance, leases, and expenses.",
    type: 'website',
  },
});

const appFeatures = [
  'Mobile-responsive design works on any device',
  'iOS and Android compatible',
  'Real-time updates without page refreshes',
  'Access all features from your phone',
  'Push notifications for important updates',
  'Quick actions for common tasks',
  'Offline access to key information',
  'Secure cloud storage and backups',
];

export default function PropertyManagementAppPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'Property Peace - Property Management App',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'Mobile-friendly property management software for landlords. Review recorded rent status, tenant details, maintenance, and lease records from your phone. Online rent payments are included with Free. Organizations request access, complete secure payment setup, and pass account review before tenants can pay online.',
    featureList: appFeatures,
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-[#F5F5F5] to-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <FiSmartphone className="w-16 h-16 text-[#217eff]" />
          </div>
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-main mb-6"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Best Property Management App for Landlords
          </h1>
          <p
            className="text-lg md:text-xl text-[#737373] mb-8 max-w-2xl mx-auto"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Manage your rental properties from anywhere with Property Peace's mobile-friendly property management app. Perfect for landlords who need flexibility and convenience.
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

      {/* Mobile Features */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-12 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Manage Properties from Your Phone
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {appFeatures.map((feature, index) => (
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

      {/* Use Cases */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#F5F5F5]">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-12 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Perfect for On-the-Go Property Management
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Check Rent Status
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Review recorded rent status from your phone, including paid and overdue ledger entries. Online rent payments are included with Free. Organizations request access, complete secure payment setup, and pass account review before tenants can pay online.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Respond to Maintenance
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Receive maintenance requests instantly and respond quickly, even when you're away from your desk.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-3"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Access Property Details
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                View property information, tenant details, lease terms, and documents—all from your mobile device.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Mobile Matters */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-6 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Why a Mobile Property Management App Matters
          </h2>
          <div className="space-y-6">
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-2"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Faster Response Times
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Respond to tenant requests and maintenance issues immediately, even when you're not at your computer. This improves tenant satisfaction and prevents small issues from becoming big problems.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-2"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Better Work-Life Balance
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Manage your properties without being tied to your desk. Check rent status, respond to messages, and handle urgent issues from anywhere.
              </p>
            </div>
            <div>
              <h3
                className="text-xl font-bold text-primary-main mb-2"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Professional Image
              </h3>
              <p
                className="text-[#737373]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Quick responses and easy access to information make you look more professional and organized to your tenants.
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
            Start Managing Properties from Your Phone Today
          </h2>
          <p
            className="text-xl text-[#E5E5E5] mb-8"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Get started with Property Peace free. No credit card required. Experience mobile property management at its best.
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
