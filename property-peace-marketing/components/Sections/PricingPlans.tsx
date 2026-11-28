'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';

const features = [
  'Unlimited units',
  'Hosted Property Peace listing page',
  'Multiple active external listings (coming soon)',
  'Lead management & showing scheduling',
  'Lead source attribution after syndication launches',
  'Tenant portal',
  'Maintenance request tracking',
  'Lease management',
  'Digital rental applications',
  'Document storage',
  'Rent ledger, late fees & automated reminders',
  'Online rent payments (approval required)',
  'Advanced accounting & Schedule E',
  'Occupancy tracking',
  'Rent estimates',
  'LeaseShield protection',
  'Percy Pilot workflows (limited availability)',
  'One dedicated organization SMS number (activation and configuration required)',
];

export default function PricingPlans() {
  return (
    <section data-marketing-hero-theme="dark" className="relative isolate overflow-hidden bg-brand-forest marketing-gutter pb-10 pt-32 text-white sm:pb-14 md:pt-48">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[680px] bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/pricing/hero.png)' }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[680px] bg-brand-forest opacity-90" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.div
          className="mb-12 text-center md:mb-16"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1
            className="mb-4 text-4xl font-bold text-brand-mint md:text-5xl lg:text-6xl"
            style={{ fontFamily: '"Host Grotesk", sans-serif' }}
          >
            Free
          </h1>
          <p
            className="mx-auto max-w-2xl text-lg text-white/90 md:text-xl"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            No credit card required.
          </p>
        </motion.div>

        <motion.div
          className="mx-auto max-w-4xl rounded-2xl border border-brand-mint bg-brand-surface p-6 shadow-2xl md:p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="mb-6 text-xl font-bold text-primary-main" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>
            Everything included
          </h2>
          <ul className="mb-8 grid gap-y-3 sm:grid-cols-2 sm:gap-x-6">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <FiCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-teal" aria-hidden="true" />
                <span className="text-sm text-primary-main" style={{ fontFamily: '"Inter", sans-serif' }}>
                  {feature}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="https://app.propertypeace.io/register"
            className="block w-full rounded-2xl bg-brand-teal px-6 py-3.5 text-center font-semibold text-white transition-all duration-300 hover:bg-brand-teal-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal sm:rounded-full"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            Start for free
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
