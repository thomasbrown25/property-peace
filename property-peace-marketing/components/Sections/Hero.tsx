'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import HeroProductStepper from './HeroProductStepper';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#061E35] lg:min-h-[780px]">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/images/landing/hero-smart-home-entry.jpg)' }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[#061E35]/65" aria-hidden="true" />
      <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#061E35]/80 via-[#061E35]/45 to-[#061E35]/20" aria-hidden="true" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-6">
        <div className="flex flex-col lg:min-h-[780px] lg:flex-row">

          {/* Left Side - Content */}
          <div className="flex items-start pt-[7rem] pb-14 sm:pt-28 lg:flex-1 lg:items-center lg:py-20 xl:py-28 lg:max-w-[52%] self-stretch">
          <motion.div
            className="w-full text-center lg:text-left"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            {/* Headline */}
            <h1
              className="mx-auto mb-5 max-w-[22rem] text-[2.9rem] font-semibold tracking-[-0.055em] text-white sm:max-w-none sm:text-[2.45rem] sm:font-bold sm:tracking-[-0.045em] md:text-4xl xl:text-5xl lg:mx-0"
              style={{ fontFamily: '"Poppins", sans-serif', lineHeight: '1.12' }}
            >
              Property Management Software for{' '}
              <span className="text-green-600">Landlords and Investors</span>
            </h1>

            {/* Subheadline */}
            <p
              className="mx-auto mb-7 max-w-[21.5rem] text-[1.02rem] leading-7 text-white/90 sm:max-w-lg sm:text-base md:text-lg sm:leading-relaxed sm:mb-10 lg:mx-0"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              <span className="sm:hidden">Property Peace brings lease administration, maintenance operations, and portfolio analytics together, with Percy-assisted tools, currently in limited pilot.</span>
              <span className="hidden sm:inline">Property Peace brings lease administration, maintenance operations, and portfolio analytics together for independent landlords, with Percy-assisted tools, currently in limited pilot.</span>
            </p>

            {/* Mobile start card - Innago-inspired, Property Peace-branded signup panel */}
            <div className="relative mx-auto mt-6 max-w-[25rem] overflow-hidden rounded-[2rem] bg-[#061E35] px-5 py-7 text-center shadow-[0_26px_80px_rgba(6,30,53,0.36)] ring-1 ring-white/10 sm:hidden">
              <div className="pointer-events-none absolute inset-x-7 -mt-7 h-24 rounded-full bg-emerald-400/12 blur-2xl" />
              <div className="relative">
                <p
                  className="mx-auto max-w-[18rem] text-[1.65rem] font-semibold leading-tight tracking-[-0.04em] text-white"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  Property Peace makes life easier.
                </p>
                <p
                  className="mx-auto mt-3 max-w-[18rem] text-[1rem] font-semibold leading-6 text-blue-100"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  From one unit to fifty, we've got you covered.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Link
                    href="https://app.propertypeace.io/register"
                    className="flex min-h-14 items-center justify-center bg-green-600 px-3 text-center text-sm font-bold text-white shadow-[0_18px_42px_rgba(22,163,74,0.24)] transition-transform hover:bg-green-500 active:scale-[0.98]"
                    style={{ fontFamily: '"Poppins", sans-serif' }}
                  >
                    Get Started Free
                  </Link>
                  <Link
                    href="/demo"
                    className="flex min-h-14 items-center justify-center border-2 border-white bg-transparent px-3 text-center text-sm font-bold text-white transition-transform active:scale-[0.98]"
                    style={{ fontFamily: '"Poppins", sans-serif' }}
                  >
                    Book Demo
                  </Link>
                </div>
                <p className="mt-3 text-sm font-medium text-blue-100/90" style={{ fontFamily: '"Inter", sans-serif' }}>
                  No credit card required
                </p>
              </div>
            </div>

            {/* Desktop/tablet CTA row */}
            <div className="hidden max-w-lg mx-auto sm:block lg:mx-0">
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="https://app.propertypeace.io/register"
                  className="group flex min-h-[50px] flex-1 items-center justify-center gap-2 bg-green-600 px-3 py-3 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-500 hover:shadow-slate-950/20 sm:min-h-[56px] sm:px-5 sm:text-base"
                  style={{
                    fontFamily: '"Poppins", sans-serif',
                    boxShadow: '0 14px 34px rgba(22,163,74,0.24)'
                  }}
                >
                  Get Started Free
                </Link>

                <Link
                  href="/demo"
                  className="flex min-h-[50px] flex-1 items-center justify-center border-2 border-white/90 bg-white/10 px-3 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-white/20 sm:min-h-[56px] sm:px-5"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  Book Demo
                </Link>
              </div>

              <p className="mt-3 text-center text-xs text-white/75 lg:text-left" style={{ fontFamily: '"Inter", sans-serif' }}>
                Simple landlord accounting · No credit card required
              </p>
            </div>

            {/* Factual proof */}
            <div className="mt-5 hidden justify-center gap-2 text-[13px] text-white/90 sm:flex sm:flex-wrap sm:text-xs lg:justify-start" style={{ fontFamily: '"Inter", sans-serif' }}>
              <span className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-3 py-1 leading-snug shadow-sm backdrop-blur-sm">Replace spreadsheet sprawl</span>
              <span className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-3 py-1 leading-snug shadow-sm backdrop-blur-sm">Track rent and maintenance</span>
              <span className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/15 px-3 py-1 leading-snug shadow-sm backdrop-blur-sm">See what needs attention</span>
            </div>
          </motion.div>
        </div>

        {/* Right Side - Interactive product stepper (desktop only for now) */}
        <motion.div
          className="hidden w-full lg:flex lg:flex-1 self-stretch flex-col min-h-[500px] lg:min-h-0"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        >
          <HeroProductStepper />
        </motion.div>

        </div>
      </div>
    </section>
  );
}
