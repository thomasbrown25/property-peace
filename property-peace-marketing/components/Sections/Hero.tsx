import Link from 'next/link';
import PercyTodayPreview from './PercyTodayPreview';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#061E35] px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:px-8 lg:py-28">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)', backgroundSize: '48px 48px' }} aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <div>
          <p className="inline-flex border border-green-300/30 bg-green-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-green-200">
            Meet Percy
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.75rem]" style={{ fontFamily: '"Poppins", sans-serif' }}>
            Your AI assistant for managing rental properties
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg sm:leading-8">
            Percy-assisted tools, currently in limited pilot, help you review supported Property Peace records, summarize what may need attention, and trace the context back to its workflow category. Percy does not send messages or change records.
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
            <Link href="https://app.propertypeace.io/register" className="inline-flex min-h-14 items-center justify-center bg-green-600 px-7 text-base font-bold text-white transition hover:bg-green-500">
              Start free
            </Link>
            <Link href="#how-percy-helps" className="inline-flex min-h-14 items-center justify-center border-2 border-white/70 px-7 text-base font-bold text-white transition hover:bg-white/10">
              See how Percy works
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-200" aria-label="Plan highlights">
            <li>✓ Free for up to 5 units</li>
            <li>✓ No credit card</li>
            <li>✓ For self-managing landlords</li>
          </ul>
        </div>
        <PercyTodayPreview />
      </div>
    </section>
  );
}
