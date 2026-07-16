import Link from 'next/link';
import { FiArrowRight } from 'react-icons/fi';

const pathways = [
  {
    title: 'Free landlord software',
    description: 'Start with a free plan for up to 2 units, then upgrade when your rental workflow grows.',
    href: '/free-landlord-software',
  },
  {
    title: 'Small landlord software',
    description: 'A focused property management system for independent landlords with 1–50 units.',
    href: '/property-management-software-for-small-landlords',
  },
  {
    title: 'Rent collection software',
    description: 'Track rent status, payment history, overdue balances, and reminders in one place.',
    href: '/rent-collection-software-for-landlords',
  },
  {
    title: 'Maintenance request software',
    description: 'Keep tenant requests, photos, messages, vendors, and repair history organized.',
    href: '/maintenance-request-software-for-landlords',
  },
  {
    title: 'Landlord accounting software',
    description: 'Organize rental income, expenses, reports, receipts, and tax-ready records.',
    href: '/landlord-accounting-software',
  },
  {
    title: 'Spreadsheet alternative',
    description: 'Replace rental spreadsheets with connected records for properties, tenants, leases, and tasks.',
    href: '/property-management-spreadsheet-alternative',
  },
];

export default function SeoPathways() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-600 mb-3">Landlord workflows</p>
          <h2 className="text-3xl md:text-4xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>
            Built for the rental jobs small landlords search for every day
          </h2>
          <p className="mt-4 text-lg text-[#637083]" style={{ fontFamily: '"Inter", sans-serif' }}>
            Choose the workflow you need most: rent, maintenance, accounting, leases, or replacing a spreadsheet that has become too messy to trust.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {pathways.map((pathway) => (
            <Link
              key={pathway.href}
              href={pathway.href}
              className="group rounded-none border border-slate-200 bg-slate-50 p-6 transition hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50/60 hover:shadow-lg hover:shadow-blue-950/5"
            >
              <h3 className="text-xl font-bold text-primary-main">{pathway.title}</h3>
              <p className="mt-3 leading-7 text-[#637083]">{pathway.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 font-bold text-green-600">
                Learn more
                <FiArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
