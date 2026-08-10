import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiExternalLink,
  FiHome,
  FiInfo,
  FiMinus,
  FiUsers,
} from 'react-icons/fi';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/comparison/turbotenant/', {
  title: 'Property Peace vs. TurboTenant: Pricing & Fees',
  description: 'A dated, source-linked comparison of Property Peace and TurboTenant pricing, unit tiers, applicant and tenant fees, workflows, and current feature availability.',
  keywords: 'Property Peace vs TurboTenant, TurboTenant alternative, TurboTenant pricing, landlord software comparison, renter fees, property management software',
  alternates: { canonical: '/comparison/turbotenant' },
  openGraph: {
    title: 'Property Peace vs. TurboTenant: A Fair Cost and Workflow Comparison',
    description: 'Compare landlord subscriptions, applicant and tenant costs, portfolio limits, and current workflow availability.',
    type: 'website',
  },
});

const checkedOn = 'August 8, 2026';

const costRows = [
  {
    label: 'Free landlord plan',
    propertyPeace: '$0 for up to 5 total units',
    turboTenant: '$0 with unlimited property listings',
  },
  {
    label: 'Paid landlord plan',
    propertyPeace: 'Premium: $14.99 month-to-month for unlimited units',
    turboTenant: 'Essentials: $149–$349/year; Pro: $199–$999/year, based on unit tier',
  },
  {
    label: 'Annual billing',
    propertyPeace: '$152.90/year for Premium (15% below twelve monthly payments)',
    turboTenant: 'Paid plans are billed annually; published prices rise at 11, 31, and 61+ units',
  },
  {
    label: 'Applicant screening',
    propertyPeace: 'Not currently available as an integrated provider workflow',
    turboTenant: '$55 with a Free landlord; $45 with an upgraded landlord, normally applicant-paid',
  },
  {
    label: 'ACH rent payment',
    propertyPeace: 'No in-platform payment processing currently available',
    turboTenant: '$2 on Free; official plan details identify waived ACH as Pro-only',
  },
  {
    label: 'Card rent payment',
    propertyPeace: 'No in-platform payment processing currently available',
    turboTenant: '3.49% convenience fee on the published renter-cost table',
  },
  {
    label: 'Optional renter products',
    propertyPeace: 'No required renter subscription or partner-product bundle',
    turboTenant: 'Rent reporting: $4.99/month; renters insurance through SURE starts at $11/month on the current pricing page',
  },
  {
    label: 'Lease/forms access',
    propertyPeace: 'Lease records and document storage are available; integrated e-signature currently requires configuration',
    turboTenant: 'Free can build/save a lease draft; a paid plan is required to finalize, print, download, or send. Forms Pack is $199 on Free.',
  },
];

const workflowRows = [
  { workflow: 'Property and unit records', propertyPeace: 'Available; property-first organization', turboTenant: 'Available' },
  { workflow: 'Hosted rental listing', propertyPeace: 'Available on Property Peace', turboTenant: 'Available' },
  { workflow: 'External listing syndication', propertyPeace: 'Coming soon—not currently operational', turboTenant: 'Available according to TurboTenant' },
  { workflow: 'Lead records and showings', propertyPeace: 'Available', turboTenant: 'Available, including pre-screeners and reminders' },
  { workflow: 'Digital rental applications', propertyPeace: 'Available', turboTenant: 'Available' },
  { workflow: 'Integrated tenant screening', propertyPeace: 'Premium-only; currently unavailable pending provider configuration', turboTenant: 'Available with applicant-mediated screening' },
  { workflow: 'Lease records and documents', propertyPeace: 'Available', turboTenant: 'Available; finalization/signing requires a paid plan' },
  { workflow: 'Integrated e-signature', propertyPeace: 'Premium-only; currently unavailable pending e-signature provider configuration', turboTenant: 'Available on paid plans; scope differs by plan' },
  { workflow: 'Rent records and reminders', propertyPeace: 'Manual rent records and landlord-triggered reminders are available; automated reminders are Premium', turboTenant: 'Available with in-platform payment collection' },
  { workflow: 'Online rent processing', propertyPeace: 'Suspended/not currently available', turboTenant: 'Available with payment-method fees described above' },
  { workflow: 'Expenses and accounting', propertyPeace: 'Basic tracking on Free; advanced accounting/reporting on Premium', turboTenant: 'Basic/manual capabilities vary; advanced accounting is Pro' },
  { workflow: 'Maintenance requests', propertyPeace: 'Available and organized by property', turboTenant: 'Available' },
  { workflow: 'Tenant portal', propertyPeace: 'Available', turboTenant: 'Available' },
  { workflow: 'Team access', propertyPeace: 'Organization and team-member access available', turboTenant: 'User roles and permissions are Pro' },
];

