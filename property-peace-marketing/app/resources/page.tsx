import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiCompass,
  FiHelpCircle,
  FiShield,
} from 'react-icons/fi';
import ResourceLibrary from './ResourceLibrary';
import { getResourceHref, resourceEntries, resourcePathways } from '@/lib/resource-library';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/resources/', {
  title: 'Landlord Guides & Checklists | Property Peace',
  description: 'Practical landlord guides and checklists for tenant screening, leases, rent tracking, accounting, maintenance, and move-in workflows.',
  keywords: 'landlord resources, landlord guides, rental property checklist, property management education, small landlord tools',
  alternates: { canonical: '/resources' },
  openGraph: {
    title: 'Landlord Resource Center | Property Peace',
    description: 'Practical guides and checklists organized around the rental jobs independent landlords handle every day.',
    type: 'website',
  },
});

const featuredResources = resourceEntries.filter((resource) => resource.featured);

const collectionSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Property Peace Landlord Resource Center',
  description: 'Practical landlord guides and checklists organized by rental workflow.',
  url: 'https://propertypeace.io/resources/',
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: resourceEntries.map((resource, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `https://propertypeace.io${getResourceHref(resource)}/`,
      name: resource.title,
    })),
  },
};

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />

      <section className="relative overflow-hidden bg-[#061e35] px-4 pb-16 pt-32 text-white sm:px-6 md:pb-20 md:pt-36 lg:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="pointer-events-none absolute -right-24 top-10 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-0 h-96 w-96 rounded-full bg-blue-400/15 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
              <FiCompass className="h-4 w-4" />
              Landlord Resource Center
            </div>
            <h1 className="max-w-4xl text-4xl font-bold leading-tight sm:text-5xl md:text-6xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
              Clear guidance for the rental work that happens between the big moments.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70 md:text-xl">
              Explore practical guides and checklists for leases, tenants, rent records, maintenance, and the day-to-day systems that keep a small portfolio organized.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="#resource-library" className="inline-flex min-h-[52px] items-center justify-center gap-2 bg-green-700 px-6 py-3.5 font-bold text-white transition hover:-translate-y-0.5 hover:bg-green-600">
                Browse resources
                <FiArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/blog" className="inline-flex min-h-[52px] items-center justify-center gap-2 border border-white/20 bg-white/[0.06] px-6 py-3.5 font-bold text-white transition hover:bg-white/10">
                View all articles
              </Link>
            </div>
          </div>

          <div className="border border-white/12 bg-white/[0.07] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.22)] backdrop-blur-sm md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Start with a practical resource</p>
            <div className="mt-5 divide-y divide-white/10">
              {featuredResources.map((resource) => (
                <Link key={resource.slug} href={getResourceHref(resource)} className="group flex items-start gap-4 py-5 first:pt-0 last:pb-0">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-emerald-300/12 text-emerald-200">
                    <FiCheckCircle className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold uppercase tracking-[0.14em] text-white/50">{resource.type}</span>
                    <span className="mt-1 block font-bold leading-snug text-white transition group-hover:text-emerald-200">{resource.title}</span>
                  </span>
                  <FiArrowRight className="mt-2 h-4 w-4 flex-shrink-0 text-white/45 transition group-hover:translate-x-1 group-hover:text-emerald-200" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-[#F7F9F8] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-9 max-w-3xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-green-700">Follow the rental workflow</p>
            <h2 className="text-3xl font-bold text-primary-main md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
              Learn in the same order you manage a rental
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#637083]">The library follows the landlord journey so the next useful answer is easier to find.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {resourcePathways.map((pathway) => {
              const Icon = pathway.icon;
              return (
                <div key={pathway.title} className="group border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-green-200 hover:shadow-lg hover:shadow-slate-950/5">
                  <span className="flex h-11 w-11 items-center justify-center bg-[#061e35] text-white transition group-hover:bg-green-600"><Icon className="h-5 w-5" /></span>
                  <h3 className="mt-5 text-lg font-bold leading-snug text-primary-main">{pathway.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#637083]">{pathway.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <ResourceLibrary />

      <section className="bg-[#F7F9F8] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          <div className="border border-slate-200 bg-white p-7 md:p-8">
            <FiShield className="h-7 w-7 text-green-600" />
            <h2 className="mt-5 text-2xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>Use education as a starting point</h2>
            <p className="mt-3 leading-7 text-[#637083]">Rental rules can vary by state and city. Check current primary sources and qualified local professionals before relying on general educational information for legal, tax, or compliance decisions.</p>
            <Link href="/lease-shield" className="mt-5 inline-flex min-h-11 items-center gap-2 font-bold text-green-700">Explore LeaseShield sources <FiArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="border border-slate-200 bg-white p-7 md:p-8">
            <FiHelpCircle className="h-7 w-7 text-green-600" />
            <h2 className="mt-5 text-2xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>Looking for product help?</h2>
            <p className="mt-3 leading-7 text-[#637083]">The Resource Center explains landlord workflows. The Help Center covers Property Peace setup, features, and account questions.</p>
            <Link href="/help-center" className="mt-5 inline-flex min-h-11 items-center gap-2 font-bold text-green-700">Visit the Help Center <FiArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl bg-[#061e35] p-8 text-white md:flex md:items-center md:justify-between md:gap-10 md:p-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-emerald-200"><FiBookOpen className="h-4 w-4" /> From guide to workflow</div>
            <h2 className="mt-4 text-3xl font-bold md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Put the useful parts into one calm system.</h2>
            <p className="mt-4 text-lg leading-8 text-white/70">Organize properties, tenants, lease records, rent tracking, maintenance, documents, and expenses without rebuilding another spreadsheet.</p>
          </div>
          <Link href="https://app.propertypeace.io/register" className="mt-7 inline-flex min-h-[52px] flex-shrink-0 items-center justify-center gap-2 bg-green-700 px-7 py-3.5 font-bold text-white transition hover:bg-green-600 md:mt-0">
            Start free
            <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
