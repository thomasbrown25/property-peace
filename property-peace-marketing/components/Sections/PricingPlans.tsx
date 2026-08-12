'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';
import { useState } from 'react';

const plans = [
  {
    name: 'Free Plan for Small Portfolios',
    monthlyPrice: 0,
    annualMonthly: 0,
    annualTotal: 0,
    description: 'The essentials for a small portfolio — no credit card required.',
    badge: null,
    features: [
      'Up to 5 units',
      'Hosted Property Peace listing page',
      '1 active external listing (coming soon)',
      'Lead management & showing scheduling',
      'Tenant portal',
      'Maintenance request tracking',
      'Lease management',
      'Basic rent & expense tracking',
      'Digital rental applications',
      'Document storage',
    ],
    cta: 'Start for free',
    ctaHref: 'https://app.propertypeace.io/register',
    highlighted: false,
  },
  {
    name: 'Premium',
    monthlyPrice: 14.99,
    annualMonthly: 12.74,
    annualTotal: 152.90,
    description: 'Complete portfolio management with unlimited units and advanced workflows.',
    badge: null,
    features: [
      'Everything in Free',
      'Unlimited units',
      'Multiple active external listings (coming soon)',
      'Lead source attribution after syndication launches',
      'Rent ledger, late fees & reminders',
      'Automated rent reminders',
      'Advanced accounting & Schedule E',
      'Occupancy tracking',
      'Rent estimates',
      'LeaseShield protection',
      'One dedicated organization SMS number included with Premium; activation and configuration required',
      'Cancel anytime',
    ],
    cta: 'Get started',
    ctaHref: 'https://app.propertypeace.io/register',
    highlighted: true,
  },
];

export default function PricingPlans() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="pt-28 md:pt-32 pb-10 sm:pb-14 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-5 inline-flex items-center rounded-full border border-green-500/20 bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-green-600" style={{ fontFamily: '"Inter", sans-serif' }}>Pricing</div>
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-main mb-4"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Simple, transparent pricing for landlords
          </h1>
          <p
            className="text-lg md:text-xl text-[#737373] max-w-2xl mx-auto mb-8"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Start free. Upgrade when you&apos;re ready. No per-unit charges; provider-dependent workflows are labeled. Limited Percy Pilot access may be available and is not included as a plan entitlement.
          </p>

          {/* Annual toggle */}
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-3 py-2 shadow-sm sm:gap-3 sm:px-4">
            <span
              className={`text-sm font-medium cursor-pointer transition-colors ${!annual ? 'text-primary-main' : 'text-[#737373]'}`}
              style={{ fontFamily: '"Inter", sans-serif' }}
              onClick={() => setAnnual(false)}
            >
              Monthly
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${annual ? 'bg-green-600' : 'bg-[#D1D5DB]'}`}
              aria-label="Toggle annual billing"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${annual ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
            <span
              className={`text-sm font-medium cursor-pointer transition-colors ${annual ? 'text-primary-main' : 'text-[#737373]'}`}
              style={{ fontFamily: '"Inter", sans-serif' }}
              onClick={() => setAnnual(true)}
            >
              Annual <span className="text-green-600 font-semibold">save 15%</span>
            </span>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              className={`relative rounded-2xl p-6 md:p-8 flex flex-col ${
                plan.highlighted
                  ? 'bg-[#061e35] shadow-2xl shadow-slate-950/20'
                  : 'bg-white border border-[#E5E5E5] shadow-sm'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full" style={{ fontFamily: '"Inter", sans-serif' }}>
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2
                  className={`text-xl font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-primary-main'}`}
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  {plan.name}
                </h2>
                <p
                  className={`text-sm mb-4 ${plan.highlighted ? 'text-white/80' : 'text-[#737373]'}`}
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  {plan.description}
                </p>

                {plan.monthlyPrice === 0 ? (
                  <div className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-primary-main'}`} style={{ fontFamily: '"Poppins", sans-serif' }}>
                    Free
                  </div>
                ) : (
                  <div>
                    <div className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-primary-main'}`} style={{ fontFamily: '"Poppins", sans-serif' }}>
                      ${annual ? plan.annualMonthly.toFixed(2) : plan.monthlyPrice.toFixed(2)}
                      <span className={`text-base font-normal ml-1 ${plan.highlighted ? 'text-white/70' : 'text-[#737373]'}`}>/mo</span>
                    </div>
                    {annual && (
                      <p className={`text-sm mt-1 ${plan.highlighted ? 'text-white/70' : 'text-[#737373]'}`} style={{ fontFamily: '"Inter", sans-serif' }}>
                        Billed ${plan.annualTotal.toFixed(2)}/year
                      </p>
                    )}
                  </div>
                )}
              </div>

              <ul className={`mb-8 flex-1 ${plan.features.length > 6 ? 'grid gap-y-3 sm:grid-cols-2 sm:gap-x-4' : 'space-y-3'}`}>
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <FiCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-500" />
                    <span
                      className={`text-sm ${plan.highlighted ? 'text-white/90' : 'text-primary-main'}`}
                      style={{ fontFamily: '"Inter", sans-serif' }}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className={`block w-full rounded-2xl px-6 py-3.5 text-center font-semibold transition-all duration-300 sm:rounded-full ${
                  plan.highlighted
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 hover:translate-y-[-2px] hover:shadow-[0_10px_24px_rgba(34,197,94,0.25)]'
                    : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 hover:translate-y-[-2px] hover:shadow-[0_10px_24px_rgba(34,197,94,0.25)]'
                }`}
                style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
