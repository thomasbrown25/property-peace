'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const listItems = [
  'Rent collection, reminders, and overdue follow-up in one place so you are not chasing payments from a spreadsheet.',
  'Maintenance requests that become trackable work orders instead of scattered texts, calls, and forgotten repairs.',
  'Lease, tenant, document, and property records organized around each rental you actually own.',
  'Income, expenses, and simple financial views built for 1–50-unit portfolios — not enterprise accounting overhead.',
  'Limited Percy Pilot read-only review of supported, landlord-opened maintenance records; reminders and follow-up remain landlord-run.',
];

export default function PainPoints() {
  return (
    <section className="relative bg-white px-4 pb-24 pt-8 sm:px-6 md:pt-20 lg:px-8 lg:pt-24">
      <motion.div
        className="relative mx-auto max-w-5xl"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <span
          className="mb-5 inline-block rounded-full border border-green-500/20 bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-green-600"
          style={{ fontFamily: '"Inter", sans-serif' }}
        >
          Built for 1–50 unit landlords
        </span>

        <h2
          className="mb-5 max-w-4xl text-3xl font-bold leading-tight text-primary-main md:text-4xl lg:text-5xl"
          style={{ fontFamily: '"Poppins", sans-serif' }}
        >
          Why choose landlord software{' '}
          <span className="text-green-600">built for small portfolios?</span>
        </h2>

        <p
          className="max-w-3xl text-base leading-8 text-slate-600 md:text-lg"
          style={{ fontFamily: '"Inter", sans-serif' }}
        >
          Property Peace is built around the real work of independent landlords — rent, repairs, records, and renewals — not enterprise property management workflows trimmed down for smaller teams. This gives you:
        </p>

        <ul className="mt-10 max-w-4xl space-y-6">
          {listItems.map((item, index) => (
            <motion.li
              key={item}
              className="flex gap-4 text-base leading-8 text-slate-700 md:text-lg"
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, ease: 'easeOut', delay: index * 0.06 }}
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              <span className="mt-0.5 shrink-0 text-xl font-semibold text-green-600" aria-hidden="true">
                →
              </span>
              <span>{item}</span>
            </motion.li>
          ))}
        </ul>

        <div className="mt-12">
          <Link
            href="/demo"
            className="inline-flex min-h-[52px] items-center justify-center bg-primary-main px-8 py-4 text-sm font-bold text-white transition-colors hover:bg-primary-hover focus:outline-none focus:ring-4 focus:ring-primary-main/20"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Book a demo
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
