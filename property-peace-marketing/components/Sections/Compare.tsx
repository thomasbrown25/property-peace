'use client';

import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { FiArrowRight, FiCheck } from 'react-icons/fi';

const comparisons = [
  {
    competitor: 'Buildium',
    link: '/comparison/brownstone-hub-vs-buildium',
    tagline: 'Powerful features. No enterprise price tag.',
    wins: [
      'Fraction of the cost — no per-unit fees',
      'Clean UI built for solo landlords',
      'Setup in minutes, not days',
    ],
  },
  {
    competitor: 'DoorLoop',
    link: '/comparison/brownstone-hub-vs-doorloop',
    tagline: 'Everything you need. Nothing you don\'t.',
    wins: [
      'No bloated feature overwhelm',
      'Landlord-first, not PM-company-first',
      'Transparent pricing from day one',
    ],
  },
  {
    competitor: 'AppFolio',
    link: '/comparison/brownstone-hub-vs-appfolio',
    tagline: 'Enterprise power. Indie landlord price.',
    wins: [
      'No $280+/mo minimum commitment',
      'Works for 1 unit, not just 50+',
      'Support that actually responds',
    ],
  },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: 'easeOut', delay: i * 0.1 },
  }),
};

export default function Compare() {
  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8" style={{ background: 'transparent' }}>

      <div className="relative max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Eyebrow */}
          <span
            className="inline-block text-xs font-semibold tracking-widest uppercase text-green-600 mb-4 px-3 py-1 rounded-full border border-green-500/20 bg-green-50"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            How we stack up
          </span>

          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Why landlords switch to{' '}
            <span className="text-green-400">Property Peace</span>
          </h2>
          <p
            className="text-base md:text-lg text-white/60 max-w-2xl mx-auto"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            No bloat, no enterprise pricing, no complex onboarding. Just the features independent landlords actually use.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {comparisons.map((c, i) => (
            <motion.div
              key={c.competitor}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="relative flex flex-col rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
            >
              {/* Top accent line */}
              <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #3b82f6, #6366f1)' }} />

              <div className="flex flex-col flex-1 p-7">
                {/* VS Badge */}
                <div className="flex items-center gap-3 mb-5">
                  <span
                    className="text-[10px] font-bold tracking-widest uppercase text-green-400/70 px-2 py-0.5 rounded border border-green-400/20 bg-green-400/10"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    VS
                  </span>
                  <span
                    className="text-xl font-bold text-white"
                    style={{ fontFamily: '"Poppins", sans-serif' }}
                  >
                    {c.competitor}
                  </span>
                </div>

                {/* Tagline */}
                <p
                  className="text-sm text-white/50 mb-6 leading-relaxed"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  {c.tagline}
                </p>

                {/* Wins */}
                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {c.wins.map((win) => (
                    <li key={win} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.2)' }}>
                        <FiCheck className="w-2.5 h-2.5 text-blue-400" strokeWidth={3} />
                      </span>
                      <span
                        className="text-sm text-white/80 leading-snug"
                        style={{ fontFamily: '"Inter", sans-serif' }}
                      >
                        {win}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={c.link}
                  className="group mt-auto flex items-center justify-center gap-2 py-2.5 px-5 rounded-none font-semibold text-sm transition-all duration-200 text-white"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(99,102,241,0.25))',
                    border: '1px solid rgba(99,102,241,0.4)',
                    fontFamily: '"Inter", sans-serif',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(59,130,246,0.4), rgba(99,102,241,0.4))';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(99,102,241,0.25))';
                  }}
                >
                  See full comparison
                  <FiArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