const sources = [
  { title: 'TurboTenant pricing and renter-cost table', href: 'https://www.turbotenant.com/pricing/' },
  { title: 'TurboTenant Help Center: plan prices and included features', href: 'https://support.turbotenant.com/en/articles/4003980-is-there-a-cost-to-sign-up-for-turbotenant' },
  { title: 'TurboTenant Help Center: creating a lease agreement', href: 'https://support.turbotenant.com/en/articles/4403674-creating-a-lease-agreement' },
  { title: 'TurboTenant online rent collection', href: 'https://www.turbotenant.com/collect-rent-payments-online/' },
  { title: 'TurboTenant tenant screening', href: 'https://www.turbotenant.com/tenant-screening/' },
  { title: 'TurboTenant rent reporting', href: 'https://www.turbotenant.com/rent-reporting/' },
  { title: 'Property Peace pricing', href: '/pricing' },
  { title: 'Property Peace current feature disclosures', href: '/features' },
];

const pageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Property Peace vs. TurboTenant: Pricing and Fees',
  description: 'A dated comparison of landlord subscriptions, applicant and tenant costs, portfolio limits, and workflow availability.',
  url: 'https://propertypeace.io/comparison/turbotenant/',
  dateModified: '2026-08-08',
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://propertypeace.io/' },
      { '@type': 'ListItem', position: 2, name: 'TurboTenant comparison', item: 'https://propertypeace.io/comparison/turbotenant/' },
    ],
  },
};

function AvailabilityIcon({ value }: { value: string }) {
  if (/not currently|suspended|coming soon|configuration|provider required/i.test(value)) {
    return <FiAlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />;
  }
  if (/available/i.test(value)) {
    return <FiCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-700" aria-hidden="true" />;
  }
  return <FiMinus className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />;
}

