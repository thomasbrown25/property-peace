'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  getNavigationRouteTransitionState,
  getNavigationSurface,
} from '@/lib/navigation-surface';
import {
  getFeaturesDropdownKeyAction,
  shouldOpenFeaturesDropdownOnFocus,
} from '@/lib/navigation-features-key-action';
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
  FiUsers,
  FiShield
} from 'react-icons/fi';

const desktopNavigationQuery = '(min-width: 955px)';

function subscribeDesktopNavigation(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(desktopNavigationQuery);
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function getDesktopNavigationSnapshot() {
  return window.matchMedia(desktopNavigationQuery).matches;
}

function getServerDesktopNavigationSnapshot() {
  return false;
}

export default function Navigation() {
  const pathname = usePathname();
  const desktopIntentEnabled = useSyncExternalStore(
    subscribeDesktopNavigation,
    getDesktopNavigationSnapshot,
    getServerDesktopNavigationSnapshot,
  );
  const [scrolled, setScrolled] = useState(false);
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const [featuresDropdownOpen, setFeaturesDropdownOpen] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const featuresTriggerRef = useRef<HTMLButtonElement>(null);
  const firstFeatureLinkRef = useRef<HTMLAnchorElement>(null);
  const featuresDropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoringFeaturesTriggerFocusRef = useRef(false);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.propertypeace.io').replace(/\/$/, '');
  const loginUrl = `${appUrl}/login`;
  const registerUrl = `${appUrl}/register`;

  useEffect(() => {
    if (!mobileMenuOpen) {
      const closeMobileFeatures = window.setTimeout(() => setMobileFeaturesOpen(false), 0);
      return () => window.clearTimeout(closeMobileFeatures);
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

  useEffect(() => {
    const update = () =>
      setScrolled(
        getNavigationRouteTransitionState({ scrollY: window.scrollY }).scrolled,
      );
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    if (featuresDropdownTimeoutRef.current) {
      clearTimeout(featuresDropdownTimeoutRef.current);
      featuresDropdownTimeoutRef.current = null;
    }
    const resetNavigation = window.setTimeout(() => {
      const routeState = getNavigationRouteTransitionState({ scrollY: window.scrollY });
      setScrolled(routeState.scrolled);
      setPointerInside(routeState.pointerInside);
      setFocusInside(routeState.focusInside);
      setMobileMenuOpen(false);
      setMobileFeaturesOpen(false);
      setFeaturesDropdownOpen(false);
    }, 0);
    return () => window.clearTimeout(resetNavigation);
  }, [pathname]);

  const surface = getNavigationSurface({
    pathname,
    desktopIntentEnabled,
    scrolled,
    pointerInside,
    focusInside,
    dropdownOpen: featuresDropdownOpen,
    mobileMenuOpen,
  });
  const whiteSurface = surface === 'white';

  const clearFeaturesDropdownTimeout = () => {
    if (featuresDropdownTimeoutRef.current) {
      clearTimeout(featuresDropdownTimeoutRef.current);
      featuresDropdownTimeoutRef.current = null;
    }
  };

  const handleFeaturesMouseEnter = () => {
    clearFeaturesDropdownTimeout();
    setFeaturesDropdownOpen(true);
  };

  const handleFeaturesMouseLeave = () => {
    clearFeaturesDropdownTimeout();
    const timeout = setTimeout(() => {
      if (navigationRef.current?.contains(document.activeElement)) return;
      setFeaturesDropdownOpen(false);
    }, 150);
    featuresDropdownTimeoutRef.current = timeout;
  };

  const closeFeaturesDropdown = () => {
    clearFeaturesDropdownTimeout();
    setFeaturesDropdownOpen(false);
  };

  const handleFeaturesTriggerFocus = () => {
    const restoringFocus = restoringFeaturesTriggerFocusRef.current;
    restoringFeaturesTriggerFocusRef.current = false;

    if (shouldOpenFeaturesDropdownOnFocus({ restoringFocus })) {
      handleFeaturesMouseEnter();
    }
  };

  const focusFirstFeatureLink = () => {
    window.requestAnimationFrame(() => firstFeatureLinkRef.current?.focus());
  };

  const handleFeaturesTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const action = getFeaturesDropdownKeyAction({
      key: event.key,
      shiftKey: event.shiftKey,
      dropdownOpen: featuresDropdownOpen,
      target: 'trigger',
    });

    if (action === 'open-and-focus-first-link') {
      event.preventDefault();
      clearFeaturesDropdownTimeout();
      setFeaturesDropdownOpen(true);
      focusFirstFeatureLink();
    } else if (action === 'focus-first-link') {
      event.preventDefault();
      focusFirstFeatureLink();
    }
  };

  const handleNavigationKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const action = getFeaturesDropdownKeyAction({
      key: event.key,
      dropdownOpen: featuresDropdownOpen,
      target: 'navigation',
    });

    if (action === 'close-and-restore-trigger') {
      event.preventDefault();
      closeFeaturesDropdown();
      const trigger = featuresTriggerRef.current;
      if (trigger && document.activeElement !== trigger) {
        restoringFeaturesTriggerFocusRef.current = true;
        trigger.focus();
        restoringFeaturesTriggerFocusRef.current = false;
      }
    }
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
        ref={navigationRef}
        className="marketing-nav fixed inset-x-0 top-0 z-50 w-full min-w-0"
        data-navigation-surface={surface}
        data-navigation-height="88"
        onMouseEnter={() => setPointerInside(true)}
        onMouseLeave={() => setPointerInside(false)}
        onFocusCapture={() => setFocusInside(true)}
        onKeyDownCapture={handleNavigationKeyDown}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setFocusInside(false);
            closeFeaturesDropdown();
          }
        }}
        style={{ fontFamily: '"Poppins", sans-serif' }}
      >
      <div className="mx-auto w-full min-w-0 max-w-[1660px] px-5 sm:px-6 lg:px-10 xl:px-12">
        <div className="relative grid h-[72px] grid-cols-[76px_minmax(0,1fr)_76px] items-center nav:flex nav:h-[88px] nav:justify-between">
          {/* Mobile: menu left */}
          <div className="nav:hidden flex h-11 w-[76px] flex-shrink-0 items-center justify-start">
            <button
              className={`inline-flex h-11 w-11 items-center justify-start rounded-xl transition-colors duration-300 ${
                whiteSurface ? 'text-[#061E35] hover:text-[#15803D]' : 'text-white hover:text-white'
              }`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
            >
              {mobileMenuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
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
                  whiteSurface ? 'opacity-100' : 'opacity-0'
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
                  whiteSurface ? 'opacity-0' : 'opacity-100'
                }`}
                priority
              />
            </span>
          </Link>

          {/* Mobile: Login on right */}
          <div className="nav:hidden flex h-11 w-full flex-shrink-0 items-center justify-end">
            <Link
              href={loginUrl}
              className="inline-flex h-[38px] items-center justify-center rounded-sm border border-[#B8C8D5] bg-white px-3 text-xs font-semibold uppercase text-[#061E35] transition-colors duration-[220ms] hover:bg-[#F7FAFC] motion-reduce:transition-none"
              style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
            >
              LOGIN
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
              <button
                ref={featuresTriggerRef}
                type="button"
                id="desktop-features-trigger"
                aria-haspopup="true"
                aria-expanded={featuresDropdownOpen}
                aria-controls="desktop-features-dropdown"
                onFocus={handleFeaturesTriggerFocus}
                onKeyDown={handleFeaturesTriggerKeyDown}
                className={`flex items-center space-x-1 border-b-2 border-transparent py-2 font-medium transition-[color,border-color] duration-[220ms] motion-reduce:transition-none ${
                  whiteSurface
                    ? 'text-[#061E35] hover:text-[#15803D]'
                    : 'text-white hover:text-white'
                }`}
              >
                <span>Features</span>
                <FiChevronDown className="w-4 h-4" />
              </button>
            </div>

            <Link href="/listings" className={`font-medium transition-all duration-300 py-2 border-b-2 border-transparent ${
              whiteSurface ? 'text-[#061E35] hover:text-[#15803D]' : 'text-white hover:text-white'
            }`}>
              Listings
            </Link>
            <Link href="/pricing" className={`font-medium transition-all duration-300 py-2 border-b-2 border-transparent ${
              whiteSurface ? 'text-[#061E35] hover:text-[#15803D]' : 'text-white hover:text-white'
            }`}>
              Pricing
            </Link>
            <Link href="/resources" className={`font-medium transition-all duration-300 py-2 border-b-2 border-transparent ${
              whiteSurface ? 'text-[#061E35] hover:text-[#15803D]' : 'text-white hover:text-white'
            }`}>
              Resources
            </Link>
            <Link href="/about" className={`font-medium transition-all duration-300 py-2 border-b-2 border-transparent ${
              whiteSurface ? 'text-[#061E35] hover:text-[#15803D]' : 'text-white hover:text-white'
            }`}>
              About
            </Link>
          </div>

          {/* CTA: Login + Book a Demo (desktop) */}
          <div className={`hidden nav:flex items-center gap-3 ${pathname === '/' ? '' : 'lg:nav:mr-12'}`}>
            <Link href={loginUrl}
              className="inline-flex h-[38px] items-center justify-center rounded-sm border border-[#B8C8D5] bg-white px-[18px] text-center text-xs font-semibold uppercase text-[#061E35] transition-colors duration-200 hover:bg-[#F7FAFC]"
              style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}>
              LOGIN
            </Link>
            <Link href="/demo"
              className="inline-flex h-[38px] items-center justify-center rounded-sm bg-green-600 px-[18px] text-center text-xs font-bold uppercase text-white transition-colors duration-200 hover:bg-green-500"
              style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}>
              BOOK A DEMO
            </Link>
          </div>

        </div>
      </div>

      {/* Features Dropdown */}
      <div
        id="desktop-features-dropdown"
        data-navigation-features-panel="true"
        aria-labelledby="desktop-features-trigger"
        aria-hidden={!featuresDropdownOpen}
        className={`marketing-nav-dropdown hidden nav:block absolute inset-x-0 top-full z-50 transition-opacity duration-[220ms] ease-out motion-reduce:transition-none ${
          featuresDropdownOpen
            ? 'visible opacity-100 pointer-events-auto'
            : 'invisible opacity-0 pointer-events-none'
        }`}
        onMouseEnter={handleFeaturesMouseEnter}
        onMouseLeave={handleFeaturesMouseLeave}
      >
        <div className="h-2" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full min-w-0">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6 lg:gap-8">
            {featuresCategories.map((category, categoryIndex) => (
              <div key={category.title}>
                <h3 className="text-xs font-semibold text-[#4ade80] uppercase tracking-wide mb-6">
                  {category.title}
                </h3>
                <ul className="space-y-4">
                  {category.features.map((feature) => {
                    const IconComponent = feature.icon;
                    return (
                      <li key={feature.slug}>
                        <Link
                          ref={categoryIndex === 0 && feature.slug === 'rental-applications' ? firstFeatureLinkRef : undefined}
                          href={feature.href ?? `/features/${feature.slug}`}
                          className="block group"
                          onClick={closeFeaturesDropdown}
                        >
                          <div className="flex items-start space-x-3 mb-1">
                            <IconComponent className="w-5 h-5 text-[#4ade80] flex-shrink-0 mt-0.5 group-hover:text-[#86efac] transition-colors" />
                            <span className="text-sm font-semibold text-white group-hover:text-[#86efac] transition-colors" style={{ fontFamily: '"Poppins", sans-serif' }}>
                              {feature.title}
                            </span>
                          </div>
                          <p className="text-xs text-white/75 leading-relaxed pl-8" style={{ fontFamily: '"Inter", sans-serif' }}>
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
          <div className="mt-8 pt-6 border-t border-white/20">
            <Link
              href="/features"
              className="text-sm font-medium text-[#4ade80] hover:text-[#86efac] transition-colors inline-flex items-center"
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
                  <Link
                    href="/about"
                    className="group flex min-h-[58px] items-center gap-3 py-3 text-white transition-colors hover:text-emerald-100"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-400/12 text-emerald-300"><FiUsers className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">About</span>
                      <span className="block text-xs text-white/50">Why we built Property Peace</span>
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
                className="inline-flex h-[38px] items-center justify-center rounded-sm border border-white bg-white px-3 text-xs font-semibold uppercase text-[#061E35] transition-colors duration-200 hover:bg-white/85"
                style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                LOGIN
              </Link>
              <Link
                href="/demo"
                className="inline-flex h-[38px] items-center justify-center rounded-sm bg-green-600 px-3 text-xs font-bold uppercase text-white transition-colors duration-200 hover:bg-green-500"
                style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                BOOK A DEMO
              </Link>
            </div>
          </div>
        </aside>
      </div>
      )}
    </>
  );
}
