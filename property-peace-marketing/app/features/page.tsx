import type { Metadata } from "next";
import Link from "next/link";
import StructuredData from "@/components/SEO/StructuredData";
import { applyOttoSeo } from '@/lib/otto-seo';
import { webPageSchema } from '@/lib/structured-data';
import {
  FiActivity,
  FiTrendingUp,
  FiLayout,
  FiFileText,
  FiFile,
  FiCreditCard,
  FiZap,
  FiHome,
  FiTool,
  FiDollarSign,
  FiBarChart2,
  FiBell,
  FiFolder,
  FiRefreshCw,
  FiArrowRight,
  FiCheck
} from "react-icons/fi";
export const metadata: Metadata = applyOttoSeo('/features/', {
  title: "Property Management Software Features | Property Peace",
  description: "Explore Property Peace features for small landlords: rent collection, maintenance, leases, accounting, documents, messaging, and Percy Pilot tools for 1–50 units.",
  keywords: "property management software features, landlord software features, rental property tools, rent collection, maintenance tracking, lease management, landlord accounting",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Property Management Software Features | Property Peace",
    description: "Rent collection, maintenance, leases, accounting, documents, messaging, and Percy Pilot tools for small landlords with 1–50 units.",
    type: "website",
    url: "/features",
  },
});

const categoryDetails: Record<string, { eyebrow: string; description: string }> = {
  'Streamline Rent & Accounting': {
    eyebrow: 'Money in, records ready',
    description: 'Collect rent, understand cash flow, and keep tax-ready reports without wrestling spreadsheets.',
  },
  Operations: {
    eyebrow: 'Daily landlord work',
    description: 'Turn maintenance, tenant messages, documents, and property records into clean, trackable workflows.',
  },
  'Leasing & Applications': {
    eyebrow: 'Paperwork without paper',
    description: 'Move applicants, leases, signatures, and condition records through a simpler digital process.',
  },
  Intelligence: {
    eyebrow: 'Smarter decisions',
    description: 'Use Percy summaries, rent comps, and a single dashboard to see what needs attention before it becomes a problem.',
  },
};

const featureCategories = [
  {
    title: 'Streamline Rent & Accounting',
    features: [
      {
        slug: 'rent-collection',
        icon: FiDollarSign,
        title: 'Rent Collection',
        description: 'Collect rent on time with automated reminders and clear rent rolls. See who’s paid, who’s overdue, and send gentle nudges without the awkward texts. Online rent payments are included with Free. Organizations request access, complete secure payment setup, and pass account review before tenants can pay online.'
      },
      {
        slug: 'payment-processing',
        icon: FiCreditCard,
        title: 'Online Rent Payments',
        description: 'Online rent payments are included with Free. Organizations request access, complete secure payment setup, and pass account review before tenants can pay online.'
      },
      {
        slug: 'financial-reports',
        icon: FiBarChart2,
        title: 'Advanced Reports',
        description: 'Know exactly how each property performs. Tax-ready reports, profitability by property, and year-over-year comparisons—export when you need them.'
      }
    ]
  },
  {
    title: 'Operations',
    features: [
      {
        slug: 'maintenance-tracking',
        icon: FiTool,
        title: 'Maintenance Tracking',
        description: 'Stay on top of every repair. Track requests, work orders, and vendors in one place so nothing gets lost in texts or sticky notes.'
      },
      {
        slug: 'automation',
        icon: FiRefreshCw,
        title: 'Automated Workflows',
        description: 'Set it once. Rent reminders, lease expiration alerts, and follow-ups run automatically so you spend less time chasing and more time managing.'
      },
      {
        slug: 'tenant-communication',
        icon: FiBell,
        title: 'Multi-Channel Notifications',
        description: 'Never miss a due date or request with in-app and email notifications. Premium includes one dedicated organization SMS number; activation and configuration are required.'
      },
      {
        slug: 'property-management',
        icon: FiHome,
        title: 'Property Management',
        description: 'One place for every property. Records, photos, performance, and maintenance history so you can see the full picture at a glance.'
      },
      {
        slug: 'real-time-communication',
        icon: FiZap,
        title: 'Real-Time Communication',
        description: 'Reply to tenants in real time. Instant messaging and live updates mean no more playing phone tag or waiting for the next email.'
      },
      {
        slug: 'document-management',
        icon: FiFolder,
        title: 'Cloud Document Management',
        description: 'All leases and documents in one secure place. Access from anywhere, automatic backups, and no more digging through folders or inboxes.'
      }
    ]
  },
  {
    title: 'Leasing & Applications',
    features: [
      {
        slug: 'rental-applications',
        icon: FiFileText,
        title: 'Digital Rental Applications',
        description: 'Collect applications without the paperwork using secure invites, online forms, generated PDFs, and review notes. Consumer-report tenant screening is not included.'
      },
      {
        slug: 'lease-management',
        icon: FiFile,
        title: 'Lease Document Management',
        description: 'Create, store, and track lease records. Integrated e-signature and DocuSign workflows are not currently available.'
      }
    ]
  },
  {
    title: 'Intelligence',
    features: [
      {
        slug: 'ai-summaries',
        icon: FiActivity,
        title: 'Percy Pilot Summaries',
        description: 'Instant plain-English summaries of your entire portfolio — rent collection, maintenance, leases, and tenant activity — generated by Percy.'
      },
      {
        slug: 'rent-estimate',
        icon: FiTrendingUp,
        title: 'Rent Estimates',
        description: 'Know exactly what your unit is worth before you list. Get instant, data-driven rent ranges based on real comparable listings near your property.'
      },
      {
        slug: 'all-in-one-dashboard',
        icon: FiLayout,
        title: 'All-in-One Dashboard',
        description: 'See everything that matters in one place. Real-time updates on properties, tenants, leases, and finances—no more switching apps or spreadsheets.'
      }
    ]
  }
];

