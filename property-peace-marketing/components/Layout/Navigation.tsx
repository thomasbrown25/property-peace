'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  FiMenu,
  FiX,
  FiZap,
  FiChevronDown,
  FiChevronRight,
  FiArrowLeft,
  FiFileText,
  FiMessageCircle,
  FiFile,
  FiFolder,
  FiCreditCard,
  FiDollarSign,
  FiBarChart2,
  FiHome,
  FiTool,
  FiActivity,
  FiTrendingUp,
  FiRefreshCw,
  FiLayout,
  FiShield
} from 'react-icons/fi';

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const [featuresDropdownOpen, setFeaturesDropdownOpen] = useState(false);
  const [featuresDropdownTimeout, setFeaturesDropdownTimeout] = useState<NodeJS.Timeout | null>(null);
  const transparent = false;
  const useFooterStyleNav = true;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.propertypeace.io').replace(/\/$/, '');
  const loginUrl = `${appUrl}/login`;
  const registerUrl = `${appUrl}/register`;

  useEffect(() => {
    if (!mobileMenuOpen) {
      setMobileFeaturesOpen(false);
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleFeaturesMouseEnter = () => {
    if (featuresDropdownTimeout) {
      clearTimeout(featuresDropdownTimeout);
      setFeaturesDropdownTimeout(null);
    }
    setFeaturesDropdownOpen(true);
  };

  const handleFeaturesMouseLeave = () => {
    const timeout = setTimeout(() => {
      setFeaturesDropdownOpen(false);
    }, 150);
    setFeaturesDropdownTimeout(timeout);
  };

  const closeFeaturesDropdown = () => {
    if (featuresDropdownTimeout) {
      clearTimeout(featuresDropdownTimeout);
      setFeaturesDropdownTimeout(null);
    }
    setFeaturesDropdownOpen(false);
  };

  const featuresCategories = [
    {
      title: 'TENANT MANAGEMENT',
      features: [
        {
          slug: 'rental-applications',
          title: 'Rental Applications',
          icon: FiFileText,
          description: 'Complete digital rental application workflow from invite to signed lease.'
        },
        {
          slug: 'tenant-communication',
          title: 'Tenant Communication',
          icon: FiMessageCircle,
          description: 'In-app and email notifications; SMS depends on supported messaging configuration.'
        },
        {
          slug: 'real-time-communication',
          title: 'Real-Time Messaging',
          icon: FiZap,
          description: 'Instant messaging with tenants powered by SignalR.'
        },
      ]
    },
    {
      title: 'LEASES',
      features: [
        {
          slug: 'lease-management',
          title: 'Lease Management',
          icon: FiFile,
          description: 'Create, organize, and track lease records. Integrated e-signature is not currently available.'
        },
        {
          slug: 'lease-shield',
          title: 'LeaseShield',
          icon: FiShield,
          description: 'Lease & state law answers from government sources only. Accurate, citable, state-specific.'
        },
        {
          slug: 'document-management',
          title: 'Document Management',
          icon: FiFolder,
          description: 'Secure Azure cloud storage for all documents. Access from anywhere.'
        },
      ]
    },
    {
      title: 'ACCOUNTING & PAYMENTS',
      features: [
        {
          slug: 'payment-processing',
          title: 'Online Payments Roadmap',
          icon: FiCreditCard,
          description: 'Not currently available. Rent tracking and reminder workflows are live.'
        },
        {
          slug: 'rent-collection',
          title: 'Rent Collection',
          icon: FiDollarSign,
          description: 'Automated rent tracking with overdue calculations and reminders.'
        },
        {
          slug: 'financial-reports',
          title: 'Financial Reports',
          icon: FiBarChart2,
          description: 'Property profitability analysis and tax reports with categorization.'
        },
      ]
    },
    {
      title: 'PROPERTY MANAGEMENT',
      features: [
        {
          slug: 'property-management',
          title: 'Property Management',
          icon: FiHome,
          description: 'Manage multiple properties with detailed records and Google Maps.'
        },
        {
          slug: 'rental-listings',
          href: '/listings',
          title: 'Rental Listings',
          icon: FiFileText,
          description: 'Create shareable listing pages and connect interested renters to applications.'
        },
        {
          slug: 'maintenance-tracking',
          title: 'Maintenance Tracking',
          icon: FiTool,
          description: 'Streamline maintenance requests with photo uploads and tracking.'
        },
      ]
    },
    {
      title: 'PERCY & AUTOMATION',
      features: [
        {
          slug: 'ai-summaries',
          title: 'Percy Pilot Summaries',
          icon: FiActivity,
          description: 'Instant plain-English summaries of your entire portfolio — rent, maintenance, and leases.'
        },
        {
          slug: 'rent-estimate',
          title: 'Rent Estimates',
          icon: FiTrendingUp,
          description: 'Data-driven rent ranges based on real comparable listings near your property.'
        },
        {
          slug: 'automation',
          title: 'Automated Workflows',
          icon: FiRefreshCw,
          description: 'Set it once and let the system work for you with automated reminders.'
        },
        {
          slug: 'all-in-one-dashboard',
          title: 'All-in-One Dashboard',
          icon: FiLayout,
          description: 'Real-time overview of your properties, tenants, leases, and finances.'
        },
      ]
    }
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 w-full min-w-0 transition-all duration-300 ${
          useFooterStyleNav ? 'marketing-auth-nav' : ''
        }`}
        style={{
          fontFamily: '"Poppins", sans-serif',
          background: transparent ? 'transparent' : useFooterStyleNav ? undefined : 'rgba(6,30,53,0.88)',
          backdropFilter: transparent ? 'none' : useFooterStyleNav ? undefined : 'blur(20px)',
          WebkitBackdropFilter: transparent ? 'none' : useFooterStyleNav ? undefined : 'blur(20px)',
          borderBottom: transparent ? 'none' : useFooterStyleNav ? undefined : '1px solid rgba(255,255,255,0.08)',
        }}
      >
      <div className="marketing-auth-nav-content mx-auto w-full max-w-6xl min-w-0 px-4 sm:px-6 lg:px-6">
        <div className="relative grid grid-cols-[76px_minmax(0,1fr)_64px] items-center py-2 nav:flex nav:justify-between">
          {/* Mobile: menu left */}
          <div className="nav:hidden flex h-11 w-[76px] flex-shrink-0 items-center justify-start">
            <button
              className={`inline-flex h-11 items-center justify-start gap-2 rounded-xl pr-2 transition-colors duration-300 ${
                transparent ? 'text-primary-main hover:text-primary-hover' : 'text-white/85 hover:text-white'
              }`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
            >
              {mobileMenuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
              <span className="text-sm font-medium" style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}>
                Menu
              </span>
            </button>
          </div>

          {/* Logo */}
          <Link
            href="/"
            className="flex min-w-0 justify-center nav:ml-4 nav:flex-initial nav:justify-start lg:nav:ml-0 items-center"
          >
            <span className="relative block h-10 w-[150px] sm:h-12 sm:w-[180px]">
              <Image
                src="/images/logos/property-peace-dark.png"
                alt="Property Peace logo: house, bird, and leaf representing simplified property management software."
                width={180}
                height={48}
                className={`absolute inset-0 h-10 w-auto transition-opacity duration-300 sm:h-12 ${
                  transparent ? 'opacity-100' : 'opacity-0'
                }`}
                priority
              />
              <Image
                src="/images/logos/property-peace.png"
                alt=""
                aria-hidden="true"
                width={180}
                height={48}
                className={`absolute inset-0 h-10 w-auto transition-opacity duration-300 sm:h-12 ${
                  transparent ? 'opacity-0' : 'opacity-100'
                }`}
                priority
              />
            </span>
          </Link>

          {/* Mobile: Login on right */}
          <div className="nav:hidden flex h-11 w-16 flex-shrink-0 items-center justify-end">
            <Link
              href={loginUrl}
              className={`inline-flex h-11 min-w-11 items-center justify-end rounded-xl px-1 text-sm font-medium transition-all duration-300 ${
                transparent ? 'text-primary-main hover:text-primary-hover' : 'text-white/85 hover:text-white'
              }`}
              style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
            >
              Login
            </Link>
          </div>

          {/* Desktop Navigation - Centered */}
          <div className="hidden nav:flex flex-1 justify-center items-center space-x-8">
            {/* Features Dropdown */}
            <div
              className="relative h-full flex items-center"
              onMouseEnter={handleFeaturesMouseEnter}
              onMouseLeave={handleFeaturesMouseLeave}
            >
              <Link
                href="/features"
                className={`flex items-center space-x-1 font-medium transition-all duration-300 py-2 border-b-2 border-transparent ${
                  transparent
                    ? 'text-primary-main hover:text-primary-hover hover:border-primary-main/30'
                    : 'text-white/80 hover:text-white hover:border-white/30'
                }`}
              >
                <span>Features</span>
                <FiChevronDown className="w-4 h-4" />
              </Link>
            </div>

            <Link href="/listings" className={`font-medium transition-all duration-300 py-2 border-b-2 border-transparent ${
              transparent
                ? 'text-primary-main hover:text-primary-hover hover:border-primary-main/30'
                : 'text-white/80 hover:text-white hover:border-white/30'
            }`}>
              Listings
            </Link>
            <Link href="/pricing" className={`font-medium transition-all duration-300 py-2 border-b-2 border-transparent ${
              transparent
                ? 'text-primary-main hover:text-primary-hover hover:border-primary-main/30'
                : 'text-white/80 hover:text-white hover:border-white/30'
            }`}>
              Pricing
            </Link>
            <Link href="/resources" className={`font-medium transition-all duration-300 py-2 border-b-2 border-transparent ${
              transparent
                ? 'text-primary-main hover:text-primary-hover hover:border-primary-main/30'
                : 'text-white/80 hover:text-white hover:border-white/30'
            }`}>
              Resources
            </Link>
          </div>

          {/* CTA: Login + Get Started (desktop) */}
          <div className="hidden nav:flex items-center gap-3 lg:nav:mr-12">
            <Link
              href={loginUrl}
              className={`px-6 py-3 rounded-none font-medium text-center transition-all duration-300 border ${
                transparent
                  ? 'border-slate-200 text-primary-main hover:bg-slate-50 hover:text-primary-hover'
                  : 'border-white/20 text-white/80 hover:bg-white/10 hover:text-white'
              }`}
              style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
            >
              Login
            </Link>
            <Link
              href={registerUrl}
              className="px-7 py-3.5 rounded-none font-bold text-center transition-all duration-300 hover:-translate-y-0.5 shadow-lg shadow-emerald-600/25 text-white"
              style={{
                fontFamily: '"Inter", "Inter Placeholder", sans-serif',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)'
              }}
            >
              Start free
            </Link>
          </div>

        </div>
      </div>

      {/* Features Dropdown */}
      <div
        className={`hidden nav:block absolute top-full left-0 right-0 z-50 transition-transform duration-300 ease-out ${
          useFooterStyleNav ? 'marketing-auth-nav-dropdown' : ''
        } ${
          featuresDropdownOpen
            ? 'visible translate-y-0 pointer-events-auto'
            : 'invisible translate-y-4 pointer-events-none'
        }`}
        style={{
          background: useFooterStyleNav ? undefined : 'linear-gradient(160deg, #061e35 0%, #0a2d52 58%, #0d2040 100%)',
          borderBottom: useFooterStyleNav ? undefined : '1px solid rgba(255,255,255,0.08)',
        }}
        onMouseEnter={handleFeaturesMouseEnter}
        onMouseLeave={handleFeaturesMouseLeave}
      >
        <div className="h-2" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full min-w-0">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6 lg:gap-8">
            {featuresCategories.map((category, index) => (
              <div key={index}>
                <h3 className="text-xs font-semibold text-[#22c55e] uppercase tracking-wide mb-6">
                  {category.title}
                </h3>
                <ul className="space-y-4">
                  {category.features.map((feature) => {
                    const IconComponent = feature.icon;
                    return (
                      <li key={feature.slug}>
                        <Link
                          href={feature.href ?? `/features/${feature.slug}`}
                          className="block group"
                          onClick={closeFeaturesDropdown}
                        >
                          <div className="flex items-start space-x-3 mb-1">
                            <IconComponent className="w-5 h-5 text-blue-300 flex-shrink-0 mt-0.5 group-hover:text-blue-200 transition-colors" />
                            <span className="text-sm font-semibold text-white/85 group-hover:text-white transition-colors" style={{ fontFamily: '"Poppins", sans-serif' }}>
                              {feature.title}
                            </span>
                          </div>
                          <p className="text-xs text-white/45 leading-relaxed pl-8" style={{ fontFamily: '"Inter", sans-serif' }}>
                            {feature.description}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-white/10">
            <Link
              href="/features"
              className="text-sm font-medium text-blue-300 hover:text-blue-200 transition-colors inline-flex items-center"
              style={{ fontFamily: '"Inter", sans-serif' }}
              onClick={closeFeaturesDropdown}
            >
              View All Features →
            </Link>
          </div>
        </div>
      </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
      <div
        id="mobile-navigation-menu"
        className="nav:hidden fixed inset-0 z-[90] transition-opacity duration-300 ease-out opacity-100"
        aria-hidden="false"
      >
        {/* Backdrop */}
        <button
          type="button"
          className="absolute inset-0 bg-[#03101d]/70 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        />
        {/* Drawer */}
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className={`fixed left-0 top-0 flex h-dvh w-[min(22rem,88vw)] max-w-full flex-col overflow-hidden rounded-r-[1.75rem] border-r border-white/10 shadow-[24px_0_70px_rgba(0,0,0,0.42)] transition-transform duration-300 ease-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ background: 'linear-gradient(180deg, #061e35 0%, #082b4d 55%, #061e35 100%)' }}
        >
          <div className="pointer-events-none absolute -right-24 top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 left-4 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl" aria-hidden="true" />

          <div className="relative z-10 flex items-center justify-between border-b border-white/10 px-5 py-4">
            <Link href="/" className="flex items-center" onClick={() => setMobileMenuOpen(false)}>
              <span className="relative block h-11 w-[160px]">
                <Image
                  src="/images/logos/property-peace.png"
                  alt="Property Peace"
                  width={180}
                  height={48}
                  className="h-11 w-auto"
                  priority
                />
              </span>
            </Link>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-none border border-white/10 bg-white/[0.06] text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <div className="relative z-10 flex-1 overflow-hidden">
            <div
              className={`flex h-full w-[200%] transition-transform duration-300 ease-out ${
                mobileFeaturesOpen ? '-translate-x-1/2' : 'translate-x-0'
              }`}
            >
              <div className="h-full w-1/2 overflow-y-auto px-5 py-4">
                <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/80" style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}>
                  Explore
                </p>
                <nav className="divide-y divide-white/10 border-y border-white/10" aria-label="Primary mobile navigation">
                  <button
                    type="button"
                    className="group flex min-h-[58px] w-full items-center justify-between gap-4 py-3 text-left text-white transition-colors hover:text-emerald-100"
                    onClick={() => setMobileFeaturesOpen(true)}
                    aria-label="Open features menu"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-400/12 text-emerald-300"><FiLayout className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold">Features</span>
                        <span className="block text-xs text-white/50">Rent, leases, maintenance, Percy</span>
                      </span>
                    </span>
                    <FiChevronRight className="h-5 w-5 flex-shrink-0 text-white/45 transition-transform group-hover:translate-x-0.5 group-hover:text-white/80" />
                  </button>
                  <Link
                    href="/listings"
                    className="group flex min-h-[58px] items-center gap-3 py-3 text-white transition-colors hover:text-blue-100"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-400/12 text-blue-200"><FiHome className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">Listings</span>
                      <span className="block text-xs text-white/50">Share vacant rentals</span>
                    </span>
                  </Link>
                  <Link
                    href="/pricing"
                    className="group flex min-h-[58px] items-center gap-3 py-3 text-white transition-colors hover:text-emerald-100"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-400/12 text-emerald-300"><FiDollarSign className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">Pricing</span>
                      <span className="block text-xs text-white/50">Start free, upgrade when ready</span>
                    </span>
                  </Link>
                  <Link
                    href="/resources"
                    className="group flex min-h-[58px] items-center gap-3 py-3 text-white transition-colors hover:text-white"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/80"><FiFileText className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">Resources</span>
                      <span className="block text-xs text-white/50">Guides and practical checklists</span>
                    </span>
                  </Link>
                </nav>

                <div className="mt-5 rounded-[1.35rem] border border-emerald-300/15 bg-emerald-300/[0.07] p-4">
                  <p className="text-sm font-semibold text-white" style={{ fontFamily: '"Poppins", sans-serif' }}>
                    Built for 1–50 unit landlords
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/60" style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}>
                    Replace spreadsheets, reminders, and scattered tenant messages with one calm system.
                  </p>
                </div>
              </div>

              <div className="h-full w-1/2 overflow-y-auto px-5 py-4">
                <button
                  type="button"
                  className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-none pr-3 text-sm font-semibold text-white/80 transition-colors hover:text-white"
                  onClick={() => setMobileFeaturesOpen(false)}
                >
                  <FiArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/80" style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}>
                      Features
                    </p>
                    <p className="mt-1 text-xs text-white/50">Choose what you want to simplify.</p>
                  </div>
                  <Link
                    href="/features"
                    className="text-xs font-semibold text-blue-200"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    View all
                  </Link>
                </div>

                <div className="divide-y divide-white/10">
                  {featuresCategories.map((category) => (
                    <div key={category.title} className="py-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/70" style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}>
                        {category.title}
                      </p>
                      <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
                        {category.features.map((feature) => {
                          const IconComponent = feature.icon;
                          return (
                            <Link
                              key={feature.slug}
                              href={feature.href ?? `/features/${feature.slug}`}
                              className="group flex min-h-[54px] items-center justify-between gap-3 py-3 text-white transition-colors hover:text-blue-100"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/8 text-blue-200"><IconComponent className="h-4 w-4" /></span>
                                <span className="min-w-0 text-sm font-semibold leading-tight">{feature.title}</span>
                              </span>
                              <FiChevronRight className="h-4 w-4 flex-shrink-0 text-white/35 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70" />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 border-t border-white/10 bg-[#04182c]/80 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={loginUrl}
                className="inline-flex min-h-[52px] items-center justify-center rounded-none border border-white/15 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10"
                style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                href={registerUrl}
                className="inline-flex min-h-[52px] items-center justify-center rounded-none px-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition-all duration-300"
                style={{
                  fontFamily: '"Inter", "Inter Placeholder", sans-serif',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)'
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Start free
              </Link>
            </div>
          </div>
        </aside>
      </div>
      )}
    </>
  );
}
