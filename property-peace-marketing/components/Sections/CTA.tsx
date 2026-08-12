import Link from 'next/link';
import { FiCalendar } from 'react-icons/fi';

export default function CTA({ featured = false }: { featured?: boolean }) {
  if (!featured) {
    return (
      <section className="bg-white px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-4xl font-bold text-primary-main md:text-5xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
            Get started today for Free
          </h2>
          <p className="mb-4 text-xl text-[#737373]" style={{ fontFamily: '"Inter", sans-serif' }}>
            Clean. Simple.
          </p>
          <ul className="mb-8 flex flex-wrap justify-center gap-x-8 gap-y-2 font-medium text-primary-main" style={{ fontFamily: '"Inter", sans-serif' }}>
            <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Start free — no credit card required</li>
            <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Cancel anytime</li>
            <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Built for landlords with 1–50 units</li>
          </ul>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="https://app.propertypeace.io/register" className="inline-flex items-center justify-center space-x-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-5 py-2.5 font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700 hover:shadow-[0_4px_12px_rgba(34,197,94,0.3)]" style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}>
              <span>Start free</span>
            </Link>
            <Link href="/demo" className="inline-flex items-center justify-center space-x-2 rounded-none border-2 border-green-600 bg-white px-5 py-2.5 font-medium text-green-600 transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-600 hover:text-white hover:shadow-[0_4px_12px_rgba(34,197,94,0.2)]" style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}>
              <FiCalendar className="h-4 w-4" aria-hidden="true" />
              <span>Book a Demo</span>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl bg-[#061E35] px-6 py-12 text-center text-white sm:px-10 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-300">A calmer operating rhythm</p>
        <h2 className="mx-auto mt-5 max-w-4xl text-3xl font-bold leading-tight tracking-[-0.03em] sm:text-4xl lg:text-5xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
          Spend less time checking everything. Know what needs attention.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300">Start with your properties, leases, and tenant records. Property Peace keeps the details organized so, where limited-pilot access is available, Percy can help you review what needs attention and stay ahead of the work. You decide every next step.</p>
        <div className="mx-auto mt-8 grid max-w-md gap-3 sm:grid-cols-2">
          <Link href="https://app.propertypeace.io/register" className="inline-flex min-h-14 items-center justify-center bg-green-600 px-6 font-bold text-white transition hover:bg-green-500">Start free</Link>
          <Link href="/demo" className="inline-flex min-h-14 items-center justify-center border-2 border-white/70 px-6 font-bold text-white transition hover:bg-white/10">Book a walkthrough</Link>
        </div>
      </div>
    </section>
  );
}
