'use client';

import { motion, Variants } from 'framer-motion';
import { FiDollarSign, FiTool, FiZap } from 'react-icons/fi';

export default function Solutions() {
  const solutions = [
    {
      icon: FiDollarSign,
      title: 'Real-time payment tracking',
      description: "See who's paid, who's late, and who needs a reminder — all in one dashboard. Automated reminders keep you on top of rent collection without the guesswork.",
      benefit: 'Never miss a payment again'
    },
    {
      icon: FiTool,
      title: 'Centralized maintenance hub',
      description: 'All tenant requests in one place, automatically prioritized by urgency. Track status, assign vendors, and keep tenants updated — no more buried emails.',
      benefit: 'Every request tracked, nothing gets missed'
    },
    {
      icon: FiZap,
      title: 'Percy Pilot Summaries',
      description: 'Percy summarizes your entire portfolio, shows you items that need attention, and recommends actions you can trigger with a click.',
      benefit: 'Smart insights, instant actions'
    }
  ];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-6xl mx-auto">
        {/* Headline */}
        <motion.h2
          className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-main text-center mb-12"
          style={{ fontFamily: '"Poppins", sans-serif' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          Everything you need, in one place
        </motion.h2>

        {/* Solution Cards */}
        <motion.div
          className="grid md:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {solutions.map((solution, index) => {
            const IconComponent = solution.icon;
            return (
              <motion.div
                key={index}
                className="bg-white rounded-2xl p-6 md:p-8 shadow-lg border border-[#E5E5E5] hover:shadow-xl transition-shadow text-center lg:text-left"
                style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
                variants={cardVariants}
              >
                {/* Icon */}
                <div className="w-12 h-12 bg-primary-main bg-opacity-10 rounded-lg flex items-center justify-center mb-6 mx-auto lg:mx-0">
                  <IconComponent className="w-6 h-6 text-primary-main" />
                </div>

                {/* Title */}
                <h3
                  className="text-xl md:text-2xl font-bold text-primary-main mb-4"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  {solution.title}
                </h3>

                {/* Description */}
                <p className="text-base md:text-lg text-[#737373] leading-relaxed mb-4" style={{ fontFamily: '"Inter", sans-serif' }}>
                  {solution.description}
                </p>

                {/* Benefit Highlight */}
                <p className="text-sm md:text-base font-medium text-primary-main" style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}>
                  {solution.benefit}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
