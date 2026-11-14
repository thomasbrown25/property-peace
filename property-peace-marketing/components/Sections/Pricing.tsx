'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiArrowRight, FiCalendar } from 'react-icons/fi';

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="relative overflow-hidden bg-white py-32 px-4 sm:px-6 lg:px-8"
    >
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        {/* Badge */}
        <motion.div
          className="flex justify-center mb-8"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-brand-teal px-4 py-1.5 rounded-full border border-[var(--brand-border)] bg-brand-ivory"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-brand-teal inline-block flex-shrink-0" />
            Start free · built for landlords with 1–50 units
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h2
          className="text-5xl md:text-6xl lg:text-7xl font-bold text-primary-main mb-6"
          style={{ fontFamily: '"Host Grotesk", sans-serif', lineHeight: 1.1 }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Simplify Your Landlord{' '}
          <span className="text-brand-teal">Workflow</span>
        </motion.h2>

        {/* Subtext */}
        <motion.p
          className="text-lg text-slate-500 mb-12 max-w-xl mx-auto"
          style={{ fontFamily: '"Inter", sans-serif' }}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Start with the work that creates the most chaos: rent tracking, maintenance requests, expenses, and lease details. No credit card required.
        </motion.p>

        {/* CTA Card */}
        <motion.div
          className="mx-auto max-w-xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Link
            href="https://app.propertypeace.io/register"
            className="group flex w-full items-center justify-center gap-3 rounded-none bg-brand-teal px-8 py-5 text-lg font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-teal-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal"
            style={{
              fontFamily: '"Host Grotesk", sans-serif',
              boxShadow: '0 14px 40px color-mix(in srgb, var(--brand-forest) 20%, transparent)'
            }}
          >
            Start free
            <FiArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/demo"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-none border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-primary-main shadow-sm transition-colors hover:bg-slate-50 hover:text-primary-hover"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            <FiCalendar className="h-4 w-4" />
            Prefer a walkthrough? Book a demo
          </Link>
        </motion.div>

        {/* Factual trust note */}
        <motion.p
          className="mt-8 text-sm text-slate-500"
          style={{ fontFamily: '"Inter", sans-serif' }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Designed for 1–50 unit landlords moving from spreadsheets and scattered messages to one calm system.
        </motion.p>
      </div>
    </section>
  );
}
