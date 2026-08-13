'use client';

import { motion } from 'framer-motion';
import { FiClipboard, FiDollarSign, FiUsers } from 'react-icons/fi';

const pillars = [
  {
    icon: FiUsers,
    title: 'Choose tenants with the full picture',
    description:
      'Keep applications, tenant details, and lease records connected so you can make informed decisions without piecing everything together.',
  },
  {
    icon: FiDollarSign,
    title: 'Know where your money stands',
    description:
      'Track rent and expenses in one clear view, keep your records current, and spend less time rebuilding the story at tax time.',
  },
  {
    icon: FiClipboard,
    title: 'Keep the day-to-day under control',
    description:
      'Maintenance requests, messages, documents, and important dates stay organized by rental so the details are there when you need them.',
  },
];

export default function PainPoints() {
  return (
    <section className="relative z-20 -mt-8 overflow-hidden rounded-t-[2rem] bg-white px-4 py-20 sm:-mt-10 sm:rounded-t-[2.5rem] sm:px-6 sm:py-24 lg:-mt-12 lg:rounded-t-[3rem] lg:px-8 lg:py-28">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-px w-[min(90%,72rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-slate-200 to-transparent"
        aria-hidden="true"
      />

      <motion.div
        className="relative mx-auto max-w-6xl"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end lg:gap-20">
          <h2
            className="max-w-3xl text-3xl font-bold tracking-[-0.025em] text-[#061e35] sm:text-4xl lg:text-[3.25rem]"
            style={{ fontFamily: '"Poppins", sans-serif', lineHeight: 1.22 }}
          >
            Less busywork. More control.{' '}
            <span className="text-green-600">Manage every rental with confidence.</span>
          </h2>

          <p
            className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg lg:pb-1"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            One calm home base for independent landlords—whether you are managing your first rental, investing from out of state, or growing a small portfolio.
          </p>
        </div>

        <div className="mt-14 grid gap-10 border-t border-slate-200 pt-10 md:grid-cols-3 md:gap-8 lg:mt-16 lg:gap-12 lg:pt-12">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;

            return (
              <motion.article
                key={pillar.title}
                className="group relative"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, ease: 'easeOut', delay: index * 0.08 }}
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center border border-green-200 bg-green-50 text-green-700 transition-colors duration-200 group-hover:border-green-300 group-hover:bg-green-100">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>

                <h3
                  className="text-xl font-bold leading-snug text-[#061e35]"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  {pillar.title}
                </h3>
                <p
                  className="mt-3 text-base leading-7 text-slate-600"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  {pillar.description}
                </p>
              </motion.article>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
