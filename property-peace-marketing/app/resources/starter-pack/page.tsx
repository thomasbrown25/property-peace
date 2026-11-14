import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiDownload,
  FiFileText,
  FiGrid,
  FiHome,
  FiShield,
} from 'react-icons/fi';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/resources/starter-pack/', {
  title: 'Free Landlord Starter Pack | Property Peace',
  description: 'Download five practical landlord resources: inspection and turnover checklists, a maintenance calendar, a pre-screening worksheet, and an editable cash-flow workbook.',
  keywords: 'free landlord starter pack, landlord checklist PDF, rental property spreadsheet, move in checklist, turnover checklist, maintenance calendar',
  alternates: { canonical: '/resources/starter-pack' },
  openGraph: {
    title: 'Free Landlord Starter Pack | Property Peace',
    description: 'Five real, printable or editable resources for organizing a small rental portfolio.',
    type: 'website',
  },
});

const base = '/downloads/landlord-starter-pack';

const downloads = [
  {
    title: 'Move-In / Move-Out Inspection Checklist',
    description: 'A room-by-room PDF for condition notes, photographs, key counts, handoffs, and signatures.',
    href: `${base}/move-in-move-out-inspection-checklist.pdf`,
    format: 'Printable PDF',
    icon: FiHome,
  },
  {
    title: 'Rental Turnover Checklist',
    description: 'A documented sequence from possession through inspection, repairs, cleaning, and the next move-in.',
    href: `${base}/rental-turnover-checklist.pdf`,
    format: 'Printable PDF',
    icon: FiCheckCircle,
  },
  {
    title: 'Preventive Maintenance Calendar',
    description: 'A twelve-month planning worksheet with suggested focus areas and room for property-specific tasks.',
    href: `${base}/preventive-maintenance-calendar.pdf`,
    format: 'Printable PDF',
    icon: FiCalendar,
  },
  {
    title: 'Fair-Housing-Safe Pre-Screening Worksheet',
    description: 'Neutral early questions, a consistent prospect log, and clear reminders about questions to avoid.',
    href: `${base}/fair-housing-safe-pre-screening-worksheet.pdf`,
    format: 'Printable PDF',
    icon: FiShield,
  },
  {
    title: 'Rental Property Cash-Flow Workbook',
    description: 'An editable monthly workbook with annual totals, operating income, expenses, NOI, debt, reserves, and cash flow.',
    href: `${base}/rental-property-cash-flow-workbook.xlsx`,
    format: 'Editable XLSX',
    icon: FiGrid,
  },
];

const pageSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Property Peace Landlord Starter Pack',
  description: 'Five practical landlord checklists, worksheets, and an editable cash-flow workbook.',
  url: 'https://propertypeace.io/resources/starter-pack/',
  isPartOf: { '@type': 'WebSite', name: 'Property Peace', url: 'https://propertypeace.io/' },
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: downloads.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.title,
      url: `https://propertypeace.io${item.href}`,
    })),
  },
};

export default function LandlordStarterPackPage() {
  return (
    <main className="min-h-screen bg-brand-forest text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />

      <section data-marketing-hero-theme="dark" className="relative overflow-hidden bg-brand-forest px-4 pb-20 pt-32 text-white sm:px-6 md:pb-24 md:pt-36 lg:px-8">
        <div className="pointer-events-none absolute -right-20 top-16 h-96 w-96 rounded-full bg-brand-teal opacity-10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-0 h-96 w-96 rounded-full bg-brand-mint opacity-10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl">
          <Link href="/resources" className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-mint transition hover:text-white">
            <FiArrowLeft className="h-4 w-4" /> Back to the Resource Center
          </Link>
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 border border-brand-mint bg-brand-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">
                <FiFileText className="h-4 w-4" /> Five real downloads
              </div>
              <h1 className="max-w-4xl text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>
                A landlord starter pack you can actually use.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80 md:text-xl">
                Print the checklists. Edit the cash-flow workbook. Keep clean records from the first prospect conversation through move-out and the next turnover.
              </p>
            </div>
            <div className="border border-brand-mint bg-brand-surface p-6 shadow-xl md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">Download the complete pack</p>
              <p className="mt-3 text-sm leading-6 text-brand-slate">One ZIP containing four printable PDFs, one editable spreadsheet, and a short README.</p>
              <a href={`${base}/property-peace-landlord-starter-pack.zip`} download className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 bg-brand-teal px-6 py-3.5 font-bold text-white transition hover:bg-brand-teal-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal">
                <FiDownload className="h-5 w-5" /> Download all five resources
              </a>
              <p className="mt-3 text-center text-xs text-brand-slate">ZIP file • no email required</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-brand-forest px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-brand-mint">Choose only what you need</p>
            <h2 className="text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>Five practical files, not five thin articles</h2>
            <p className="mt-4 text-lg leading-8 text-white/80">Every resource is downloadable on its own. The PDFs are designed for printing, while the workbook is ready for property-level monthly inputs.</p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {downloads.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.href} className="group flex h-full flex-col border border-brand-mint bg-brand-surface p-6 transition hover:-translate-y-1 hover:border-brand-teal hover:shadow-xl md:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center bg-brand-forest text-brand-mint transition group-hover:bg-brand-forest-hover"><Icon className="h-5 w-5" /></span>
                    <span className="bg-brand-ivory px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">{item.format}</span>
                  </div>
                  <h3 className="mt-6 text-xl font-bold leading-snug text-brand-forest" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>{item.title}</h3>
                  <p className="mt-3 flex-1 leading-7 text-brand-slate">{item.description}</p>
                  <a href={item.href} download className="mt-6 inline-flex min-h-11 items-center gap-2 border-t border-brand-mint pt-4 font-bold text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal">
                    Download file <FiDownload className="h-4 w-4 transition group-hover:translate-y-0.5" />
                  </a>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-brand-forest px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[0.9fr_1.1fr]">
          <div className="border border-brand-mint bg-brand-ivory p-7 md:p-8">
            <FiShield className="h-7 w-7 text-brand-teal" />
            <h2 className="mt-5 text-2xl font-bold text-brand-forest" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>Use these as a starting point</h2>
            <p className="mt-3 leading-7 text-brand-slate">These are educational planning aids—not legal, tax, accounting, screening, safety, or compliance advice. Requirements vary by property and location. Verify current primary sources and consult qualified local professionals.</p>
          </div>
          <div className="bg-brand-forest-raised p-7 text-white md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-mint">From worksheet to property record</p>
            <h2 className="mt-4 text-2xl font-bold text-white md:text-3xl" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>Keep the completed work organized in Property Peace.</h2>
            <p className="mt-4 leading-7 text-white/70">Bring properties, tenants, lease records, maintenance, documents, rent tracking, and expenses into one property-first workspace.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="https://app.propertypeace.io/register" className="inline-flex min-h-[48px] items-center justify-center gap-2 bg-brand-mint px-6 py-3 font-bold text-brand-forest transition hover:bg-brand-ivory">Start free <FiArrowRight className="h-4 w-4" /></Link>
              <Link href="/features" className="inline-flex min-h-[48px] items-center justify-center gap-2 border border-white/25 px-6 py-3 font-bold text-white transition hover:bg-white/10">See product workflows</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