export default function FeaturesPage() {
  const pageSchema = webPageSchema({
    path: '/features',
    name: 'Property Management Software Features | Property Peace',
    description: 'Explore Property Peace features for small landlords: rent collection, maintenance, leases, accounting, documents, messaging, and Percy Pilot tools for 1–50 units.',
  });

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Property Peace",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://propertypeace.io/features",
    description: "Property management software features for independent landlords: rent, maintenance, leases, accounting, documents, messaging, and Percy Pilot tools.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Built for hands-on landlords with 1–50 units. Start free; premium plans available." },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://propertypeace.io" },
      { "@type": "ListItem", position: 2, name: "Features", item: "https://propertypeace.io/features" },
    ],
  };

  return (
    <div className="min-h-screen bg-brand-forest">
      <StructuredData data={pageSchema} />
      <StructuredData data={softwareSchema} />
      <StructuredData data={breadcrumbSchema} />

      <main className="overflow-hidden">
        {/* Hero */}
        <section className="relative bg-brand-forest px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pb-20 lg:pt-28">
          <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[color-mix(in_srgb,var(--brand-teal)_10%,transparent)] via-brand-forest to-brand-forest" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--brand-teal)_20%,transparent)] bg-brand-mint px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-teal"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Features built for small landlords
              </span>
              <h1
                className="mt-5 max-w-4xl text-4xl font-extrabold tracking-tight text-white md:text-5xl lg:text-6xl"
                style={{ fontFamily: '"Host Grotesk", sans-serif' }}
              >
                All your rental workflows, <span className="text-brand-mint">finally in one calm system.</span>
              </h1>
              <p
                className="mt-5 max-w-2xl text-lg leading-8 text-white/75 md:text-xl"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Explore the practical tools inside Property Peace: rent collection, maintenance tracking, lease workflows, accounting, documents, tenant messaging, and Percy Pilot features built for portfolios with 1–50 units.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="https://app.propertypeace.io/register"
                  className="inline-flex items-center justify-center gap-2 rounded-none bg-gradient-to-r from-brand-teal to-brand-teal px-5 py-3 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:from-brand-teal hover:to-brand-teal-hover hover:shadow-[0_10px_24px_rgba(36,117,104,0.28)]"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  Start free
                  <FiArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center rounded-none border border-[var(--brand-border)] bg-brand-surface px-5 py-3 font-semibold text-brand-forest shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-mint hover:shadow-lg hover:shadow-[color:color-mix(in_srgb,var(--brand-forest)_5%,transparent)]"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  Book a demo
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-brand-slate" style={{ fontFamily: '"Inter", sans-serif' }}>
                {['No credit card required', 'Free forever plan', 'Built for 1–50 units'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-border)] bg-brand-surface px-3 py-1.5 shadow-sm">
                    <FiCheck className="h-4 w-4 text-brand-teal" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--brand-mint)_40%,transparent)] blur-3xl" />
              <div className="absolute -bottom-10 -left-8 h-44 w-44 rounded-full bg-[color-mix(in_srgb,var(--brand-forest)_10%,transparent)] blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] bg-brand-forest p-5 shadow-2xl shadow-[color:color-mix(in_srgb,var(--brand-forest)_20%,transparent)]">
                <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-mint">Property Peace</p>
                    <p className="mt-1 text-sm text-white/70">Today&apos;s landlord dashboard</p>
                  </div>
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--brand-teal)_15%,transparent)] px-3 py-1 text-sm font-semibold text-brand-mint">Live</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Rent recorded', '$8,420', '3 ledger entries updated'],
                    ['Open maintenance', '4', 'Percy sorted by priority'],
                    ['Lease renewals', '2', 'Reminders already queued'],
                    ['Tax-ready records', '98%', 'Expenses categorized'],
                  ].map(([label, value, caption]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-sm text-white/60">{label}</p>
                      <p className="mt-3 text-2xl font-bold text-white" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>{value}</p>
                      <p className="mt-1 text-xs text-brand-mint">{caption}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-brand-surface p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-brand-forest">Percy summary</p>
                      <p className="mt-1 text-sm text-brand-slate">Two tenants need follow-up. One maintenance request is waiting on photos.</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-mint text-brand-teal">
                      <FiActivity className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features by Category */}
        <section className="bg-brand-forest px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-16">
            {featureCategories.map((category) => {
              const details = categoryDetails[category.title];
              return (
                <div key={category.title}>
                  <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div className="max-w-2xl">
                      <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-mint">{details.eyebrow}</p>
                      <h2
                        className="mt-3 text-3xl font-extrabold text-white md:text-4xl"
                        style={{ fontFamily: '"Host Grotesk", sans-serif' }}
                      >
                        {category.title}
                      </h2>
                    </div>
                    <p className="max-w-xl text-base leading-7 text-white/75 md:text-right" style={{ fontFamily: '"Inter", sans-serif' }}>
                      {details.description}
                    </p>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {category.features.map((feature) => {
                      const IconComponent = feature.icon;
                      return (
                        <Link
                          key={feature.slug}
                          href={`/features/${feature.slug}`}
                          className="group relative flex h-full flex-col overflow-hidden rounded-none border border-[var(--brand-border)] bg-brand-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-mint hover:shadow-xl hover:shadow-[color:color-mix(in_srgb,var(--brand-forest)_8%,transparent)]"
                        >
                          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-teal to-transparent opacity-80" />
                          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-mint text-brand-teal ring-1 ring-[color:color-mix(in_srgb,var(--brand-teal)_10%,transparent)] transition group-hover:bg-brand-teal group-hover:text-white group-hover:shadow-[0_10px_24px_rgba(36,117,104,0.24)]">
                            <IconComponent className="h-6 w-6" />
                          </div>
                          <h3
                            className="text-xl font-extrabold leading-snug text-primary-main md:text-2xl"
                            style={{ fontFamily: '"Host Grotesk", sans-serif' }}
                          >
                            {feature.title}
                          </h3>
                          <p
                            className="mt-3 flex-1 text-base leading-7 text-brand-slate"
                            style={{ fontFamily: '"Inter", sans-serif' }}
                          >
                            {feature.description}
                          </p>
                          <span
                            className="mt-6 inline-flex items-center gap-2 font-semibold text-brand-teal transition-colors group-hover:text-brand-teal"
                            style={{ fontFamily: '"Inter", sans-serif' }}
                          >
                            Learn more
                            <FiArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Call to Action */}
        <section className="bg-brand-forest px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-brand-forest p-8 text-center shadow-2xl shadow-[color:color-mix(in_srgb,var(--brand-forest)_15%,transparent)] md:p-12">
            <span className="inline-flex rounded-full border border-[color:color-mix(in_srgb,var(--brand-teal)_20%,transparent)] bg-[color-mix(in_srgb,var(--brand-mint)_10%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-mint">
              Ready when you are
            </span>
            <h2
              className="mt-5 text-3xl font-extrabold text-white md:text-5xl"
              style={{ fontFamily: '"Host Grotesk", sans-serif' }}
            >
              Start with the tools you need today. Grow into the rest tomorrow.
            </h2>
            <p
              className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/70"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Property Peace keeps rent, maintenance, leases, accounting, documents, and Percy insights connected from day one.
            </p>
            <ul className="mt-7 flex flex-wrap justify-center gap-x-8 gap-y-3 font-medium text-white/85" style={{ fontFamily: '"Inter", sans-serif' }}>
              <li className="flex items-center gap-2"><FiCheck className="text-brand-mint" /> No credit card required</li>
              <li className="flex items-center gap-2"><FiCheck className="text-brand-mint" /> Free forever plan</li>
              <li className="flex items-center gap-2"><FiCheck className="text-brand-mint" /> Built for landlords with 1–50 units</li>
            </ul>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="https://app.propertypeace.io/register"
                className="inline-flex items-center justify-center gap-2 rounded-none bg-gradient-to-r from-brand-teal to-brand-teal px-5 py-3 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:from-brand-teal hover:to-brand-teal-hover hover:shadow-[0_10px_24px_rgba(36,117,104,0.25)]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Start free
                <FiZap className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-none border border-white/15 bg-white/10 px-5 py-3 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/15"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                View pricing
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
