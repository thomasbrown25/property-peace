'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function FeatureCards() {
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
              Tenant and Landlord Portals
            </motion.p>

            {/* Main Headline */}
            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-primary-main"
              style={{ fontFamily: '"Poppins", sans-serif', lineHeight: '1.2' }}
            >
              Everything about your properties, in one view.
            </h2>

            {/* Descriptive Paragraph */}
            <p
              className="text-base md:text-lg text-[#737373] mb-6 leading-relaxed"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Access all your property data, tenant information, financial reports, and maintenance requests from a single, intuitive dashboard. No more switching between spreadsheets, apps, and paper files — everything you need is right at your fingertips.
            </p>

            {/* What you eliminate */}
            <div className="flex flex-wrap gap-2 mb-6 justify-center lg:justify-start">
              {['Excel chaos', 'Paper files', 'Multiple apps', 'Scattered spreadsheets'].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 text-sm text-[#737373] bg-[#F5F5F5] px-3 py-1 rounded-full"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  <span className="text-red-400 font-bold">✕</span> {item}
                </span>
              ))}
            </div>

            {/* Link */}
            <Link
              href="/features/all-in-one-dashboard"
              className="inline-block text-primary-main hover:text-primary-hover font-medium transition-colors underline"
              style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
            >
              Learn about our Landlord Portal »
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
                  src="/images/landing/landlord-dashboard-mockup.png"
                  alt="All-in-one property management dashboard for landlords displaying rental property overview, tenant portal access, lease management, maintenance request tracking, and unified property management interface"
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
