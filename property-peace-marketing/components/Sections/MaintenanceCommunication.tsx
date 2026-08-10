'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiArrowRight, FiTool, FiBell, FiMessageSquare } from 'react-icons/fi';

export default function MaintenanceCommunication() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left Card - Handle Maintenance */}
          <motion.div
            className="bg-white rounded-2xl p-8 border border-[#E5E5E5]"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h2
              className="text-3xl md:text-4xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Handle Maintenance
            </h2>
            <p
              className="text-lg text-[#737373] mb-6 leading-relaxed"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Streamline your maintenance workflow with easy task management and prioritization. Close maintenance requests faster by tracking status, assigning vendors, and keeping tenants updated—all from one centralized hub.
            </p>
            <Link
              href="/features/maintenance-tracking"
              className="inline-flex items-center space-x-2 text-primary-main hover:text-primary-hover font-medium transition-colors"
              style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
            >
              <span>Learn more</span>
              <FiArrowRight className="w-4 h-4" />
            </Link>
            
            {/* Kanban Board Preview */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {/* NEW Column */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[#737373] uppercase mb-2" style={{ fontFamily: '"Inter", sans-serif' }}>
                  NEW 3
                </div>
                <div className="bg-[#F5F5F5] rounded-lg p-4 border border-[#E5E5E5]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded" style={{ fontFamily: '"Inter", sans-serif' }}>
                      HIGH
                    </span>
                  </div>
                  <p className="text-sm font-medium text-primary-main mb-1" style={{ fontFamily: '"Inter", sans-serif' }}>
                    Leaky water pipe
                  </p>
                  <p className="text-xs text-[#737373]" style={{ fontFamily: '"Inter", sans-serif' }}>
                    UNIT 14
                  </p>
                </div>
              </div>

              {/* IN PROGRESS Column */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[#737373] uppercase mb-2" style={{ fontFamily: '"Inter", sans-serif' }}>
                  IN PROGRESS 2
                </div>
                <div className="bg-[#F5F5F5] rounded-lg p-4 border border-[#E5E5E5]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded" style={{ fontFamily: '"Inter", sans-serif' }}>
                      LOW
                    </span>
                  </div>
                  <p className="text-sm font-medium text-primary-main mb-1" style={{ fontFamily: '"Inter", sans-serif' }}>
                    Minor wall damage
                  </p>
                  <p className="text-xs text-[#737373]" style={{ fontFamily: '"Inter", sans-serif' }}>
                    UNIT 14
                  </p>
                </div>
              </div>

              {/* COMPLETED Column */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[#737373] uppercase mb-2" style={{ fontFamily: '"Inter", sans-serif' }}>
                  COMPLETED
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200 min-h-[100px] flex items-center justify-center">
                  <FiTool className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Card - Tenant Communication */}
          <motion.div
            className="bg-white rounded-2xl p-8 border border-[#E5E5E5]"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h2
              className="text-3xl md:text-4xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Tenant Communication
            </h2>
            <p
              className="text-lg text-[#737373] mb-6 leading-relaxed"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Send announcements to all properties or specific units instantly. Keep tenants informed with in-app and email notifications. SMS requires an eligible Premium or Lifetime plan; one dedicated organization number is included, with activation and configuration required.
            </p>
            <Link
              href="/features/tenant-communication"
              className="inline-flex items-center space-x-2 text-primary-main hover:text-primary-hover font-medium transition-colors mb-6"
              style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
            >
              <span>Learn more</span>
              <FiArrowRight className="w-4 h-4" />
            </Link>

            {/* Communication Features */}
            <div className="space-y-4">
              <div className="flex items-start space-x-4 p-4 bg-[#F5F5F5] rounded-lg">
                <div className="w-10 h-10 bg-primary-main bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiBell className="w-5 h-5 text-primary-main" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary-main mb-1" style={{ fontFamily: '"Poppins", sans-serif' }}>
                    Property Announcements
                  </h3>
                  <p className="text-sm text-[#737373]" style={{ fontFamily: '"Inter", sans-serif' }}>
                    Broadcast messages to all tenants or target specific properties
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 bg-[#F5F5F5] rounded-lg">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiMessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary-main mb-1" style={{ fontFamily: '"Poppins", sans-serif' }}>
                    Multi-Channel Notifications
                  </h3>
                  <p className="text-sm text-[#737373]" style={{ fontFamily: '"Inter", sans-serif' }}>
                    Reach tenants in-app and by email; eligible Premium/Lifetime plans include one SMS number, with activation and configuration required
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 bg-[#F5F5F5] rounded-lg">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiMessageSquare className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary-main mb-1" style={{ fontFamily: '"Poppins", sans-serif' }}>
                    Real-Time Messaging
                  </h3>
                  <p className="text-sm text-[#737373]" style={{ fontFamily: '"Inter", sans-serif' }}>
                    Instant two-way communication with tenants
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
