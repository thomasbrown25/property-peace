'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FiInstagram, FiLinkedin, FiYoutube } from 'react-icons/fi';
import { SiX, SiTiktok } from 'react-icons/si';

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#061e35] text-white">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-8">
          {/* Logo & Social - Left Column */}
          <div className="col-span-2 md:col-span-1 order-first text-center lg:text-left">
            <Link href="/" className="inline-block mb-4">
              <Image
                src="/images/logos/property-peace.png"
                alt="Property Peace logo: house, bird, and leaf representing simplified property management software."
                width={220}
                height={64}
                className="h-auto w-44 max-w-full drop-shadow-[0_10px_24px_rgba(0,0,0,0.25)]"
                priority={false}
              />
            </Link>
            <p className="text-white/90 text-sm mb-4" style={{ fontFamily: '"Inter", sans-serif' }}>
              Built for landlords with 1–50 units.
            </p>
            <p className="text-white/80 text-sm mb-4">Find on Social Media</p>
            <div className="flex space-x-3 justify-center lg:justify-start">
              <a
                href="https://x.com/Thomasbrown1125"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-none bg-white/5 hover:bg-white/20 transition-colors"
                aria-label="Follow us on X"
              >
                <SiX className="text-white w-4 h-4" />
              </a>
              <a
                href="https://www.instagram.com/propertypeace.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-none bg-white/5 hover:bg-white/20 transition-colors"
                aria-label="Follow us on Instagram"
              >
                <FiInstagram className="text-white w-4 h-4" />
              </a>
              <a
                href="https://www.linkedin.com/company/property-peace"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-none bg-white/5 hover:bg-white/20 transition-colors"
                aria-label="Connect with us on LinkedIn"
              >
                <FiLinkedin className="text-white w-4 h-4" />
              </a>
              <a
                href="https://www.youtube.com/@property_peace"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-none bg-white/5 hover:bg-white/20 transition-colors"
                aria-label="Subscribe on YouTube"
              >
                <FiYoutube className="text-white w-4 h-4" />
              </a>
              <a
                href="https://www.tiktok.com/@propertypeace.io"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-none bg-white/5 hover:bg-white/20 transition-colors"
                aria-label="Follow us on TikTok"
              >
                <SiTiktok className="text-white w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Maintenance Requests */}
          <div className="text-center lg:text-left">
            <h3 className="text-[#22c55e] font-bold text-sm mb-4">Maintenance Requests</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/maintenance/ai-maintenance" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Percy AI Maintenance
                </Link>
              </li>
              <li>
                <Link href="/maintenance-request-software-for-landlords" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Maintenance Request Software
                </Link>
              </li>
              <li>
                <Link href="/maintenance/in-app-messaging" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  In-App Messaging
                </Link>
              </li>
            </ul>
          </div>

          {/* Lease Agreements */}
          <div className="text-center lg:text-left">
            <h3 className="text-[#22c55e] font-bold text-sm mb-4">Lease Agreements</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/lease/ai-lease-creation" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Percy AI Lease Creation
                </Link>
              </li>
              <li>
                <Link href="/lease/e-sign-docusign" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  E-Sign for DocuSign
                </Link>
              </li>
              <li>
                <Link href="/lease/online-condition-reports" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Online Condition Reports
                </Link>
              </li>
            </ul>
          </div>

          {/* Rent Collection */}
          <div className="text-center lg:text-left">
            <h3 className="text-[#22c55e] font-bold text-sm mb-4">Rent Collection</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/rent/accounting" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Accounting
                </Link>
              </li>
              <li>
                <Link href="/landlord-accounting-software" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Landlord Accounting Software
                </Link>
              </li>
              <li>
                <Link href="/rent-collection-software-for-landlords" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Rent Collection Software
                </Link>
              </li>
              <li>
                <Link href="/rent/custom-late-fees" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Custom Late Fees
                </Link>
              </li>
              <li>
                <Link href="/rent/expense-tracking" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Expense Tracking
                </Link>
              </li>
              <li>
                <Link href="/rent/rent-reporting" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Rent Reporting
                </Link>
              </li>
            </ul>
          </div>

          {/* Get Started */}
          <div className="text-center lg:text-left">
            <h3 className="text-[#22c55e] font-bold text-sm mb-4">Get Started</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/listings" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Rental Listings
                </Link>
              </li>
              <li>
                <Link href="/features" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  All Features
                </Link>
              </li>
              <li>
                <Link href="/free-landlord-software" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Free Landlord Software
                </Link>
              </li>
              <li>
                <Link href="/property-management-software-for-small-landlords" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Small Landlord Software
                </Link>
              </li>
              <li>
                <Link href="/property-management-spreadsheet-alternative" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Spreadsheet Alternative
                </Link>
              </li>
              <li>
                <Link href="/help-center" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Help Center
                </Link>
              </li>
              <li>
                <a href="https://app.propertypeace.io/login" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Login
                </a>
              </li>
              <li>
                <Link href="/pricing" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Pricing
                </Link>
              </li>
              <li>
                <a href="https://app.propertypeace.io/register" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Start free
                </a>
              </li>
            </ul>
          </div>

          {/* Education */}
          <div className="text-center lg:text-left">
            <h3 className="text-[#22c55e] font-bold text-sm mb-4">Education</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/blog" className="inline-flex min-h-11 items-center justify-center font-semibold text-white hover:text-white/90 transition-colors text-sm">
                  Blog
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/20 pt-8 mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0 items-center">
          <p className="text-white/80 text-sm order-2 md:order-1 text-center lg:text-left">© 2026 Property Peace. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 order-1 md:order-2">
            <Link href="/terms" className="inline-flex min-h-11 items-center justify-center font-semibold text-[#22c55e] hover:text-emerald-300 text-sm transition-colors">
              Terms of Use
            </Link>
            <span className="text-white/40">|</span>
            <Link href="/privacy" className="inline-flex min-h-11 items-center justify-center font-semibold text-[#22c55e] hover:text-emerald-300 text-sm transition-colors">
              Privacy Policy
            </Link>
            <span className="text-white/40">|</span>
            <Link href="/sitemap" className="inline-flex min-h-11 items-center justify-center font-semibold text-[#22c55e] hover:text-emerald-300 text-sm transition-colors">
              Sitemap
            </Link>
          </div>
          <div className="text-white/80 text-sm order-3 text-center lg:text-right">
            Created by Brownstone Hub LLC
          </div>
        </div>
      </div>
    </footer>
  );
}
