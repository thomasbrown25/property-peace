'use client';

import { FiArrowRight } from 'react-icons/fi';
import { motion } from 'framer-motion';

export default function Demo() {
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/tbrown-brownstonehub';

  return (
    <section id="demo" className="py-16 px-4 sm:px-6 lg:px-8 bg-[#F5F5F5] scroll-mt-20">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2
            className="text-4xl md:text-5xl font-bold text-primary-main mb-4"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Book a Demo
          </h2>
          <p
            className="text-xl text-[#737373] max-w-2xl mx-auto"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            See how Property Peace can streamline your property management. Schedule a personalized demo with our team.
          </p>
        </motion.div>

        <motion.div
          className="bg-white rounded-2xl p-8 md:p-12 shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
        >
          {/* Calendly Inline Widget */}
          <div
            className="calendly-inline-widget"
            data-url={calendlyUrl}
            style={{ minWidth: '320px', height: '700px' }}
          />

          {/* Alternative CTA */}
          <div className="mt-8 pt-8 border-t border-[#E5E5E5] text-center">
            <p
              className="text-sm text-[#737373] mb-4"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Or get started right now
            </p>
            <a
              href="https://app.propertypeace.io/register"
              className="inline-flex items-center space-x-2 text-primary-main hover:text-primary-hover font-semibold transition-colors"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              <span>Get Started</span>
              <FiArrowRight className="w-4 h-4" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
