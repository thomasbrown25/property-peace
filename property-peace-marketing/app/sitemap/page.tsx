import type { Metadata } from "next";
import Link from "next/link";
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/sitemap/', {
  title: "Sitemap | Property Peace",
  description:
    "Property Peace sitemap. Find all pages on our property management software website including features, pricing, blog, and more.",
  keywords: "sitemap, Property Peace, property management software, website map",
  openGraph: {
    title: "Sitemap | Property Peace",
    description: "Browse all pages on the Property Peace website.",
    type: "website",
  },
});

const sitemapSections = [
  {
    title: "Explore the Property Peace Platform Dashboard",
    links: [
      { href: "/", label: "Home" },
      { href: "/listings", label: "Rental Listing Software" },
      { href: "/features", label: "All Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/resources", label: "Landlord Resource Center" },
      { href: "/blog", label: "Blog" },
      { href: "/contact-us", label: "Contact" },
      { href: "/demo", label: "Watch Demo" },
    ],
  },
  {
    title: "Maintenance Requests",
    links: [
      { href: "/maintenance/ai-maintenance", label: "Percy Pilot Maintenance Management" },
      { href: "/maintenance/in-app-messaging", label: "In-App Messaging" },
    ],
  },
  {
    title: "Lease Agreements",
    links: [
      { href: "/lease/ai-lease-creation", label: "Percy Pilot Lease Creation" },
      { href: "/lease/e-sign-docusign", label: "E-Signature Roadmap" },
      { href: "/lease/online-condition-reports", label: "Online Condition Reports" },
    ],
  },
  {
    title: "Rent Collection",
    links: [
      { href: "/rent/accounting", label: "Accounting" },
      { href: "/rent/custom-late-fees", label: "Custom Late Fees" },
      { href: "/rent/expense-tracking", label: "Expense Tracking" },
      { href: "/rent/rent-reporting", label: "Rent Reporting" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/resources", label: "Landlord Resource Center" },
      { href: "/blog", label: "All Landlord Articles" },
      { href: "/help-center", label: "Help Center" },
      { href: "/faq", label: "Frequently Asked Questions" },
      { href: "/landlord-software", label: "Landlord Software" },
      { href: "/free-landlord-software", label: "Free Landlord Software" },
      { href: "/property-management-software-for-small-landlords", label: "Property Management Software for Small Landlords" },
      { href: "/property-management-app", label: "Property Management App" },
      { href: "/rental-management-software", label: "Rental Management Software" },
      { href: "/small-landlord-tools", label: "Small Landlord Tools" },
      { href: "/property-management-spreadsheet-alternative", label: "Spreadsheet Alternative" },
      { href: "/landlord-accounting-software", label: "Landlord Accounting Software" },
      { href: "/rent-collection-software-for-landlords", label: "Rent Collection Software for Landlords" },
      { href: "/maintenance-request-software-for-landlords", label: "Maintenance Request Software for Landlords" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Use" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
];

export default function SitemapPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        {/* Header Section */}
        <div className="mb-16">
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-main mb-6"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Explore Property Peace: A Sitemap of Our Management Tools
          </h1>
          <p
            className="text-lg text-[#737373] max-w-2xl"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Browse all pages on the Property Peace website. Find features, pricing, resources, and more.
          </p>
        </div>

        {/* Sitemap Sections */}
        <div className="space-y-12">
          {sitemapSections.map((section) => (
            <section key={section.title}>
              <h2
                className="text-xl font-bold text-primary-main mb-4 pb-2 border-b border-[#E5E5E5]"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                {section.title}
              </h2>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-primary-main hover:text-primary-hover transition-colors"
                      style={{ fontFamily: '"Inter", sans-serif' }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
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
