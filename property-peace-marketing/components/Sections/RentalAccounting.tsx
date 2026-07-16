'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';

const ORANGE = '#ea580c';
const TICK_MS = 50;
const STEP_DURATIONS = [3500, 4500, 3500];

const steps = [
  { label: 'Income logged' },
  { label: 'Expenses sorted' },
  { label: 'Report ready' },
];

// ── Step 1: Income transactions animating in ─────────────────────────────────
const incomeRows = [
  { label: 'Rent — Unit 2B · James R.',  amount: '+$1,950', date: 'Apr 1'  },
  { label: 'Rent — Unit 4A · Maria S.',  amount: '+$1,700', date: 'Apr 1'  },
  { label: 'Rent — Unit 1C · Chen W.',   amount: '+$1,700', date: 'Mar 25' },
];

function IncomeStep() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Recent income · auto-logged</p>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.2)' }}>
          Synced
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {incomeRows.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.14, duration: 0.28, ease: 'easeOut' }}
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.10)' }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M6 9.5V2.5M2.5 6l3.5-3.5L9.5 6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#374151] truncate">{t.label}</p>
                <p className="text-[10px] text-[#9ca3af]">{t.date}</p>
              </div>
            </div>
            <span className="text-sm font-bold flex-shrink-0" style={{ color: '#16a34a' }}>{t.amount}</span>
          </motion.div>
        ))}
      </div>

      {/* YTD total */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#16a34a' }}>YTD Gross Income</p>
          <p className="text-xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>$48,600</p>
        </div>
        <p className="text-[10px] text-[#9ca3af]">Jan – Apr 2024</p>
      </motion.div>
    </div>
  );
}

// ── Step 2: Expense categories ────────────────────────────────────────────────
const expenseCategories = [
  { label: 'Maintenance & Repairs', amount: '$6,200',  pct: 44, color: ORANGE },
  { label: 'Insurance',             amount: '$2,520',  pct: 18, color: '#f97316' },
  { label: 'Utilities',             amount: '$1,840',  pct: 13, color: '#fb923c' },
  { label: 'Property Management',   amount: '$2,180',  pct: 15, color: '#fdba74' },
  { label: 'Other',                 amount: '$1,490',  pct: 10, color: '#fed7aa' },
];

