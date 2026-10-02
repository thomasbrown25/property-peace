import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FiArrowRight,
  FiCheck,
  FiCompass,
  FiLayers,
  FiShield,
} from 'react-icons/fi';
import StructuredData from '@/components/SEO/StructuredData';
import { webPageSchema } from '@/lib/structured-data';

const description = 'Property Peace began with five rental homes, scattered spreadsheets, and a belief that independent landlords deserve a calmer way to manage their work.';

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
    title: 'Start with what matters',
    body: 'A landlord should be able to see what needs attention without digging through menus or learning an enterprise playbook.',
  },
  {
    icon: FiLayers,
    title: 'Keep the story together',
    body: 'A property is more than a row in a spreadsheet. Keep its people, leases, requests, records, and conversations connected.',
  },
  {
    icon: FiShield,
    title: 'Make simplicity honest',
    body: 'Useful tools at a sensible scale, with clear language about what is available today and what is still on the way.',
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
    <div className="min-h-screen bg-[#061E35] text-white">
      <StructuredData data={webPageSchema({ path: '/about/', name: 'About Property Peace', description })} />

      <section data-marketing-hero-theme="dark" className="relative flex min-h-[620px] items-center overflow-hidden bg-[#061E35] px-4 pb-28 pt-36 text-center text-white sm:min-h-[680px] sm:px-6 md:pb-32 md:pt-40 lg:px-8">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/pricing/hero.png)' }} aria-hidden="true" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,#061E35_0%,rgba(6,30,53,0.94)_18%,rgba(6,30,53,0.74)_57%,rgba(6,30,53,0.73)_100%)]" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-3xl">
          <p className="mb-7 text-[15px] font-extrabold uppercase leading-[1.5] tracking-[-0.2px] text-[#e1e1e1]" style={{ fontFamily: '"Poppins", sans-serif' }}>About Property Peace</p>
          <h1 className="text-4xl font-bold leading-[1.12] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
            It started with five homes.<br /><span className="text-green-400">It grew into Property Peace.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-base leading-7 text-white/90 sm:text-lg sm:leading-8" style={{ fontFamily: '"Inter", sans-serif' }}>
            Built from a real family&apos;s experience with spreadsheets, sticky notes, and too much to keep track of. A calmer way to manage rentals should be within reach.
          </p>
          <a href="#why-we-exist" className="mt-9 inline-flex min-h-12 items-center justify-center rounded-full bg-green-600 px-9 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-400">
            Learn more
          </a>
        </div>
      </section>

      <main>
        <section id="why-we-exist" className="scroll-mt-24 bg-[#061E35] px-4 py-20 sm:px-6 md:py-28 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-green-300">Our story</p>
                <h2 className="mt-5 text-3xl font-bold leading-tight tracking-[-0.035em] text-white md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
                  Five houses. Too many places to keep track of the details.
                </h2>
                <div className="mt-8 border-l-2 border-green-400 pl-5">
                  <p className="text-xl font-medium leading-8 text-white">It wasn&apos;t the properties that made the work feel complicated. It was trying to keep every detail in a different place.</p>
                </div>
              </div>
              <div className="space-y-6 text-lg leading-8" style={{ fontFamily: '"Inter", sans-serif' }}>
                <p className="text-white/80">My in-laws own five rental houses. They were managing the work with Excel, spreadsheets, sticky notes, and messages scattered across conversations. Every piece helped them get by, but keeping the whole picture together was another matter.</p>
                <p className="text-white/80">The alternatives felt like the other extreme: enterprise software packed with features they didn&apos;t need, complicated to use, and priced for a much larger operation. They needed something that fit the way they actually worked—not a system that expected them to change everything.</p>
                <p className="text-white/80">That is why I started Property Peace. I wanted a clear, approachable place to manage the everyday work of renting out homes: property details, leases, maintenance, messages, and records connected instead of scattered. Less hunting for the latest note. More confidence that nothing important is slipping through the cracks.</p>
                <p className="border-l-4 border-green-400 pl-5 text-xl font-semibold leading-8 text-white">Because managing a few homes should feel manageable.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#061E35] px-4 py-20 sm:px-6 md:py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-green-300">The promise</p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.035em] text-white md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Less chaos. More room to breathe.</h2>
              <p className="mt-5 text-lg leading-8 text-white/80">The idea behind Property Peace is simple: bring the everyday pieces of managing rentals together without bringing enterprise complexity along with them.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {principles.map(({ icon: Icon, title, body }, index) => (
                <article key={title} className="border border-white/10 bg-[#263e52] p-7 md:p-8">
                  <div className="flex items-center justify-between border-b border-white/10 pb-7">
                    <Icon className="h-7 w-7 text-green-400" aria-hidden="true" />
                    <span className="text-xs font-semibold tracking-[0.2em] text-white/40">0{index + 1}</span>
                  </div>
                  <h3 className="mt-7 text-xl font-bold text-white" style={{ fontFamily: '"Poppins", sans-serif' }}>{title}</h3>
                  <p className="mt-3 leading-7 text-white/80" style={{ fontFamily: '"Inter", sans-serif' }}>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#061E35] px-4 py-20 sm:px-6 md:py-24 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-green-300">What that looks like</p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.035em] text-white md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>The everyday work, together.</h2>
              <p className="mt-5 leading-7 text-white/80">From a first listing to the day-to-day details of a lease, the important information belongs with the property it relates to.</p>
              <ul className="mt-8 space-y-4">
                {availableToday.map((item) => (
                  <li key={item} className="flex gap-3 text-white/80">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-green-100 text-green-700"><FiCheck className="h-3.5 w-3.5" /></span>
                    <span className="leading-6">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <aside className="self-start border border-white/10 bg-[#263e52] p-8 text-white md:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-green-300">No feature fog</p>
              <h2 className="mt-4 text-2xl font-bold tracking-[-0.025em] md:text-3xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Simple also means straightforward.</h2>
              <p className="mt-5 leading-7 text-white/80">We want you to know what the product can do today. Digital rental applications are available, but consumer-report screening is not. Rent tracking is available; online rent payment processing is still on the roadmap. You should be able to decide if Property Peace fits without having to guess.</p>
              <Link href="/features" className="mt-8 inline-flex items-center gap-2 font-bold text-[#22c55e] transition hover:text-green-400">
                Review current features <FiArrowRight className="h-4 w-4" />
              </Link>
            </aside>
          </div>
        </section>

        <section className="bg-[#061E35] px-4 py-20 text-center text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl border-t border-white/15 pt-20">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-green-300">A little more peace, every day</p>
            <h2 className="mt-5 text-3xl font-bold tracking-[-0.035em] md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Your homes deserve your attention. Your tools shouldn&apos;t demand it all.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/80">Start with the essentials, keep your rental work in one place, and grow at your own pace. Free for up to five units.</p>
            <Link href="https://app.propertypeace.io/register" className="mt-9 inline-flex min-h-12 items-center justify-center gap-2 bg-green-600 px-8 py-3.5 font-bold text-white transition hover:bg-green-500">
              Start free <FiArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-12 text-xs text-white/50">Property Peace is a product of Brownstone Hub LLC.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
