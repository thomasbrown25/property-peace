'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';

const GREEN = '#16a34a';
const TICK_MS = 50;
const STEP_DURATIONS = [3000, 4500, 3500];

const steps = [
  { label: 'Your pricing' },
  { label: 'Market data' },
  { label: 'Opportunity' },
];

// ── Step 1: Current price & staleness ────────────────────────────────────────
function CurrentPriceStep() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* Property */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <p className="text-sm font-bold text-primary-main">123 Maple St · Unit 2B</p>
          <p className="text-xs text-[#9ca3af]">2 BR / 1 BA · Active listing</p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>
          Stale pricing
        </span>
      </div>

      {/* Current rent */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl px-4 py-3 mb-3 flex items-center justify-between"
        style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.07)' }}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af] mb-0.5">Your current rent</p>
          <p className="text-2xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>
            $1,700<span className="text-sm font-normal text-[#9ca3af] ml-1">/mo</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[#9ca3af]">Last reviewed</p>
          <p className="text-xs font-semibold text-red-400">8 months ago</p>
        </div>
      </motion.div>

      {/* Warning */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-4"
        style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)' }}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#ca8a04" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-xs text-[#92400e]">Local rents have shifted. You may be undercharging compared to current market rates.</p>
      </motion.div>

      {/* Nearby range hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 gap-2"
      >
        {[
          { label: 'Avg nearby 2BR', value: '$1,975/mo', color: GREEN },
          { label: 'Your gap (est.)', value: '−$275/mo',  color: '#dc2626' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <p className="text-[10px] text-[#9ca3af] mb-0.5">{s.label}</p>
            <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ── Step 2: Comparable listings ───────────────────────────────────────────────
const comps = [
  { address: '456 Oak Ave · Unit 3A', beds: '2 BR / 1 BA', price: '$1,975', diff: '+$275', up: true  },
  { address: '789 Elm St · Unit 1C',  beds: '2 BR / 1 BA', price: '$1,900', diff: '+$200', up: true  },
  { address: '321 Pine Rd · Unit 4B', beds: '2 BR / 1 BA', price: '$2,025', diff: '+$325', up: true  },
];

function MarketDataStep() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Nearby comparables · 123 Maple St</p>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.08)', color: GREEN, border: `1px solid rgba(34,197,94,0.2)` }}>Updated today</span>
      </div>

      <div className="space-y-2 mb-4">
        {comps.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.14, duration: 0.28, ease: 'easeOut' }}
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#374151] truncate">{c.address}</p>
              <p className="text-[10px] text-[#9ca3af]">{c.beds}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-sm font-bold text-primary-main">{c.price}</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.08)', color: GREEN }}>
                {c.diff}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Market median */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="rounded-xl px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: GREEN }}>Market median</p>
          <p className="text-xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>$1,975<span className="text-sm font-normal text-[#9ca3af] ml-1">/mo</span></p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[#9ca3af]">Your price</p>
          <p className="text-sm font-bold text-red-400">$1,700/mo</p>
        </div>
      </motion.div>
    </div>
  );
}

// ── Step 3: Opportunity found ─────────────────────────────────────────────────
function OpportunityStep() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* Suggested range */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl px-4 py-4 mb-3 text-center"
        style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: GREEN }}>Suggested market range</p>
        <p className="text-2xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>
          $1,850 – $2,050<span className="text-sm font-normal text-[#9ca3af] ml-1">/mo</span>
        </p>
      </motion.div>

      {/* Gap breakdown */}
      <div className="space-y-2 mb-4">
        {[
          { label: 'Your current price',   value: '$1,700/mo',  color: '#9ca3af' },
          { label: 'Market midpoint',       value: '$1,950/mo',  color: '#374151' },
          { label: 'Monthly opportunity',   value: '+$250/mo',   color: GREEN     },
        ].map((row, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.25 }}
            className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: i === 2 ? 'rgba(34,197,94,0.06)' : 'rgba(0,0,0,0.02)', border: i === 2 ? '1px solid rgba(34,197,94,0.18)' : '1px solid rgba(0,0,0,0.05)' }}
          >
            <span className="text-xs text-[#9ca3af]">{row.label}</span>
            <span className="text-sm font-bold" style={{ color: row.color }}>{row.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Annual callout */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6, duration: 0.3 }}
        className="flex items-center justify-between px-4 py-3 rounded-xl mb-3"
        style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: GREEN }}>Annual opportunity</p>
          <p className="text-xl font-bold" style={{ color: GREEN, fontFamily: '"Poppins", sans-serif' }}>+$3,000 / yr</p>
        </div>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={GREEN} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.75 }}
        className="w-full py-2 text-xs font-semibold rounded-xl text-white"
        style={{ background: GREEN }}
      >
        Update asking price
      </motion.button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RentEstimates() {
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

          {/* Left — Content */}
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
              Rent Estimates
            </span>

            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5 text-primary-main"
              style={{ fontFamily: '"Poppins", sans-serif', lineHeight: '1.2' }}
            >
              Stop leaving money on the table.
            </h2>

            <p
              className="text-base md:text-lg text-[#737373] mb-6 leading-relaxed"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Get instant, data-driven rent estimates based on real comparable listings in your area. Price confidently, attract quality tenants faster, and maximize your monthly income.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6 max-w-sm mx-auto lg:mx-0" style={{ fontFamily: '"Inter", sans-serif' }}>
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <span className="block font-semibold text-red-400 mb-1 text-xs uppercase tracking-wide">Before</span>
                <span className="text-[#737373]">Guessing based on old listings</span>
              </div>
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <span className="block font-semibold text-green-600 mb-1 text-xs uppercase tracking-wide">After</span>
                <span className="text-[#737373]">Real-time market data, instantly</span>
              </div>
            </div>

            <p
              className="text-sm md:text-base text-[#516A80] italic pl-4"
              style={{ fontFamily: '"Inter", sans-serif', borderLeft: '3px solid #0a2d52' }}
            >
              Underpricing costs you hundreds every month. Overpricing leaves your unit sitting empty.
            </p>
          </motion.div>

          {/* Right — Stepper */}
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
              onMouseEnter={() => { isPausedRef.current = true; }}
              onMouseLeave={() => { isPausedRef.current = false; }}
            >
              {/* Card header */}
              <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.10)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3v18h18" /><path d="M18 9l-5 5-4-4-3 3" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary-main" style={{ fontFamily: '"Inter", sans-serif' }}>Rent Estimate</p>
                      <p className="text-xs text-[#9ca3af]" style={{ fontFamily: '"Inter", sans-serif' }}>123 Maple St · Unit 2B</p>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.08)', color: GREEN, border: '1px solid rgba(34,197,94,0.2)', fontFamily: '"Inter", sans-serif' }}>
                    Updated today
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
                        style={{ background: isActive ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.02)', border: isActive ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(0,0,0,0.06)' }}
                      >
                        <span className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ background: isActive ? GREEN : 'rgba(0,0,0,0.08)', color: isActive ? '#fff' : '#9ca3af' }}>
                          {i + 1}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-medium leading-tight" style={{ color: isActive ? GREEN : '#9ca3af' }}>
                          {step.label}
                        </span>
                        {isActive && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'rgba(34,197,94,0.15)' }}>
                            <div className="h-full" style={{ width: `${progress}%`, background: GREEN, transition: 'none' }} />
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
                    {activeStep === 0 && <CurrentPriceStep />}
                    {activeStep === 1 && <MarketDataStep />}
                    {activeStep === 2 && <OpportunityStep />}
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
