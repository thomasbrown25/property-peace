'use client';

import { motion, type Variants } from 'framer-motion';
import { FiArrowRight, FiCheck, FiShield, FiHome, FiCreditCard } from 'react-icons/fi';
import { SiStripe } from 'react-icons/si';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1], delay },
  }),
};

const paymentSteps = [
  {
    icon: FiHome,
    label: 'Tenant pays online',
    sub: 'Secure online rent payment',
  },
  {
    icon: SiStripe,
    label: 'Stripe processes the payment',
    sub: 'Handled by your payment processor',
  },
  {
    icon: FiCreditCard,
    label: 'Funds go to your account',
    sub: 'Payment status stays visible in the app',
  },
];

const paymentBullets = [
  'Online rent payments tracked in one place',
  'Payment status updates inside the app',
  'Funds deposited to your connected account',
];

const dataBullets = [
  'Secure account access',
  'Permission-based views for different users',
  'Encrypted data transmission',
  'Backups and recovery safeguards',
];

export default function TrustClarity() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          className="text-center mb-14"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          custom={0}
        >
          <span
            className="inline-block text-xs font-semibold tracking-widest uppercase mb-4 px-3 py-1 rounded-full border"
            style={{
              fontFamily: '"Inter", sans-serif',
              color: '#16a34a',
              borderColor: 'rgba(34,197,94,0.20)',
              background: 'rgba(34,197,94,0.08)',
            }}
          >
            Trust &amp; Clarity
          </span>
          <h2
            className="text-3xl md:text-4xl lg:text-[2.6rem] font-bold text-primary-main mb-4"
            style={{ fontFamily: '"Poppins", sans-serif', lineHeight: '1.2' }}
          >
            How money and data are handled
          </h2>
          <p
            className="text-base md:text-lg text-[#6b7280] max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Landlords should not have to guess where payments go, how records are stored, or whether
            a tool was built for their kind of portfolio. Here&apos;s the simple version.
          </p>
        </motion.div>

        {/* Cards grid: left (payment) + right column (data + audience) */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">

          {/* --- Card 1: Payment flow (left, tall) --- */}
          <motion.div
            className="flex flex-col rounded-2xl border border-[#061e35] bg-[#061e35] p-8 shadow-sm"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
            custom={0.1}
          >
            <div className="mb-6">
              <h3
                className="text-xl font-bold text-white mb-1"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                A simple payment flow
              </h3>
              <p
                className="text-sm text-white/70"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                From tenant to your account — no mystery.
              </p>
            </div>

            {/* Step flow */}
            <div className="flex flex-col gap-0 mb-7">
              {paymentSteps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i}>
                    <div className="flex items-start gap-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(34,197,94,0.14)' }}
                      >
                        <Icon size={18} color="#22c55e" />
                      </div>
                      <div>
                        <p
                          className="text-sm font-semibold text-white"
                          style={{ fontFamily: '"Inter", sans-serif' }}
                        >
                          {step.label}
                        </p>
                        <p
                          className="text-xs text-white/60"
                          style={{ fontFamily: '"Inter", sans-serif' }}
                        >
                          {step.sub}
                        </p>
                      </div>
                    </div>
                    {i < paymentSteps.length - 1 && (
                      <div className="w-10 my-1 flex justify-center text-[#22c55e]">
                        <FiArrowRight size={14} style={{ transform: 'rotate(90deg)' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Supporting copy */}
            <p
              className="text-sm text-white/70 leading-relaxed mb-6"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Tenants pay rent online through a secure checkout flow. Payments are processed through
              Stripe, and the payment status is reflected inside the app so you can see what&apos;s paid,
              pending, or overdue without chasing it down manually.
            </p>

            {/* Bullets */}
            <ul className="space-y-2 mt-auto">
              {paymentBullets.map((b, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(34,197,94,0.14)' }}
                  >
                    <FiCheck size={10} color="#22c55e" strokeWidth={3} />
                  </span>
                  <span
                    className="text-sm text-white/80"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    {b}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right column: two stacked cards */}
          <div className="flex flex-col gap-6">

            {/* --- Card 2: Data handling --- */}
            <motion.div
              className="flex flex-col rounded-2xl border border-gray-200 bg-[#f8fafc] p-8 shadow-sm flex-1"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
              custom={0.2}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                >
                  <FiShield size={18} color="#fff" />
                </div>
                <h3
                  className="text-lg font-bold text-primary-main"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  Tenant data stays organized and protected
                </h3>
              </div>
              <p
                className="text-sm text-[#6b7280] leading-relaxed mb-5"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Tenant and property records stay in one organized system instead of getting scattered
                across texts, spreadsheets, and inboxes. Access is controlled through user accounts
                and permissions, data is transmitted securely, and backups help protect important
                records from loss.
              </p>
              <ul className="space-y-2 mt-auto">
                {dataBullets.map((b, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(34,197,94,0.12)' }}
                    >
                      <FiCheck size={10} color="#22c55e" strokeWidth={3} />
                    </span>
                    <span
                      className="text-sm text-[#374151]"
                      style={{ fontFamily: '"Inter", sans-serif' }}
                    >
                      {b}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* --- Card 3: Audience fit --- */}
            <motion.div
              className="rounded-2xl border border-gray-200 bg-[#f8fafc] p-8 shadow-sm"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
              custom={0.3}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                >
                  <FiHome size={18} color="#fff" />
                </div>
                <h3
                  className="text-lg font-bold text-primary-main"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  Built for small landlords
                </h3>
              </div>
              <p
                className="text-sm text-[#6b7280] leading-relaxed mb-3"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Property Peace is designed for independent landlords with{' '}
                <strong className="text-primary-main">1–50 units</strong> who want a calmer way to
                manage rent, maintenance, leases, and tenant communication.
              </p>
              <p
                className="text-xs text-[#9ca3af] italic"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Not overloaded with enterprise workflow built for giant portfolios.
              </p>
            </motion.div>

          </div>
        </div>

        {/* Bottom plain-English note */}
        <motion.p
          className="text-center text-xs text-[#9ca3af] max-w-2xl mx-auto"
          style={{ fontFamily: '"Inter", sans-serif' }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={fadeUp}
          custom={0.4}
        >
          <span className="font-semibold text-[#6b7280]">Plain-English note:</span> Property Peace
          is built to make the operational side of landlording easier to manage. Payment timing and
          deposit schedules can depend on your connected payment setup.
        </motion.p>

      </div>
    </section>
  );
}
