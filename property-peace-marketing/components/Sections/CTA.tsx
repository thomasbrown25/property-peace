'use client';

import Link from 'next/link';
import { FiCalendar, FiZap } from 'react-icons/fi';
import { motion } from 'framer-motion';

type CTAProps = {
  featured?: boolean;
};

export default function CTA({ featured = false }: CTAProps) {
  if (featured) {
    return (
      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#061e35] px-6 py-14 text-center shadow-[0_24px_70px_rgba(6,30,53,0.22)] sm:px-10 sm:py-16 lg:px-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
            <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-400/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-1/3 translate-y-1/3 rounded-full bg-green-500/10 blur-3xl" />
          </div>

          <div className="relative z-10 mx-auto max-w-4xl">
            <div
              className="mb-6 inline-flex items-center rounded-full border border-green-400/20 bg-green-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-green-200"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Ready when you are
            </div>

            <h2
              className="text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Start with the tools you need today. Grow into the rest tomorrow.
            </h2>

            <p
              className="mx-auto mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Property Peace keeps rent, maintenance, leases, accounting, documents, and Percy insights connected from day one.
            </p>

            <ul
              className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium text-slate-100 sm:text-base"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> No credit card required
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Free forever plan
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Built for landlords with 1–50 units
              </li>
            </ul>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="https://app.propertypeace.io/register"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-7 py-3 text-base font-semibold text-white shadow-[0_14px_30px_rgba(34,197,94,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700 hover:shadow-[0_18px_36px_rgba(34,197,94,0.34)]"
                style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
              >
                <span>Start free</span>
                <FiZap className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-[52px] items-center justify-center rounded-none border border-white/10 bg-white/[0.08] px-7 py-3 text-base font-semibold text-white shadow-sm shadow-black/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.12]"
                style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
              >
                View pricing
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    );
  }

  return (
    <section className="py-12 sm:py-14 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <motion.h2
          className="text-4xl md:text-5xl font-bold text-primary-deep mb-4"
          style={{ fontFamily: '"Poppins", sans-serif' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          Get started today for Free
        </motion.h2>
        <motion.p
          className="text-xl text-[#737373] mb-4"
          style={{ fontFamily: '"Inter", sans-serif' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
        >
          Clean. Simple.
        </motion.p>
        <motion.ul
          className="flex flex-wrap justify-center gap-x-8 gap-y-2 mb-8 text-primary-deep font-medium"
          style={{ fontFamily: '"Inter", sans-serif' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.25 }}
        >
          <li className="flex items-center gap-2">
            <span className="text-green-600">✓</span> Start free — no credit card required
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-600">✓</span> Cancel anytime
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-600">✓</span> Built for landlords with 1–50 units
          </li>
        </motion.ul>
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
        >
          <Link
            href="https://app.propertypeace.io/register"
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-none font-medium transition-all duration-300 hover:from-green-600 hover:to-green-700 hover:translate-y-[-2px] hover:shadow-[0_4px_12px_rgba(34,197,94,0.3)]"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            <span>Start free</span>
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-white text-green-600 border-2 border-green-600 rounded-none font-medium transition-all duration-300 hover:bg-green-600 hover:text-white hover:translate-y-[-2px] hover:shadow-[0_4px_12px_rgba(34,197,94,0.2)]"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            <FiCalendar className="w-4 h-4" />
            <span>Book a Demo</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
