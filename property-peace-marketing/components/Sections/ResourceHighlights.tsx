import Link from 'next/link';
import { FiArrowRight, FiBookOpen, FiDownload } from 'react-icons/fi';

const highlights = [
  {
    type: '5 Downloads',
    title: 'Free Landlord Starter Pack',
    description: 'Print four practical checklists and worksheets, then edit the rental cash-flow workbook for each property.',
    href: '/resources/starter-pack',
    icon: FiDownload,
  },
  {
    type: 'Guide',
    title: 'Rental property cash flow',
    description: 'Learn which rent, vacancy, operating cost, reserve, debt, and property-level performance inputs to track.',
    href: '/blog/rental-property-cash-flow-template-landlords',
    icon: FiBookOpen,
  },
  {
    type: 'Guide',
    title: 'Preventive maintenance planning',
    description: 'Turn monthly and seasonal checks into a documented repair workflow.',
    href: '/blog/landlord-maintenance-checklist-prevent-costly-repairs',
    icon: FiBookOpen,
  },
];

export default function ResourceHighlights() {
  return (
    <section className="border-y border-slate-200 bg-[#F7F9F8] px-4 py-16 sm:px-6 lg:px-8 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-green-700">Landlord Resource Center</p>
            <h2 className="text-3xl font-bold text-primary-main md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
              Useful before you ever open the app
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#637083]">Practical education for the actual work: documenting a turnover, understanding cash flow, and staying ahead of repairs.</p>
          </div>
          <Link href="/resources" className="inline-flex min-h-11 items-center gap-2 font-bold text-green-700">
            Browse all resources
            <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {highlights.map((highlight) => {
            const Icon = highlight.icon;
            return (
              <Link key={highlight.href} href={highlight.href} className="group flex h-full flex-col border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-green-200 hover:shadow-[0_14px_36px_rgba(6,30,53,0.08)]">
                <div className="flex items-center justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center bg-[#061e35] text-white transition group-hover:bg-green-600"><Icon className="h-5 w-5" /></span>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">{highlight.type}</span>
                </div>
                <h3 className="mt-6 text-xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>{highlight.title}</h3>
                <p className="mt-3 flex-1 leading-7 text-[#637083]">{highlight.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 border-t border-slate-100 pt-4 font-bold text-green-700">Open resource <FiArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