function ExpensesStep() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Expenses by category · 2024</p>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.08)', color: ORANGE, border: `1px solid rgba(249,115,22,0.2)` }}>
          Auto-tagged
        </span>
      </div>

      <div className="space-y-2.5 mb-4">
        {expenseCategories.map((cat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12, duration: 0.28, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#374151]">{cat.label}</span>
              <span className="text-xs font-bold" style={{ color: ORANGE }}>{cat.amount}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${cat.pct}%` }}
                transition={{ delay: 0.1 + i * 0.12, duration: 0.5, ease: 'easeOut' }}
                style={{ background: cat.color }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Total */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.15)' }}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: ORANGE }}>Total Expenses YTD</p>
          <p className="text-xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>$14,230</p>
        </div>
        <p className="text-[10px] text-[#9ca3af]">5 categories</p>
      </motion.div>
    </div>
  );
}

// ── Step 3: Report ready ──────────────────────────────────────────────────────
function ReportStep() {
  const summaryStats = [
    { label: 'Gross Income', value: '$48,600', color: '#16a34a', bg: 'rgba(34,197,94,0.06)',  border: 'rgba(34,197,94,0.15)' },
    { label: 'Expenses',     value: '$14,230', color: ORANGE,    bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.15)' },
    { label: 'Net Income',   value: '$34,370', color: '#2563eb', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.15)' },
  ];

  return (
    <div style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold text-primary-main">Financial Summary</p>
          <p className="text-xs text-[#9ca3af]">All properties · Jan – Dec 2024</p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.08)', color: ORANGE, border: `1px solid rgba(249,115,22,0.2)` }}>
          Tax-ready
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {summaryStats.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12, duration: 0.28 }}
            className="rounded-xl px-2 py-3 text-center"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}
          >
            <p className="text-[10px] text-[#9ca3af] mb-1 leading-tight">{s.label}</p>
            <p className="text-sm font-bold" style={{ color: s.color, fontFamily: '"Poppins", sans-serif' }}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Schedule E */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="flex items-center justify-between px-3 py-3 rounded-xl mb-3"
        style={{ background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.15)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.10)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="1" width="10" height="12" rx="1.5" stroke={ORANGE} strokeWidth="1.3" />
              <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke={ORANGE} strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-main">Schedule E Report</p>
            <p className="text-[10px] text-[#9ca3af]">Ready to export · 2024</p>
          </div>
        </div>
        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.2)' }}>
          Export PDF
        </span>
      </motion.div>

      {/* Also available */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
        className="flex gap-2"
      >
        {['Rent Ledger', 'Expense Report', 'Cash Flow'].map((r, i) => (
          <span key={i} className="flex-1 text-center text-[10px] font-medium px-2 py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)', color: '#9ca3af' }}>
            {r}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RentalAccounting() {
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);

  const isPausedRef = useRef(false);
  const elapsedRef = useRef(0);
  const activeStepRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.3 });

  useEffect(() => { if (inView) setStarted(true); }, [inView]);

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      if (isPausedRef.current) return;
      elapsedRef.current += TICK_MS;
      if (elapsedRef.current >= STEP_DURATIONS[activeStepRef.current]) {
        elapsedRef.current = 0;
        setActiveStep((s) => { const next = (s + 1) % steps.length; activeStepRef.current = next; return next; });
      }
      setElapsed(elapsedRef.current);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [started]);

  const handleStepClick = (i: number) => {
    activeStepRef.current = i; setActiveStep(i); elapsedRef.current = 0; setElapsed(0);
  };

  const progress = (elapsed / STEP_DURATIONS[activeStep]) * 100;

  return (
    <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">

          {/* Left — Stepper */}
          <motion.div
            ref={containerRef}
            className="relative w-full"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div
              className="rounded-2xl border border-gray-200 overflow-hidden"
              style={{ background: '#ffffff', boxShadow: '0 20px 60px rgba(10,45,82,0.10)' }}
              onMouseEnter={() => { isPausedRef.current = true; }}
              onMouseLeave={() => { isPausedRef.current = false; }}
            >
              {/* Card header */}
              <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.10)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                        <path d="M7 8h2v5H7zM11 6h2v7h-2zM15 10h2v3h-2z" fill={ORANGE} stroke="none" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary-main" style={{ fontFamily: '"Inter", sans-serif' }}>Rental Accounting</p>
                      <p className="text-xs text-[#9ca3af]" style={{ fontFamily: '"Inter", sans-serif' }}>All properties · 2024</p>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(249,115,22,0.08)', color: ORANGE, border: `1px solid rgba(249,115,22,0.2)`, fontFamily: '"Inter", sans-serif' }}>
                    Tax-ready
                  </span>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                  {steps.map((step, i) => {
                    const isActive = i === activeStep;
                    return (
                      <button
                        key={i}
                        onClick={() => handleStepClick(i)}
                        className="flex-1 relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-left overflow-hidden transition-colors duration-200"
                        style={{ background: isActive ? 'rgba(249,115,22,0.07)' : 'rgba(0,0,0,0.02)', border: isActive ? `1px solid rgba(249,115,22,0.25)` : '1px solid rgba(0,0,0,0.06)' }}
                      >
                        <span className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ background: isActive ? ORANGE : 'rgba(0,0,0,0.08)', color: isActive ? '#fff' : '#9ca3af' }}>
                          {i + 1}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-medium leading-tight" style={{ color: isActive ? ORANGE : '#9ca3af' }}>
                          {step.label}
                        </span>
                        {isActive && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'rgba(249,115,22,0.12)' }}>
                            <div className="h-full" style={{ width: `${progress}%`, background: ORANGE, transition: 'none' }} />
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
                    {activeStep === 0 && <IncomeStep />}
                    {activeStep === 1 && <ExpensesStep />}
                    {activeStep === 2 && <ReportStep />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Right — Content */}
          <motion.div
            className="text-center lg:text-left"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <span
              className="inline-block text-xs font-semibold tracking-widest uppercase mb-5 px-3 py-1 rounded-full border"
              style={{ fontFamily: '"Inter", sans-serif', color: '#16a34a', borderColor: 'rgba(34,197,94,0.20)', background: 'rgba(34,197,94,0.08)' }}
            >
              Rental Accounting &amp; Reports
            </span>

            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5 text-primary-main"
              style={{ fontFamily: '"Poppins", sans-serif', lineHeight: '1.2' }}
            >
              Track income and expenses with automated reports.
            </h2>

            <p
              className="text-base md:text-lg text-[#737373] mb-6 leading-relaxed"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Generate Schedule E reports, rent ledgers, and expense breakdowns automatically. Easier to use and more affordable than QuickBooks — replace messy spreadsheets with organized, tax-ready financials.
            </p>

            <p
              className="text-sm md:text-base text-[#516A80] mb-6 italic pl-4"
              style={{ fontFamily: '"Inter", sans-serif', borderLeft: '3px solid #0a2d52' }}
            >
              No more juggling QuickBooks, paper receipts, and manual spreadsheets at tax time.
            </p>

            <Link
              href="/features/financial-reports"
              className="inline-flex items-center gap-1.5 font-medium text-sm transition-colors"
              style={{ fontFamily: '"Inter", sans-serif', color: '#0a2d52' }}
            >
              Explore how rental accounting works
              <span>→</span>
            </Link>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
