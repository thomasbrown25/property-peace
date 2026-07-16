'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';

// ── Stepper config ────────────────────────────────────────────────────────────
const TICK_MS = 50;
const STEP_DURATIONS = [3000, 4500, 3500];

const steps = [
  { label: 'Scanning leases' },
  { label: 'Actions taken' },
  { label: 'Flagged for review' },
];

const leases = [
  { unit: 'Unit 2B', name: 'James R.',  detail: '3 days overdue',  status: 'Reminder sent',   color: '#eab308' },
  { unit: 'Unit 4A', name: 'Maria S.',  detail: 'Due yesterday',   status: 'Grace period',    color: '#3b82f6' },
  { unit: 'Unit 1C', name: 'Chen W.',   detail: '22 days overdue', status: 'Follow-up sent',  color: '#f97316' },
  { unit: 'Unit 3D', name: 'Sarah M.',  detail: '36 days overdue', status: 'Flagged',         color: '#ef4444' },
];

const actions = [
  { unit: 'Unit 2B', name: 'James R.',  action: 'Reminder sent',    icon: 'mail',  color: '#eab308', sub: '3 days overdue · friendly tone' },
  { unit: 'Unit 4A', name: 'Maria S.',  action: 'Held — grace period', icon: 'pause', color: '#3b82f6', sub: 'No message sent · 2-day buffer active' },
  { unit: 'Unit 1C', name: 'Chen W.',   action: 'Follow-up sent',   icon: 'mail',  color: '#f97316', sub: '22 days overdue · escalated tone' },
  { unit: 'Unit 3D', name: 'Sarah M.',  action: 'Flagged for review', icon: 'flag',  color: '#ef4444', sub: '36 days overdue · needs attention' },
];

const paymentHistory = [
  { month: 'May', late: false },
  { month: 'Jun', late: true  },
  { month: 'Jul', late: false },
  { month: 'Aug', late: true  },
  { month: 'Sep', late: false },
  { month: 'Oct', late: true  },
];

// ── Icons ────────────────────────────────────────────────────────────────────
function MailIcon({ color }: { color: string }) {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function PauseIcon({ color }: { color: string }) {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
      <rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth={2} fill="none" />
    </svg>
  );
}
function FlagIcon({ color }: { color: string }) {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V5l9-2 9 2v11l-9-2-9 2" />
    </svg>
  );
}

