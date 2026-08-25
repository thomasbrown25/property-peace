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
    <div className="min-h-screen bg-white">
      <StructuredData data={pageSchema} />
      <StructuredData data={softwareSchema} />
      <StructuredData data={breadcrumbSchema} />

      <main className="overflow-hidden">
        {/* Hero */}
        <section className="relative bg-white px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pb-20 lg:pt-28">
          <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-green-50/80 via-white to-white" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-green-600"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Features built for small landlords
              </span>
              <h1
                className="mt-5 max-w-4xl text-4xl font-bold tracking-tight text-primary-main md:text-5xl lg:text-6xl"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                All your rental workflows, <span className="text-green-600">finally in one calm system.</span>
              </h1>
              <p
                className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Explore the practical tools inside Property Peace: rent collection, maintenance tracking, lease workflows, accounting, documents, tenant messaging, and Percy Pilot features built for portfolios with 1–50 units.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="https://app.propertypeace.io/register"
                  className="inline-flex items-center justify-center gap-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-5 py-3 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700 hover:shadow-[0_10px_24px_rgba(34,197,94,0.28)]"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  Start free
                  <FiArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center rounded-none border border-slate-200 bg-white px-5 py-3 font-semibold text-[#061e35] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-green-200 hover:shadow-lg hover:shadow-slate-950/5"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  Book a demo
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-slate-600" style={{ fontFamily: '"Inter", sans-serif' }}>
                {['No credit card required', 'Free forever plan', 'Built for 1–50 units'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                    <FiCheck className="h-4 w-4 text-green-600" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-green-200/40 blur-3xl" />
              <div className="absolute -bottom-10 -left-8 h-44 w-44 rounded-full bg-[#061e35]/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] bg-[#061e35] p-5 shadow-2xl shadow-slate-950/20">
                <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-400">Property Peace</p>
                    <p className="mt-1 text-sm text-white/70">Today&apos;s landlord dashboard</p>
                  </div>
                  <span className="rounded-full bg-green-500/15 px-3 py-1 text-sm font-semibold text-green-300">Live</span>
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
                      <p className="mt-3 text-2xl font-bold text-white" style={{ fontFamily: '"Poppins", sans-serif' }}>{value}</p>
                      <p className="mt-1 text-xs text-green-200">{caption}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#061e35]">Percy summary</p>
                      <p className="mt-1 text-sm text-slate-500">Two tenants need follow-up. One maintenance request is waiting on photos.</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-600">
                      <FiActivity className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features by Category */}
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-16">
            {featureCategories.map((category) => {
              const details = categoryDetails[category.title];
              return (
                <div key={category.title}>
                  <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div className="max-w-2xl">
                      <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-600">{details.eyebrow}</p>
                      <h2
                        className="mt-3 text-3xl font-bold text-primary-main md:text-4xl"
                        style={{ fontFamily: '"Poppins", sans-serif' }}
                      >
                        {category.title}
                      </h2>
                    </div>
                    <p className="max-w-xl text-base leading-7 text-slate-500 md:text-right" style={{ fontFamily: '"Inter", sans-serif' }}>
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
                          className="group relative flex h-full flex-col overflow-hidden rounded-none border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-green-300 hover:shadow-xl hover:shadow-slate-950/8"
                        >
                          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-500 to-transparent opacity-80" />
                          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-600 ring-1 ring-green-500/10 transition group-hover:bg-green-500 group-hover:text-white group-hover:shadow-[0_10px_24px_rgba(34,197,94,0.24)]">
                            <IconComponent className="h-6 w-6" />
                          </div>
                          <h3
                            className="text-xl font-bold leading-snug text-primary-main md:text-2xl"
                            style={{ fontFamily: '"Poppins", sans-serif' }}
                          >
                            {feature.title}
                          </h3>
                          <p
                            className="mt-3 flex-1 text-base leading-7 text-slate-500"
                            style={{ fontFamily: '"Inter", sans-serif' }}
                          >
                            {feature.description}
                          </p>
                          <span
                            className="mt-6 inline-flex items-center gap-2 font-semibold text-green-600 transition-colors group-hover:text-green-700"
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
        <section className="bg-white px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-[#061e35] p-8 text-center shadow-2xl shadow-slate-950/15 md:p-12">
            <span className="inline-flex rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-green-300">
              Ready when you are
            </span>
            <h2
              className="mt-5 text-3xl font-bold text-white md:text-5xl"
              style={{ fontFamily: '"Poppins", sans-serif' }}
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
              <li className="flex items-center gap-2"><FiCheck className="text-green-400" /> No credit card required</li>
              <li className="flex items-center gap-2"><FiCheck className="text-green-400" /> Free forever plan</li>
              <li className="flex items-center gap-2"><FiCheck className="text-green-400" /> Built for landlords with 1–50 units</li>
            </ul>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="https://app.propertypeace.io/register"
                className="inline-flex items-center justify-center gap-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-5 py-3 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700 hover:shadow-[0_10px_24px_rgba(34,197,94,0.25)]"
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
