'use client';

import { motion } from 'framer-motion';

const STAR_COLOR = '#fbbf24';

const testimonials = [
  {
    quote: 'I managed my rentals in Excel for years. After switching, I realized how much time I was wasting. All of my daily management activites are all in one place now. Property Peace made it way easier. They have a great support team and were able to accommodate some of my feature requests as well. It actually feels like the team here cares.',
    name: 'David M.',
    descriptor: '12-Unit Owner',
    initials: 'DM',
    accent: '#3b82f6',
  },
  {
    quote: 'I manage 5 properties and I knew I needed software to make things easier but I didn\'t want to pay for a bunch of features I wouldn\'t use or need. I find Property Peace to be a great balance between simplicity and functionality with valuable features.',
    name: 'Mato P.',
    descriptor: '5-Property Owner',
    initials: 'MP',
    accent: '#a855f7',
  },
  {
    quote: 'I use to manage my properties with Google Sheets, QuickBooks, and Excel. I made the switch to Property Peace and I couldn\'t be happier. I had a call with the owner and he walked me through setup. It was as simple as advertised. The owner has been great to work with, very professional and curtious. I highly recommend this software to any self-managed landlord looking for a simple, affordable, and effective way to manage their properties.',
    name: 'Alexander C.',
    descriptor: '3-Property Owner',
    initials: 'AC',
    accent: '#22c55e',
  },
];

function Stars() {
  return (
    <div className="flex items-center gap-0.5 mb-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill={STAR_COLOR}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function SocialProof() {
  return (
    <section
      className="relative py-24 px-4 sm:px-6 lg:px-8"
      style={{ background: 'transparent' }}
    >

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <span
            className="inline-block text-xs font-semibold tracking-widest uppercase text-[#061e35] mb-4 px-3 py-1 rounded-full border border-[#061e35]/15 bg-[#061e35]/5"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Real landlords, real results
          </span>
          <h2
            className="text-3xl md:text-4xl font-bold text-white mb-3"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            What Landlords Are Saying
          </h2>
          <p
            className="text-base text-white/50 max-w-xl mx-auto"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Real feedback from independent landlords using modern property management software.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.initials}
              className="relative flex flex-col rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.1 }}
            >
              {/* Accent line */}
              <div className="h-0.5 flex-shrink-0" style={{ background: `linear-gradient(90deg, ${t.accent}, transparent)` }} />

              <div className="flex flex-col flex-1 p-6">
                <Stars />

                <blockquote
                  className="text-white/75 leading-relaxed mb-6 flex-1 text-sm"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent}99)` }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm" style={{ fontFamily: '"Poppins", sans-serif' }}>
                      {t.name}
                    </p>
                    <p className="text-xs text-white/45" style={{ fontFamily: '"Inter", sans-serif' }}>
                      {t.descriptor}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