// ── Step 1: Scanning ─────────────────────────────────────────────────────────
function ScanStep() {
  return (
    <div className="space-y-0" style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* Running banner */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-purple-50 border border-purple-100">
        <div className="flex gap-0.5 items-center">
          {[0, 120, 240].map((d) => (
            <div key={d} className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <span className="text-xs font-medium text-purple-700">Daily scan running · Oct 6 · 9:00 AM</span>
      </div>

      {/* Lease rows */}
      <div className="space-y-2.5">
        {leases.map((lease, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12, duration: 0.28, ease: 'easeOut' }}
            className="flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary-main truncate">
                {lease.unit} · {lease.name}
              </p>
              <p className="text-xs text-[#9ca3af]">{lease.detail}</p>
            </div>
            <span
              className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium flex-shrink-0"
              style={{
                background: `${lease.color}14`,
                color: lease.color,
                border: `1px solid ${lease.color}30`,
              }}
            >
              {lease.status}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Footer stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-3 gap-3 mt-5 pt-4"
        style={{ borderTop: '1px solid #e5e7eb' }}
      >
        {[
          { value: '4', label: 'Leases reviewed', color: '#042238' },
          { value: '3', label: 'Messages queued', color: '#a855f7' },
          { value: '1', label: 'Flagged',          color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} className="text-center">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-[#9ca3af]">{s.label}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ── Step 2: Actions dispatched ───────────────────────────────────────────────
function ActionsStep() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif' }}>
      <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide mb-3">
        Percy decisions · Oct 6 · 9:01 AM
      </p>
      <div className="space-y-2.5">
        {actions.map((a, i) => {
          const Icon = a.icon === 'mail' ? MailIcon : a.icon === 'pause' ? PauseIcon : FlagIcon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.18, duration: 0.28, ease: 'easeOut' }}
              className="flex items-start gap-3 p-2.5 rounded-xl"
              style={{ background: 'rgba(6,30,53,0.06)', border: '1px solid rgba(6,30,53,0.10)' }}
            >
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${a.color}18` }}
              >
                <Icon color={a.color} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-primary-main">{a.unit} · {a.name}</p>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                    style={{ background: `${a.color}18`, color: a.color }}
                  >
                    {a.action}
                  </span>
                </div>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">{a.sub}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 3: Flagged detail ───────────────────────────────────────────────────
function FlaggedStep() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* Flagged header */}
      <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
        <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <FlagIcon color="#ef4444" />
        </div>
        <div>
          <p className="text-xs font-bold text-red-700">Sarah M. · Unit 3D</p>
          <p className="text-[10px] text-red-400">36 days overdue · $1,450.00</p>
        </div>
      </div>

      {/* Payment history */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wide mb-2">
          Payment history · last 6 months
        </p>
        <div className="flex items-center gap-1.5">
          {paymentHistory.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08, duration: 0.2 }}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: m.late ? '#fee2e2' : '#dcfce7' }}
              >
                {m.late ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-[9px] text-[#9ca3af]">{m.month}</span>
            </motion.div>
          ))}
          <span className="ml-1 text-[10px] text-red-500 font-semibold">3 of 6 late</span>
        </div>
      </div>

      {/* Percy recommendation */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.3 }}
        className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3"
      >
        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">Percy recommendation</p>
        <p className="text-xs text-amber-800 leading-relaxed">
          Pattern of late payments detected. Consider sending a formal notice and offering a payment plan.
          Late fee may be appropriate.
        </p>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.75 }}
        className="flex gap-2"
      >
        <button className="flex-1 py-1.5 text-xs font-semibold rounded-none text-white" style={{ background: '#061e35' }}>
          Apply Late Fee
        </button>
        <button className="flex-1 py-1.5 text-xs font-semibold rounded-none text-white" style={{ background: '#061e35' }}>
          Send Notice
        </button>
        <button className="flex-1 py-1.5 text-xs font-semibold rounded-none border border-gray-200 text-gray-500">
          Dismiss
        </button>
      </motion.div>
    </div>
  );
}

// ── Bullets / left content ───────────────────────────────────────────────────
const bullets = [
  'Checks grace periods before sending — no premature messages',
  'Reviews 6 months of payment history to personalize tone',
  'Suggests payment plans for repeat late payers',
  'Recommends late fees — never applies them automatically',
  'Suppression prevents tenants from being over-messaged',
];

// ── Main component ───────────────────────────────────────────────────────────
export default function AiSummaries() {
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const isPausedRef = useRef(false);
  const elapsedRef = useRef(0);
  const activeStepRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.3 });
  const started = inView;

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      if (isPausedRef.current) return;
      elapsedRef.current += TICK_MS;
      if (elapsedRef.current >= STEP_DURATIONS[activeStepRef.current]) {
        elapsedRef.current = 0;
        setActiveStep((s) => {
          const next = (s + 1) % steps.length;
          activeStepRef.current = next;
          return next;
        });
      }
      setElapsed(elapsedRef.current);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [started]);

  const handleStepClick = (i: number) => {
    activeStepRef.current = i;
    setActiveStep(i);
    elapsedRef.current = 0;
    setElapsed(0);
  };

  const progress = (elapsed / STEP_DURATIONS[activeStep]) * 100;

  return (
    <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">

          {/* Left Side — Content */}
          <motion.div
            className="text-center lg:text-left"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <span
              className="inline-block text-xs font-semibold tracking-widest uppercase mb-5 px-3 py-1 rounded-full border"
              style={{
                fontFamily: '"Inter", sans-serif',
                color: '#16a34a',
                borderColor: 'rgba(34,197,94,0.20)',
                background: 'rgba(34,197,94,0.08)',
              }}
            >
              Percy Collections Agent
            </span>

            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5 text-primary-main"
              style={{ fontFamily: '"Poppins", sans-serif', lineHeight: '1.2' }}
            >
              Rent follow-ups that write themselves.
            </h2>

            <p
              className="text-base md:text-lg text-[#737373] mb-6 leading-relaxed"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Percy reviews every active lease daily — checking balances, grace periods,
              and payment history — then decides whether to send a friendly reminder, suggest a payment
              plan, or flag a case for your review. All without you lifting a finger.
            </p>

            <ul className="space-y-2.5 mb-6 text-left">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(168,85,247,0.12)' }}
                  >
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="#a855f7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-sm text-[#516A80]" style={{ fontFamily: '"Inter", sans-serif' }}>
                    {b}
                  </span>
                </li>
              ))}
            </ul>

            <p
              className="text-sm md:text-base text-[#516A80] italic pl-4"
              style={{ fontFamily: '"Inter", sans-serif', borderLeft: '3px solid #a855f7' }}
            >
              Stop managing rent collection from memory, text threads, and vibes.
            </p>
          </motion.div>

          {/* Right Side — Animated stepper */}
          <motion.div
            ref={containerRef}
            className="relative w-full"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div
              className="rounded-2xl border border-gray-200 overflow-hidden"
              style={{ background: '#ffffff', boxShadow: '0 20px 60px rgba(10,45,82,0.10)' }}
            >
              {/* Card header */}
              <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(34,197,94,0.12)' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="10" rx="2" />
                        <path d="M9 11V7a3 3 0 0 1 6 0v4" />
                        <circle cx="12" cy="16" r="1" fill="#22c55e" stroke="none" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary-main" style={{ fontFamily: '"Inter", sans-serif' }}>
                        Percy Collections Agent
                      </p>
                      <p className="text-xs flex items-center gap-1.5" style={{ color: '#16a34a', fontFamily: '"Inter", sans-serif' }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#16a34a' }} />
                        Active · Daily at 9:00 AM
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{
                      background: 'rgba(22,163,74,0.08)',
                      color: '#16a34a',
                      border: '1px solid rgba(22,163,74,0.2)',
                      fontFamily: '"Inter", sans-serif',
                    }}
                  >
                    Running
                  </span>
                </div>

                {/* Step tabs */}
                <div className="flex gap-2">
                  {steps.map((step, i) => {
                    const isActive = i === activeStep;
                    return (
                      <button
                        key={i}
                        onClick={() => handleStepClick(i)}
                        className="flex-1 relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-left overflow-hidden transition-colors duration-200"
                        style={{
                          background: isActive ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.02)',
                          border: isActive ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(0,0,0,0.06)',
                        }}
                      >
                        <span
                          className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isActive ? '#22c55e' : 'rgba(0,0,0,0.08)',
                            color: isActive ? '#fff' : '#9ca3af',
                          }}
                        >
                          {i + 1}
                        </span>
                        <span
                          className="text-[9px] sm:text-[10px] font-medium leading-tight"
                          style={{ color: isActive ? '#16a34a' : '#9ca3af' }}
                        >
                          {step.label}
                        </span>
                        {isActive && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'rgba(34,197,94,0.15)' }}>
                            <div
                              className="h-full"
                              style={{ width: `${progress}%`, background: '#22c55e', transition: 'none' }}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step content */}
              <div className="p-5 overflow-hidden" style={{ height: '350px' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    {activeStep === 0 && <ScanStep />}
                    {activeStep === 1 && <ActionsStep />}
                    {activeStep === 2 && <FlaggedStep />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
