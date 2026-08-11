'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertTriangle, FiBell, FiCheck, FiClock, FiCreditCard, FiDollarSign, FiMail, FiMessageSquare, FiRefreshCw } from 'react-icons/fi';

const TICK_MS = 50;
const STEP_DURATIONS = [3200, 4200, 3200];

const steps = [
  {
    label: 'Rent status',
    caption: 'See paid, due, and overdue rent without opening a spreadsheet.',
    callout: '1 tenant needs a nudge',
  },
  {
    label: 'Reminder sent',
    caption: 'Send by email; Premium includes one SMS number, with activation and configuration required.',
    callout: 'Reminder ready',
  },
  {
    label: 'Ledger updated',
    caption: 'When the tenant pays, the balance and rent roll update automatically.',
    callout: 'Payment posted',
  },
];

const tenants = [
  { name: 'Sarah Mitchell', unit: '4B', amount: '$1,450', status: 'Overdue', tone: 'red' },
  { name: 'Marcus Lee', unit: '2A', amount: '$1,325', status: 'Paid', tone: 'green' },
  { name: 'Nora Patel', unit: '1C', amount: '$1,600', status: 'Due soon', tone: 'blue' },
];

function StatusPill({ tone, children }: { tone: string; children: React.ReactNode }) {
  const classes =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-600'
      : tone === 'green'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
        : 'border-blue-200 bg-blue-50 text-blue-600';

  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${classes}`}>{children}</span>;
}

function RentStatusMock() {
  return (
    <div className="h-full bg-white p-5" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A8A8A]">October rent roll</p>
          <h3 className="text-base font-bold text-primary-main">Maple Ridge</h3>
        </div>
        <div className="rounded-xl bg-[#f4f8fc] px-3 py-2 text-right">
          <p className="text-[10px] text-[#737373]">Collected</p>
          <p className="text-sm font-bold text-primary-main">$8,225</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-[#E5E5E5] bg-[#F8FBFF] p-2.5">
          <p className="text-[10px] text-[#737373]">Paid</p>
          <p className="text-lg font-bold text-emerald-600">5</p>
        </div>
        <div className="rounded-xl border border-[#E5E5E5] bg-[#F8FBFF] p-2.5">
          <p className="text-[10px] text-[#737373]">Due</p>
          <p className="text-lg font-bold text-blue-600">1</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-2.5">
          <p className="text-[10px] text-red-500">Late</p>
          <p className="text-lg font-bold text-red-600">1</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {tenants.map((tenant, index) => (
          <motion.div
            key={tenant.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.08 }}
            className="flex items-center justify-between rounded-xl border border-[#E5E5E5] bg-white px-3 py-2.5 shadow-sm"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${tenant.tone === 'red' ? 'bg-red-50 text-red-500' : tenant.tone === 'green' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>
                {tenant.tone === 'red' ? <FiAlertTriangle className="h-4 w-4" /> : tenant.tone === 'green' ? <FiCheck className="h-4 w-4" /> : <FiClock className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-primary-main">{tenant.name}</p>
                <p className="text-[10px] text-[#8A8A8A]">Unit {tenant.unit}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-primary-main">{tenant.amount}</p>
              <StatusPill tone={tenant.tone}>{tenant.status}</StatusPill>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ReminderMock() {
  return (
    <div className="flex h-full flex-col bg-white" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="border-b border-[#E5E5E5] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-main text-white">
            <FiBell className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-primary-main">Rent reminder</p>
            <p className="text-[10px] text-[#737373]">Sarah Mitchell · Unit 4B</p>
          </div>
          <span className="ml-auto rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">5 days late</span>
        </div>
      </div>

      <div className="flex-1 space-y-3 p-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl rounded-tl-sm bg-[#f4f8fc] p-3 text-xs leading-relaxed text-[#405a70]">
          Hi Sarah — this is a friendly reminder that October rent for Unit 4B is currently overdue.
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="rounded-2xl rounded-tl-sm bg-[#f4f8fc] p-3 text-xs leading-relaxed text-[#405a70]">
          You can pay securely through your tenant portal whenever you’re ready.
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }} className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold text-blue-700">Send reminder via</p>
            <FiRefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-1.5 rounded-none bg-white px-3 py-2 text-xs font-bold text-primary-main shadow-sm">
              <FiMail className="h-3.5 w-3.5 text-primary-main" /> Email
            </button>
            <button className="flex items-center justify-center gap-1.5 rounded-none bg-primary-main px-3 py-2 text-xs font-bold text-white shadow-sm">
              <FiMessageSquare className="h-3.5 w-3.5" /> SMS
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function LedgerMock() {
  return (
    <div className="h-full bg-white p-5" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="mb-5 flex flex-col items-center text-center">
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <FiCheck className="h-6 w-6" />
        </motion.div>
        <h3 className="text-base font-bold text-primary-main">Payment received</h3>
        <p className="text-xs text-[#737373]">Sarah Mitchell · Unit 4B</p>
      </div>

      <div className="mb-4 rounded-2xl border border-[#E5E5E5] bg-[#F8FBFF] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-[#737373]">Amount</span>
          <span className="text-lg font-bold text-primary-main">$1,450.00</span>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-[#737373]">Method</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#405a70]"><FiCreditCard className="h-3.5 w-3.5 text-primary-main" /> Tenant portal</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#737373]">Late balance</span>
          <span className="text-xs font-bold text-emerald-600">Cleared</span>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold text-emerald-700">Rent roll updated</p>
          <p className="text-xs font-bold text-emerald-700">100%</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: '71%' }} animate={{ width: '100%' }} transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }} />
        </div>
      </div>
    </div>
  );
}

export default function RentCollectionHeroMock() {
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const activeStepRef = useRef(0);
  const elapsedRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (paused) return;
      elapsedRef.current += TICK_MS;
      if (elapsedRef.current >= STEP_DURATIONS[activeStepRef.current]) {
        elapsedRef.current = 0;
        setActiveStep((current) => {
          const next = (current + 1) % steps.length;
          activeStepRef.current = next;
          return next;
        });
      }
      setElapsed(elapsedRef.current);
    }, TICK_MS);

    return () => clearInterval(id);
  }, [paused]);

  const selectStep = (index: number) => {
    activeStepRef.current = index;
    elapsedRef.current = 0;
    setElapsed(0);
    setActiveStep(index);
  };

  const progress = (elapsed / STEP_DURATIONS[activeStep]) * 100;

  return (
    <div className="relative mx-auto w-full max-w-[460px] lg:mx-0" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="absolute -left-8 top-8 h-40 w-40 rounded-full bg-primary-main/10 blur-3xl" />
      <div className="absolute -right-8 bottom-10 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative overflow-hidden rounded-[1.35rem] border border-[#dfeaf5] bg-white shadow-[0_24px_70px_rgba(10,45,82,0.16)]">
        <div className="bg-[#1a2035]">
          <div className="flex items-stretch border-b border-white/[0.08]">
            <div className="flex flex-shrink-0 items-center gap-1.5 border-r border-white/[0.08] px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <div className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex min-w-0 flex-1">
              {steps.map((step, index) => {
                const isActive = index === activeStep;
                return (
                  <button
                    key={step.label}
                    type="button"
                    onClick={() => selectStep(index)}
                    className={`relative min-w-0 flex-1 px-2 py-3 text-center text-[10px] font-semibold leading-tight transition-colors duration-200 ${
                      isActive ? 'bg-white/[0.12] text-white' : 'text-white/45 hover:bg-white/[0.06] hover:text-white/75'
                    }`}
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    <span className="block truncate">{step.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                        <div className="h-full bg-blue-400" style={{ width: `${progress}%`, transition: 'none' }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 rounded-md bg-[#252d42] px-3 py-1.5">
              <span className="font-mono text-[11px] text-white/35">app.propertypeace.io/rent</span>
            </div>
          </div>
        </div>

        <div className="relative h-[370px] overflow-hidden bg-[#f8fbff]">
          <AnimatePresence mode="wait">
            <motion.div key={activeStep} className="absolute inset-0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: 'easeInOut' }}>
              {activeStep === 0 ? <RentStatusMock /> : activeStep === 1 ? <ReminderMock /> : <LedgerMock />}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div key={`callout-${activeStep}`} className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-primary-main px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg" initial={{ opacity: 0, scale: 0.85, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.22, delay: 0.15 }}>
              <FiDollarSign className="h-3 w-3" />
              {steps[activeStep].callout}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#dfeaf5] bg-white/80 p-4 text-center shadow-sm backdrop-blur-sm">
        <AnimatePresence mode="wait">
          <motion.p key={`caption-${activeStep}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="text-sm font-medium leading-relaxed text-[#405a70]" style={{ fontFamily: '"Inter", sans-serif' }}>
            {steps[activeStep].caption}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
