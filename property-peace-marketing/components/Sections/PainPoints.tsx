'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiCompass, FiEye, FiFolder } from 'react-icons/fi';

const principles = [
  {
    icon: FiEye,
    title: 'See the whole picture',
    description: 'A clear portfolio view keeps priorities visible across every property.',
  },
  {
    icon: FiCompass,
    title: 'Know what comes next',
    description: 'Open work, important dates, and follow-ups stay easy to find.',
  },
  {
    icon: FiFolder,
    title: 'Keep the story intact',
    description:
      'Messages, documents, rent records, and repairs stay connected to the right rental.',
  },
];

export default function PainPoints() {
  return (
    <section
      data-homepage-self-management="true"
      className="relative z-20 -mt-8 overflow-hidden rounded-t-[2rem] bg-white px-4 py-20 sm:-mt-10 sm:rounded-t-[2.5rem] sm:px-6 sm:py-24 lg:-mt-12 lg:rounded-t-[3rem] lg:px-8 lg:py-28"
    >
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
        <div className="grid lg:grid-cols-[0.82fr_1.18fr] lg:grid-rows-[auto_1fr] lg:gap-x-20">
          <div className="lg:col-start-1 lg:row-start-1">
            <p
              className="text-xs font-bold uppercase tracking-[0.2em] text-green-700"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Built for self-management
            </p>
            <h2
              className="mt-4 max-w-2xl text-3xl font-bold tracking-[-0.03em] text-[#061e35] sm:text-4xl lg:text-[3.25rem]"
              style={{ fontFamily: '"Poppins", sans-serif', lineHeight: 1.15 }}
            >
              Stay hands-on without holding{' '}
              <span className="text-green-600">everything in your head.</span>
            </h2>
            <p
              className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Property Peace turns scattered rental work into one clear operating rhythm, so you can see
              what needs attention, move the next task forward, and keep the full history with the rental.
            </p>
          </div>

          <motion.figure
            className="relative mt-10 min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.08 }}
          >
            <div className="absolute -inset-5 bg-[#edf6fa] sm:-inset-7" aria-hidden="true" />
            <div className="relative border border-[#b8c8d5] bg-white p-3 shadow-[0_28px_80px_rgba(6,30,53,0.16)] sm:p-5">
              <div
                className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-xs"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                <span>Portfolio overview</span>
                <span className="inline-flex items-center gap-2 text-green-700">
                  <span className="h-2 w-2 bg-green-500" aria-hidden="true" />
                  One calm view
                </span>
              </div>
              <Image
                src="/images/landing/dashboard.png"
                alt="Property Peace dashboard overview for a rental portfolio"
                width={1500}
                height={1258}
                className="h-auto w-full"
                sizes="(min-width: 1024px) 52vw, 100vw"
              />
            </div>
            <figcaption
              className="relative mt-4 text-sm font-medium text-slate-500"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              One home base for the work behind every rental.
            </figcaption>
          </motion.figure>

          <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200 lg:col-start-1 lg:row-start-2 lg:mt-12">
            {principles.map((principle, index) => {
              const Icon = principle.icon;

              return (
                <motion.article
                  key={principle.title}
                  className="group flex gap-4 py-6"
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.07 }}
                >
                  <div className="flex h-11 w-11 flex-none items-center justify-center border border-green-200 bg-green-50 text-green-700 transition-colors duration-200 group-hover:border-green-300 group-hover:bg-green-100">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3
                      className="text-lg font-bold leading-snug text-[#061e35]"
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                    >
                      {principle.title}
                    </h3>
                    <p
                      className="mt-1.5 text-[15px] leading-6 text-slate-600"
                      style={{ fontFamily: '"Inter", sans-serif' }}
                    >
                      {principle.description}
                    </p>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
