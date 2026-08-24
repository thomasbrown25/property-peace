import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  FiArrowRight,
  FiCheck,
  FiCompass,
  FiLayers,
  FiShield,
  FiUsers,
} from 'react-icons/fi';
import StructuredData from '@/components/SEO/StructuredData';
import { webPageSchema } from '@/lib/structured-data';

const description = 'Meet Property Peace, rental management software built to give independent landlords with 1–50 units a calmer, clearer way to work.';

export const metadata: Metadata = {
  title: 'About Property Peace | Software for Independent Landlords',
  description,
  alternates: { canonical: 'https://propertypeace.io/about/' },
  openGraph: {
    title: 'About Property Peace',
    description,
    type: 'website',
    url: 'https://propertypeace.io/about/',
  },
};

const principles = [
  {
    icon: FiCompass,
    title: 'Calm is a product decision',
    body: 'The next task should be easy to find, the status should be clear, and the record should stay attached to the right property.',
  },
  {
    icon: FiLayers,
    title: 'One connected record',
    body: 'Properties, tenants, leases, maintenance, rent records, expenses, and documents work better when they live together.',
  },
  {
    icon: FiShield,
    title: 'Plain about what is available',
    body: 'We distinguish live workflows from roadmap features so landlords can make decisions using what the product does today.',
  },
  {
    icon: FiUsers,
    title: 'Built at a human scale',
    body: 'Property Peace is designed around independent landlords managing 1–50 units—not an enterprise org chart.',
  },
];

const availableToday = [
  'Property, unit, tenant, and lease records',
  'Shareable listings and digital rental applications',
  'Rent ledgers, late-fee tools, expenses, and financial reports',
  'Maintenance requests, photos, messages, and status history',
  'Document storage and mobile access',
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <StructuredData data={webPageSchema({ path: '/about/', name: 'About Property Peace', description })} />

      <section className="relative overflow-hidden bg-[#061e35] px-4 pb-20 pt-32 text-white sm:px-6 md:pb-24 md:pt-40 lg:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="pointer-events-none absolute -right-32 top-8 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">About Property Peace</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.02] tracking-[-0.045em] sm:text-5xl md:text-6xl lg:text-7xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
              Built for landlords who still know every door.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/70 md:text-xl" style={{ fontFamily: '"Inter", sans-serif' }}>
              Property Peace brings the daily work of a rental portfolio into one clear system, so independent landlords can spend less time rebuilding the story from spreadsheets, texts, and folders.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/how-it-works" className="inline-flex min-h-12 items-center justify-center gap-2 bg-emerald-500 px-7 py-3.5 font-bold text-white transition hover:bg-emerald-400">
                See how it works <FiArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/features" className="inline-flex min-h-12 items-center justify-center border border-white/20 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10">
                Explore features
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg border border-white/15 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-sm sm:p-7">
            <div className="mb-7 flex items-center justify-between border-b border-white/10 pb-5">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Portfolio signal</span>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_7px_rgba(52,211,153,0.12)]" />
            </div>
            <div className="space-y-3">
              {['Leases stay connected', 'Rent records stay readable', 'Repairs keep their history', 'Documents stay with the property'].map((item, index) => (
                <div key={item} className="flex items-center gap-4 border border-white/10 bg-[#082945] px-4 py-4">
                  <span className="text-xs font-bold tabular-nums text-emerald-300">0{index + 1}</span>
                  <span className="font-semibold text-white/90">{item}</span>
                  <FiCheck className="ml-auto h-4 w-4 text-emerald-300" />
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-5">
              <Image src="/images/logos/property-peace.png" alt="" width={150} height={44} className="h-auto w-32" />
              <span className="ml-auto text-xs text-white/45">One calm record</span>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section className="px-4 py-20 sm:px-6 md:py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">Why we exist</p>
                <h2 className="mt-4 text-3xl font-bold leading-tight tracking-[-0.035em] text-[#061e35] md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
                  Property management should feel organized before it feels sophisticated.
                </h2>
              </div>
              <div className="space-y-5 text-lg leading-8 text-slate-600" style={{ fontFamily: '"Inter", sans-serif' }}>
                <p>Small rental portfolios are often run across spreadsheets, inboxes, text threads, bank records, and paper folders. None of those tools knows what the others are doing.</p>
                <p>Property Peace gives that work a shared home. The goal is not to add another layer of administration. It is to make the current state of each property easier to see, explain, and act on.</p>
                <p className="border-l-4 border-emerald-500 pl-5 font-semibold text-[#0b3558]">Property Peace is a product of Brownstone Hub LLC.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-[#f4f8fc] px-4 py-20 sm:px-6 md:py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">The product standard</p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.035em] text-[#061e35] md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Four principles shape the work.</h2>
            </div>
            <div className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 md:grid-cols-2">
              {principles.map(({ icon: Icon, title, body }) => (
                <article key={title} className="bg-white p-7 md:p-9">
                  <Icon className="h-6 w-6 text-emerald-600" />
                  <h3 className="mt-6 text-xl font-bold text-[#061e35]" style={{ fontFamily: '"Poppins", sans-serif' }}>{title}</h3>
                  <p className="mt-3 leading-7 text-slate-600" style={{ fontFamily: '"Inter", sans-serif' }}>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 md:py-24 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">Available today</p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.035em] text-[#061e35] md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Useful from the first property.</h2>
              <ul className="mt-8 space-y-4">
                {availableToday.map((item) => (
                  <li key={item} className="flex gap-3 text-slate-700">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-emerald-100 text-emerald-700"><FiCheck className="h-3.5 w-3.5" /></span>
                    <span className="leading-6">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <aside className="border border-slate-200 bg-[#061e35] p-8 text-white md:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">Clarity matters</p>
              <h2 className="mt-4 text-2xl font-bold tracking-[-0.025em] md:text-3xl" style={{ fontFamily: '"Poppins", sans-serif' }}>No feature fog.</h2>
              <p className="mt-5 leading-7 text-white/70">Digital rental applications are available, but Property Peace does not currently provide consumer-report screening. Rent tracking is available, but online rent payment processing remains on the roadmap. We would rather make that distinction clear before you sign up.</p>
              <Link href="/features" className="mt-8 inline-flex items-center gap-2 font-bold text-emerald-300 transition hover:text-emerald-200">
                Review current features <FiArrowRight className="h-4 w-4" />
              </Link>
            </aside>
          </div>
        </section>

        <section className="bg-emerald-500 px-4 py-16 text-center text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-[-0.035em] md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Bring your rental work into one place.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-emerald-950/75">Start free for up to five units. No credit card required.</p>
            <Link href="https://app.propertypeace.io/register" className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 bg-[#061e35] px-8 py-3.5 font-bold text-white transition hover:bg-[#0b3558]">
              Start free <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
