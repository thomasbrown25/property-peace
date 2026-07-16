'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function TrackOccupancy() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Side - Content: centered when md or smaller */}
          <motion.div
            className="text-center lg:text-left"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Category Label */}
            <motion.p
              className="uppercase mb-4"
              style={{
                fontFamily: "'Open Sans', sans-serif",
                color: '#516A80',
                fontSize: '18px',
                fontWeight: 700,
                textTransform: 'uppercase',
                lineHeight: '1.5em',
                letterSpacing: '.5px',
                margin: 0,
                marginBottom: '1rem'
              }}
            >
              Track Occupancy
            </motion.p>

            {/* Main Headline */}
            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-primary-main"
              style={{ fontFamily: '"Poppins", sans-serif', lineHeight: '1.2' }}
            >
              Visualize unit availability at a glance.
            </h2>

            {/* Descriptive Paragraph */}
            <p
              className="text-base md:text-lg text-[#737373] mb-6 leading-relaxed"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              See exactly when each unit will be available and when it's occupied with an intuitive occupancy chart. Plan ahead for maintenance, schedule showings, and maximize your rental income by identifying upcoming vacancies before they happen.
            </p>

            {/* Before/after */}
            <div className="mb-6 grid grid-cols-2 gap-2 text-sm max-w-sm mx-auto lg:mx-0" style={{ fontFamily: '"Inter", sans-serif' }}>
              <div className="bg-red-50 rounded-lg px-3 py-2 text-[#737373]">
                <span className="block font-semibold text-red-400 mb-1">Before</span>
                Mental notes &amp; calendar guesswork
              </div>
              <div className="bg-green-50 rounded-lg px-3 py-2 text-[#737373]">
                <span className="block font-semibold text-green-600 mb-1">After</span>
                Visual occupancy timeline, always current
              </div>
            </div>

            {/* Link */}
            <Link
              href="/features"
              className="inline-block text-primary-main hover:text-primary-hover font-medium transition-colors underline"
              style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
            >
              Explore occupancy tracking features »
            </Link>
          </motion.div>

          {/* Right Side - Dashboard Preview */}
          <motion.div
            className="relative w-full"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div 
              className="relative rounded-2xl overflow-hidden bg-white"
              style={{
                boxShadow: '0 20px 60px rgba(47, 93, 255, 0.3)'
              }}
            >
              {/* Device Frame */}
              <div className="relative rounded-lg overflow-hidden bg-white">
                <Image 
                  src="/images/landing/landlord-dashboard-occupancy.png"
                  alt="Rental property occupancy tracking dashboard showing unit availability calendar, lease expiration dates, vacancy management, and visual timeline for multi-unit property management"
                  width={800}
                  height={500}
                  className="w-full h-auto"
                  priority
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
