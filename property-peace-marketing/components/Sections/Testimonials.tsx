'use client';

import Link from 'next/link';
import { FiArrowRight } from 'react-icons/fi';
import { motion } from 'framer-motion';

export default function Testimonials() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary-main text-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Side - Image */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div 
              className="aspect-square bg-[#737373] rounded-lg overflow-hidden"
              role="img"
              aria-label="Property owner testimonial for Property Peace - Property management software helping landlords manage rental properties, automate rent collection, and track maintenance efficiently"
            >
              <div className="w-full h-full bg-gradient-to-br from-[#737373] to-[#042238] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 bg-[#E5E5E5] rounded-full mx-auto mb-4" />
                  <p className="text-[#E5E5E5]">Property Owner</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Side - Content */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          >
            <blockquote className="text-3xl md:text-4xl font-bold leading-relaxed" style={{ fontFamily: '"Poppins", sans-serif' }}>
              &quot;Property Peace has transformed how I manage my 15-unit apartment building. I went from spending hours on spreadsheets to having everything automated. Rent collection is now effortless, and I can track everything from my phone.&quot;
            </blockquote>
            
            <div className="space-y-2">
              <p className="text-xl font-semibold" style={{ fontFamily: '"Poppins", sans-serif' }}>Sarah Martinez</p>
              <p className="text-[#E5E5E5]" style={{ fontFamily: '"Inter", sans-serif' }}>Property Owner & Landlord</p>
              <div className="flex items-center space-x-2 mt-4">
                <div className="w-12 h-12 bg-[#737373] rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">SM</span>
                </div>
                <span className="text-[#E5E5E5]">Small Apartment Building Owner</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-6 pt-6">
              <div>
                <div className="text-5xl font-bold mb-2">10hrs</div>
                <div className="text-[#E5E5E5] text-sm">Saved Per Week on Admin Tasks</div>
              </div>
              <div>
                <div className="text-5xl font-bold mb-2">98%</div>
                <div className="text-[#E5E5E5] text-sm">On-Time Rent Collection Rate</div>
              </div>
            </div>

            <Link
              href="/blog"
              className="inline-flex items-center space-x-2 text-white hover:text-[#E5E5E5] transition-colors"
            >
              <span>Read More Success Stories</span>
              <FiArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