export default function TurboTenantComparisonPage() {
  return (
    <main className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />

      <section className="relative overflow-hidden bg-[#061e35] px-4 pb-16 pt-32 text-white sm:px-6 md:pb-20 md:pt-36 lg:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="pointer-events-none absolute -right-24 top-10 h-96 w-96 rounded-full bg-blue-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-0 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <Link href="/" className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-200 transition hover:text-white"><FiArrowLeft className="h-4 w-4" /> Back to Property Peace</Link>
          <div className="grid gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200"><FiInfo className="h-4 w-4" /> Information checked {checkedOn}</div>
              <h1 className="max-w-4xl text-4xl font-bold leading-tight sm:text-5xl md:text-6xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Property Peace vs. TurboTenant—without hiding who pays.</h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70 md:text-xl">Both products offer a free landlord starting point. The meaningful differences are billing cadence, portfolio pricing, renter and applicant costs, property-first organization, and which workflows are actually available today.</p>
            </div>
            <div className="border border-white/15 bg-white/[0.07] p-6 backdrop-blur-sm md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Our comparison standard</p>
              <ul className="mt-5 space-y-4 text-sm leading-6 text-white/75">
                {['Landlord, applicant, and tenant costs shown separately', 'Annual billing shown as annual billing', 'Unavailable and provider-dependent features labeled plainly', 'Official source links and a visible checked date'].map((item) => <li key={item} className="flex gap-3"><FiCheck className="mt-1 h-4 w-4 flex-shrink-0 text-emerald-300" />{item}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-[#F7F9F8] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-green-700">The short answer</p>
            <h2 className="text-3xl font-bold text-primary-main md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Two useful free starts, built around different trade-offs</h2>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-2">
            <article className="border-2 border-green-700 bg-white p-7 md:p-8">
              <div className="flex items-center gap-3"><FiHome className="h-6 w-6 text-green-700" /><h3 className="text-2xl font-bold text-primary-main">Property Peace</h3></div>
              <p className="mt-4 leading-7 text-[#637083]">Best fit for independent landlords who want a property-and-unit-centered workspace, a five-unit free plan, and monthly Premium billing without per-unit pricing.</p>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-[#405a70]">
                <li className="flex gap-2"><FiCheck className="mt-1 h-4 w-4 text-green-700" />Free up to 5 units; no credit card required</li>
                <li className="flex gap-2"><FiCheck className="mt-1 h-4 w-4 text-green-700" />Premium is $14.99/month for unlimited units</li>
                <li className="flex gap-2"><FiAlertCircle className="mt-1 h-4 w-4 text-amber-600" />Online payments, external syndication, screening, and integrated e-signature are not all operational today</li>
              </ul>
            </article>
            <article className="border border-slate-200 bg-white p-7 md:p-8">
              <div className="flex items-center gap-3"><FiUsers className="h-6 w-6 text-[#217eff]" /><h3 className="text-2xl font-bold text-primary-main">TurboTenant</h3></div>
              <p className="mt-4 leading-7 text-[#637083]">Best fit for landlords prioritizing a broad vacancy-to-tenant funnel, integrated screening and online rent payments, and annual portfolio pricing.</p>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-[#405a70]">
                <li className="flex gap-2"><FiCheck className="mt-1 h-4 w-4 text-green-700" />Free plan with unlimited property listings</li>
                <li className="flex gap-2"><FiCheck className="mt-1 h-4 w-4 text-green-700" />Paid plans add leases and deeper workflows</li>
                <li className="flex gap-2"><FiDollarSign className="mt-1 h-4 w-4 text-amber-600" />Applicants and tenants may pay screening, payment-method, reporting, or insurance costs</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl"><p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-green-700">Total stakeholder cost</p><h2 className="text-3xl font-bold text-primary-main md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>What can the rental actually cost?</h2><p className="mt-4 text-lg leading-8 text-[#637083]">Subscription price is only one line. This table separates what the landlord pays from costs that may be paid by an applicant or tenant.</p></div>
          <div className="mt-9 overflow-x-auto border border-slate-200">
            <table className="min-w-[820px] w-full border-collapse text-left">
              <thead className="bg-[#061e35] text-white"><tr><th className="p-4 text-sm font-bold">Cost area</th><th className="p-4 text-sm font-bold">Property Peace</th><th className="p-4 text-sm font-bold">TurboTenant</th></tr></thead>
              <tbody>{costRows.map((row, index) => <tr key={row.label} className={index % 2 ? 'bg-[#F7F9F8]' : 'bg-white'}><th scope="row" className="w-[24%] border-t border-slate-200 p-4 align-top text-sm font-bold text-primary-main">{row.label}</th><td className="w-[38%] border-t border-slate-200 p-4 align-top text-sm leading-6 text-[#405a70]">{row.propertyPeace}</td><td className="w-[38%] border-t border-slate-200 p-4 align-top text-sm leading-6 text-[#405a70]">{row.turboTenant}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-5 flex items-start gap-3 border-l-4 border-amber-500 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><FiAlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" /><p className="!text-amber-950">TurboTenant’s broad “upgraded landlord” renter-cost tab shows free ACH, while its detailed plan matrix and Help Center identify waived ACH as Pro-only. We use the narrower Pro-only statement until TurboTenant clarifies the discrepancy.</p></div>
        </div>
      </section>

      <section className="bg-[#F7F9F8] px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl"><p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-green-700">Workflow availability</p><h2 className="text-3xl font-bold text-primary-main md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Available now is different from listed in a plan</h2><p className="mt-4 text-lg leading-8 text-[#637083]">Property Peace labels globally gated and provider-dependent capabilities instead of counting source code or plan entitlement as a finished customer workflow.</p></div>
          <div className="mt-9 overflow-x-auto border border-slate-200 bg-white">
            <table className="min-w-[860px] w-full border-collapse text-left">
              <thead className="bg-white"><tr><th className="p-4 text-sm font-bold text-primary-main">Workflow</th><th className="p-4 text-sm font-bold text-green-800">Property Peace</th><th className="p-4 text-sm font-bold text-primary-main">TurboTenant</th></tr></thead>
              <tbody>{workflowRows.map((row, index) => <tr key={row.workflow} className={index % 2 ? 'bg-[#F7F9F8]' : 'bg-white'}><th scope="row" className="w-[25%] border-t border-slate-200 p-4 align-top text-sm font-bold text-primary-main">{row.workflow}</th><td className="w-[37.5%] border-t border-slate-200 p-4 align-top"><span className="flex gap-2 text-sm leading-6 text-[#405a70]"><AvailabilityIcon value={row.propertyPeace} />{row.propertyPeace}</span></td><td className="w-[37.5%] border-t border-slate-200 p-4 align-top"><span className="flex gap-2 text-sm leading-6 text-[#405a70]"><AvailabilityIcon value={row.turboTenant} />{row.turboTenant}</span></td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          <div className="border border-slate-200 p-7 md:p-8"><FiHome className="h-7 w-7 text-green-700" /><h2 className="mt-5 text-2xl font-bold text-primary-main">Choose Property Peace if…</h2><ul className="mt-5 space-y-4 text-sm leading-6 text-[#405a70]">{['You manage 1–50 units and want the property to remain the anchor for leases, people, money, maintenance, and documents.', 'You want a true monthly Premium option rather than an annual commitment.', 'You prefer transparent software pricing and can use external processes for capabilities that are not yet operational.', 'You value deeper property-level records over a broad partner-service catalog.'].map((item) => <li key={item} className="flex gap-3"><FiCheck className="mt-1 h-4 w-4 flex-shrink-0 text-green-700" />{item}</li>)}</ul></div>
          <div className="border border-slate-200 p-7 md:p-8"><FiUsers className="h-7 w-7 text-[#217eff]" /><h2 className="mt-5 text-2xl font-bold text-primary-main">Choose TurboTenant if…</h2><ul className="mt-5 space-y-4 text-sm leading-6 text-[#405a70]">{['Integrated applicant screening and online rent processing are must-have workflows today.', 'You want broad listing, pre-screening, showing, application, lease, payment, and maintenance tools in one established funnel.', 'Annual billing and unit-tiered paid pricing fit your portfolio.', 'You understand and accept the applicant/tenant costs associated with the payment methods and optional products you use.'].map((item) => <li key={item} className="flex gap-3"><FiCheck className="mt-1 h-4 w-4 flex-shrink-0 text-[#217eff]" />{item}</li>)}</ul></div>
        </div>
      </section>

      <section className="bg-[#F7F9F8] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div className="max-w-3xl"><p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-green-700">Sources and review notes</p><h2 className="text-3xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>Check the current offer before deciding</h2><p className="mt-4 leading-7 text-[#637083]">TurboTenant controls its pricing and may change it. Insurance quotes vary. Feature availability can also depend on plan, provider, account, and location.</p></div><span className="inline-flex items-center gap-2 text-sm font-bold text-[#405a70]"><FiClock className="h-4 w-4 text-green-700" />Checked {checkedOn}</span></div>
          <div className="mt-8 grid gap-3 md:grid-cols-2">{sources.map((source) => <a key={source.href} href={source.href} target={source.href.startsWith('http') ? '_blank' : undefined} rel={source.href.startsWith('http') ? 'noopener noreferrer' : undefined} className="group flex min-h-14 items-center justify-between gap-4 border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-primary-main transition hover:border-green-300 hover:text-green-800"><span>{source.title}</span>{source.href.startsWith('http') ? <FiExternalLink className="h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-green-700" /> : <FiArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-green-700" />}</a>)}</div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl bg-[#061e35] p-8 text-white md:flex md:items-center md:justify-between md:gap-10 md:p-12"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Start with the property</p><h2 className="mt-4 text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Try Property Peace free for up to five units.</h2><p className="mt-4 text-lg leading-8 text-white/70">No credit card required. See the actual current pricing and availability disclosures before you choose.</p></div><div className="mt-7 flex flex-col gap-3 sm:flex-row md:mt-0 md:flex-col"><Link href="https://app.propertypeace.io/register" className="inline-flex min-h-[52px] items-center justify-center gap-2 bg-green-700 px-7 py-3.5 font-bold text-white transition hover:bg-green-600">Start free <FiArrowRight className="h-4 w-4" /></Link><Link href="/pricing" className="inline-flex min-h-[52px] items-center justify-center border border-white/25 px-7 py-3.5 font-bold text-white transition hover:bg-white/10">Review Property Peace pricing</Link></div></div></section>
    </main>
  );
}
