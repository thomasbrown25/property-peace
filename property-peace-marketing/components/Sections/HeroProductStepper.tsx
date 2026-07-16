'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TICK_MS = 50;
const STEP_DURATIONS = [3000, 6600, 3000];

const steps = [
  {
    label: 'Rent overdue',
    caption: 'Percy spots overdue rent before you even notice.',
    microcopy: 'No spreadsheets. No manual checking.',
    callout: 'Overdue detected',
  },
  {
    label: 'Percy reaches out',
    caption: 'An automated, friendly follow-up goes out instantly.',
    microcopy: 'The right nudge at the right time — no effort from you.',
    callout: 'Message sent',
  },
  {
    label: 'Rent collected',
    caption: 'Tenant pays via the portal. Ledger updates automatically.',
    microcopy: 'No back-and-forth. No "did they pay?" questions.',
    callout: 'Paid ✓',
  },
];

// ── Step 1: Overdue rent dashboard ──────────────────────────────────────────
function Step1Mock() {
  return (
    <div className="p-5 bg-white h-full overflow-hidden" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Rent Overview</h3>
        <span className="text-xs text-gray-400">October 2024</span>
      </div>

      {/* Overdue card */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-xs font-semibold text-red-700">Rent Overdue</p>
              <span className="text-[10px] text-red-500 font-medium bg-red-100 px-2 py-0.5 rounded-full">5 days late</span>
            </div>
            <p className="text-[11px] text-gray-500">Sarah Mitchell · Unit 4B</p>
            <p className="text-base font-bold text-gray-800 mt-0.5">$1,450.00</p>
          </div>
        </div>
      </div>

      {/* Percy activating */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-[8px] font-bold text-white">P</span>
        </div>
        <span className="text-xs text-blue-700 font-medium">Percy activated</span>
        <div className="ml-auto flex gap-0.5 items-center">
          {[0, 150, 300].map((d) => (
            <div
              key={d}
              className="w-1 h-1 rounded-full bg-blue-400 animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Collection progress */}
      <div className="rounded-lg border border-gray-100 p-3">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-2">Maple Ridge · Oct 2024</p>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Collected</span>
          <span className="text-xs font-semibold text-gray-700">3 / 4 units</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-400 rounded-full" style={{ width: '75%' }} />
        </div>
      </div>
    </div>
  );
}

// ── Chat message definitions ─────────────────────────────────────────────────
type ChatMsg = { from: 'agent' | 'tenant'; text: string; showAt: number };

const chatMessages: ChatMsg[] = [
  {
    from: 'agent',
    text: 'Hi Sarah 👋 Your October rent of $1,450 was due on the 1st and is now 5 days overdue.',
    showAt: 400,
  },
  {
    from: 'agent',
    text: 'You can pay directly through your tenant portal — it only takes a minute.',
    showAt: 1800,
  },
  {
    from: 'tenant',
    text: "Thanks for the reminder! I'm making the payment through my portal right now.",
    showAt: 3500,
  },
  {
    from: 'agent',
    text: "Perfect! You'll receive a confirmation once it processes. 🎉",
    showAt: 4600,
  },
];

// ── Step 2: Animated chat ────────────────────────────────────────────────────
function Step2Mock() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    chatMessages.forEach((msg, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), msg.showAt));
    });
    // Tenant typing indicator appears just before tenant reply
    timers.push(setTimeout(() => setShowTyping(true), 2600));
    timers.push(setTimeout(() => setShowTyping(false), 3500));

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden" style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* Chat header */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2.5 flex-shrink-0">
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] font-bold text-white">P</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-800 leading-tight">Percy</p>
          <p className="text-[10px] text-green-500 font-medium">● Active</p>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full border border-red-100">
            Overdue $1,450
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden px-3 py-3 space-y-2.5">
        {chatMessages.slice(0, visibleCount).map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className={`flex items-end gap-1.5 ${msg.from === 'tenant' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.from === 'agent' && (
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mb-0.5">
                <span className="text-[8px] font-bold text-blue-600">P</span>
              </div>
            )}
            <div
              className={`max-w-[78%] px-3 py-2 text-[11px] leading-relaxed ${
                msg.from === 'agent'
                  ? 'bg-gray-100 text-gray-700 rounded-2xl rounded-bl-sm'
                  : 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
              }`}
            >
              {msg.text}
            </div>
            {msg.from === 'tenant' && (
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mb-0.5">
                <span className="text-[8px] font-bold text-blue-600">S</span>
              </div>
            )}
          </motion.div>
        ))}

        {/* Typing indicator (tenant side) */}
        <AnimatePresence>
          {showTyping && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="flex items-end justify-end gap-1.5"
            >
              <div className="bg-blue-50 border border-blue-100 px-3 py-2 rounded-2xl rounded-br-sm flex items-center gap-1">
                {[0, 150, 300].map((d) => (
                  <div
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mb-0.5">
                <span className="text-[8px] font-bold text-blue-600">S</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Step 3: Payment confirmed ────────────────────────────────────────────────
function Step3Mock() {
  return (
    <div className="p-5 bg-white h-full overflow-hidden" style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* Success header */}
      <div className="flex flex-col items-center pt-1 mb-4">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-800">Payment Received</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Sarah Mitchell · Unit 4B</p>
      </div>

      {/* Payment details */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Amount</span>
          <span className="text-sm font-bold text-gray-800">$1,450.00</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Method</span>
          <span className="text-xs text-gray-600 font-medium">Tenant Portal</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Date</span>
          <span className="text-xs text-gray-600 font-medium">Oct 6, 2024 · 2:14 PM</span>
        </div>
      </div>

      {/* Collection now 100% */}
      <div className="rounded-lg border border-gray-100 p-3 mb-3">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-2">Maple Ridge · Oct 2024</p>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Collected</span>
          <span className="text-xs font-bold text-green-600">4 / 4 units</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-green-400 rounded-full"
            initial={{ width: '75%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 }}
          />
        </div>
      </div>

      {/* Ledger auto-updated */}
      <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
        <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-xs text-green-700 font-medium">Ledger updated automatically</span>
      </div>
    </div>
  );
}

// ── Main stepper ─────────────────────────────────────────────────────────────
export default function HeroProductStepper() {
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isManualPause, setIsManualPause] = useState(false);

  const isPausedRef = useRef(false);
  const manualPauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = useRef(0);
  const activeStepRef = useRef(0);

  useEffect(() => {
    isPausedRef.current = isHovering || isManualPause;
  }, [isHovering, isManualPause]);

  useEffect(() => {
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
  }, []);

  const handleStepClick = (i: number) => {
    if (manualPauseTimer.current) clearTimeout(manualPauseTimer.current);
    activeStepRef.current = i;
    setActiveStep(i);
    elapsedRef.current = 0;
    setElapsed(0);
    setIsManualPause(true);
    manualPauseTimer.current = setTimeout(() => setIsManualPause(false), 3000);
  };

  const progress = (elapsed / STEP_DURATIONS[activeStep]) * 100;

  const renderMock = () => {
    if (activeStep === 0) return <Step1Mock />;
    if (activeStep === 1) return <Step2Mock />;
    return <Step3Mock />;
  };

  return (
    <div
      className="flex-1 flex flex-col items-center justify-start w-full px-4 pt-2 pb-8 sm:px-6 sm:py-12 lg:justify-center lg:px-8 lg:py-8 xl:px-10"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Browser frame */}
      <div className="w-full max-w-[440px] rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
        {/* Browser chrome with interactive tabs */}
        <div className="bg-[#061e35]">
          <div className="flex items-stretch border-b border-white/[0.08]">
            <div className="flex items-center gap-1.5 px-4 py-3 border-r border-white/[0.08] flex-shrink-0">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex flex-1 min-w-0">
              {steps.map((step, i) => {
                const isActive = i === activeStep;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleStepClick(i)}
                    className={`relative flex-1 min-w-0 px-2 py-3 text-center text-[9px] sm:text-[11px] font-semibold leading-tight transition-colors duration-200 ${
                      isActive
                        ? 'bg-white/[0.12] text-white'
                        : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70'
                    }`}
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    <span className="block truncate">{step.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                        <div
                          className="h-full bg-[#061e35]"
                          style={{ width: `${progress}%`, transition: 'none' }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="px-4 py-2.5 flex items-center gap-3">
            <div className="flex-1 rounded-md bg-white/10 px-3 py-1.5">
              <span className="text-[11px] text-white/30 font-mono">app.propertypeace.io</span>
            </div>
          </div>
        </div>

        {/* Mock UI */}
        <div className="relative overflow-hidden bg-gray-50" style={{ height: '360px' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              className="absolute inset-0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {renderMock()}
            </motion.div>
          </AnimatePresence>

          {/* Callout badge */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`callout-${activeStep}`}
              className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-600 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg shadow-green-600/20 pointer-events-none"
              initial={{ opacity: 0, scale: 0.85, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.25, delay: 0.2 }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-green-200 flex-shrink-0" />
              {steps[activeStep].callout}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Caption */}
      <div className="w-full max-w-[440px] mt-4 px-1 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`caption-${activeStep}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-sm font-semibold text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]" style={{ fontFamily: '"Inter", sans-serif' }}>
              {steps[activeStep].caption}
            </p>
            <p className="mt-1 text-xs font-medium text-white/80 drop-shadow-[0_1px_5px_rgba(0,0,0,0.45)]" style={{ fontFamily: '"Inter", sans-serif' }}>
              {steps[activeStep].microcopy}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
