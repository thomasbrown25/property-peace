'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiArrowRight, FiMessageCircle, FiCreditCard, FiHome, FiBarChart2, FiFileText, FiTool, FiBell } from 'react-icons/fi';

export default function FeaturesSection() {
  const features = [
    {
      icon: FiMessageCircle,
      title: 'Tenant Portal',
      description: 'Give tenants a self-service portal to send messages, submit requests, and access important documents—all in one place.',
      gradient: 'from-blue-50 to-blue-100',
      iconColor: 'text-green-600',
      iconBg: 'bg-blue-100',
      link: '/features/tenant-portal',
    },
    {
      icon: FiCreditCard,
      title: 'Track Rent and Reminders',
      description: 'Record payments, see overdue balances, calculate late fees, and manage reminders. Online payment processing is not currently available.',
      gradient: 'from-orange-50 to-orange-100',
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-100',
      link: '/features/payment-processing',
    },
    {
      icon: FiBarChart2,
      title: 'Rental Accounting',
      description: 'Capture receipts on the go via the mobile app and automatically import bank transactions.',
      gradient: 'from-blue-50 to-blue-100',
      iconColor: 'text-green-600',
      iconBg: 'bg-blue-100',
      link: '/features/financial-reports',
    },
    {
      icon: FiFileText,
      title: 'Tax Reporting',
      description: 'Stay on top of your finances with industry-specific reports and make filing your Schedule E easy.',
      gradient: 'from-pink-50 to-pink-100',
      iconColor: 'text-red-600',
      iconBg: 'bg-pink-100',
      link: '/features/financial-reports',
    },
    {
      icon: FiTool,
      title: 'Property Maintenance',
      description: 'Close maintenance requests faster with easy task management and prioritization.',
      gradient: 'from-green-50 to-green-100',
      iconColor: 'text-green-600',
      iconBg: 'bg-green-100',
      link: '/features/maintenance-tracking',
    },
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
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
            Built by landlords for landlords.
          </h2>
          <p
            className="text-xl text-[#737373] max-w-3xl mx-auto"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Offering you the solution to make the rental admin easy
          </p>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-5 gap-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ staggerChildren: 0.1 }}
        >
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <motion.div
                key={index}
                className={`bg-gradient-to-br ${feature.gradient} rounded-2xl p-6 border border-[#E5E5E5] hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                {/* Icon */}
                <div className={`w-12 h-12 ${feature.iconBg} ${feature.iconColor} rounded-lg flex items-center justify-center mb-4`}>
                  <IconComponent className="w-6 h-6" />
                </div>

                {/* Title */}
                <h3
                  className="text-xl font-bold text-primary-main mb-3"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  {feature.title}
                </h3>

                {/* Description */}
                <p
                  className="text-sm text-[#737373] mb-4 leading-relaxed"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  {feature.description}
                </p>

                {/* Learn More Link */}
                <Link
                  href={feature.link}
                  className="inline-flex items-center gap-2 text-primary-main hover:text-primary-hover font-medium transition-colors text-sm"
                  style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
                >
                  <span>Learn more</span>
                  <FiArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
