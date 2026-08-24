import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FiArrowRight,
  FiDollarSign,
  FiFileText,
  FiHome,
  FiMessageSquare,
  FiTool,
} from 'react-icons/fi';
import StructuredData from '@/components/SEO/StructuredData';
import { webPageSchema } from '@/lib/structured-data';

const description = 'See how Property Peace connects properties, applications, leases, rent records, expenses, tenant communication, and maintenance for independent landlords.';

export const metadata: Metadata = {
  title: 'How Property Peace Works | Rental Management Workflow',
  description,
  alternates: { canonical: 'https://propertypeace.io/how-it-works/' },
  openGraph: {
    title: 'How Property Peace Works',
    description,
    type: 'website',
    url: 'https://propertypeace.io/how-it-works/',
  },
};

const workflow = [
  {
    icon: FiHome,
    label: 'Set the foundation',
    title: 'Give every property one dependable record.',
    body: 'Add properties and units, then keep tenant details, files, notes, and important dates connected to the right place.',
    links: [
      { label: 'Property management', href: '/features/property-management' },
      { label: 'Document management', href: '/features/document-management' },
    ],
  },
  {
    icon: FiFileText,
    label: 'Fill a vacancy',
    title: 'Move from a shareable listing to a completed application.',
    body: 'Publish a listing, invite an interested renter through a secure link, and keep the submitted application PDF and review notes together.',
    note: 'Property Peace does not currently provide credit, criminal, eviction, or other consumer-report screening.',
    links: [
      { label: 'Rental listings', href: '/listings' },
      { label: 'Rental applications', href: '/features/rental-applications' },
    ],
  },
  {
    icon: FiFileText,
    label: 'Put the lease in order',
    title: 'Keep terms, dates, documents, and handoffs visible.',
    body: 'Create and organize lease records, store supporting documents, track renewal dates, and preserve condition reports alongside the tenancy.',
    note: 'Integrated e-signature is not currently available.',
    links: [
      { label: 'Lease management', href: '/features/lease-management' },
      { label: 'Condition reports', href: '/lease/online-condition-reports' },
    ],
  },
  {
    icon: FiDollarSign,
    label: 'Run the month',
    title: 'Know what was recorded, what is due, and what the property costs.',
    body: 'Use the rent ledger, overdue calculations, late-fee tools, expense records, and financial reports to maintain a readable history.',
    note: 'Online rent payment processing is planned and is not currently available.',
    links: [
      { label: 'Rent tracking', href: '/features/rent-collection' },
      { label: 'Landlord accounting', href: '/landlord-accounting-software' },
    ],
  },
  {
    icon: FiTool,
    label: 'Keep the home running',
    title: 'Turn a tenant report into a trackable repair history.',
    body: 'Tenants can report an issue, add photos, and receive updates while you organize priority, messages, work status, and the record of what happened.',
    links: [
      { label: 'Maintenance requests', href: '/maintenance-request-software-for-landlords' },
      { label: 'Tenant communication', href: '/features/tenant-communication' },
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white">
      <StructuredData data={webPageSchema({ path: '/how-it-works/', name: 'How Property Peace Works', description })} />

      <section className="relative overflow-hidden px-4 pb-20 pt-32 sm:px-6 md:pb-24 md:pt-40 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-b from-[#eaf4fb] via-[#f7fbfd] to-white" />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-end gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#16a34a]">How Property Peace works</p>
              <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.02] tracking-[-0.05em] text-[#061e35] sm:text-5xl md:text-6xl lg:text-7xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
                Every rental has a rhythm. Keep yours moving.
              </h1>
            </div>
            <div className="border-l-4 border-[#22c55e] pl-6">
              <p className="text-lg leading-8 text-slate-600" style={{ fontFamily: '"Inter", sans-serif' }}>
                Property Peace connects the recurring work around each rental—from the first listing to the next repair—without turning a small portfolio into an enterprise project.
              </p>
              <Link href="https://app.propertypeace.io/register" className="mt-6 inline-flex items-center gap-2 font-bold text-[#16a34a] transition hover:text-green-700">
                Start free <FiArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-5 border border-slate-200 bg-white shadow-[0_24px_80px_rgba(6,30,53,0.10)]" aria-label="Rental workflow overview">
            {workflow.map(({ icon: Icon, label }, index) => (
              <div key={label} className="relative flex min-h-28 flex-col justify-between border-r border-slate-200 p-3 last:border-r-0 sm:p-5">
                <span className="text-[10px] font-bold tabular-nums text-slate-400 sm:text-xs">0{index + 1}</span>
                <Icon className="h-5 w-5 text-[#16a34a]" />
                <span className="hidden text-xs font-semibold leading-5 text-[#061e35] sm:block">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="relative">
            <div className="absolute bottom-0 left-[27px] top-0 hidden w-px bg-slate-200 md:block" />
            {workflow.map(({ icon: Icon, label, title, body, note, links }, index) => (
              <section key={label} className="relative grid gap-6 border-t border-slate-200 py-12 first:border-t-0 md:grid-cols-[56px_0.72fr_1.28fr] md:gap-10 md:py-16">
                <div className="relative z-10 hidden h-14 w-14 items-center justify-center border border-slate-200 bg-white text-[#16a34a] shadow-sm md:flex">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#16a34a]">0{index + 1} · {label}</p>
                  <h2 className="mt-4 text-2xl font-bold leading-tight tracking-[-0.025em] text-[#061e35] md:text-3xl" style={{ fontFamily: '"Poppins", sans-serif' }}>{title}</h2>
                </div>
                <div>
                  <p className="text-lg leading-8 text-slate-600" style={{ fontFamily: '"Inter", sans-serif' }}>{body}</p>
                  {note && <p className="mt-4 border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{note}</p>}
                  <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
                    {links.map((link) => (
                      <Link key={link.href} href={link.href} className="inline-flex items-center gap-2 text-sm font-bold text-[#16a34a] transition hover:text-green-700">
                        {link.label} <FiArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <section className="bg-[#061e35] px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-5 flex items-center gap-3 text-[#22c55e]"><FiMessageSquare className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.22em]">Ready when the next task arrives</span></div>
            <h2 className="max-w-3xl text-3xl font-bold tracking-[-0.035em] md:text-5xl" style={{ fontFamily: '"Poppins", sans-serif' }}>One property record. A clearer next move.</h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">Start free for up to five units, or book a walkthrough to see how the workflows fit your portfolio.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link href="https://app.propertypeace.io/register" className="inline-flex min-h-12 items-center justify-center gap-2 px-8 py-3.5 font-bold text-white transition hover:brightness-95" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>Start free <FiArrowRight className="h-4 w-4" /></Link>
            <Link href="/demo" className="inline-flex min-h-12 items-center justify-center border border-white/20 px-8 py-3.5 font-semibold text-white transition hover:bg-white/10">Book a demo</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
