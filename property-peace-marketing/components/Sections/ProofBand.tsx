'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertTriangle, FiArrowRight, FiCalendar, FiCheckCircle, FiFileText, FiMessageSquare } from 'react-icons/fi';

const TICK_MS = 50;
const TAB_DURATIONS = [4200, 4200, 4200];

const workflowTabs = [
  {
    label: '1. Chaos captured',
    eyebrow: 'Before Property Peace',
    headline: 'Everything is scattered across texts, sheets, and memory.',
    detail: 'Overdue rent, lease dates, expense receipts, and maintenance asks all compete for attention.',
    callout: '4 loose threads found',
  },
  {
    label: '2. System organizes',
    eyebrow: 'Property Peace workflow',
    headline: 'The app turns landlord noise into a prioritized weekly queue.',
    detail: 'Rent, leases, expenses, and maintenance live together with statuses and next actions.',
    callout: 'Next steps created',
  },
  {
    label: '3. Calm rhythm',
    eyebrow: 'Weekly landlord rhythm',
    headline: 'You know what is due, what is done, and what needs a follow-up.',
    detail: 'Start each week with a clear list instead of reopening every spreadsheet and text thread.',
    callout: 'Calm workflow ready',
  },
];

function ChaosMock() {
  const cards = [
    { icon: FiMessageSquare, title: 'Text thread', note: '“Did unit 2B pay yet?”', tone: 'red' },
    { icon: FiFileText, title: 'Spreadsheet', note: 'Expenses missing receipts', tone: 'amber' },
    { icon: FiCalendar, title: 'Lease date', note: 'Renewal buried in notes', tone: 'blue' },
  ];

  return (
    <div className="h-full overflow-hidden bg-white p-4" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">Chaos</p>
          <h3 className="text-sm font-bold text-[#061e35]">Scattered landlord tasks</h3>
        </div>
        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600 ring-1 ring-red-100">Needs sorting</span>
      </div>

      <div className="space-y-2.5">
        {cards.map((card, index) => {
          const Icon = card.icon;
          const toneClasses =
            card.tone === 'red'
              ? 'border-red-100 bg-red-50/80 text-red-600'
              : card.tone === 'amber'
                ? 'border-amber-100 bg-amber-50/80 text-amber-600'
                : 'border-blue-100 bg-blue-50/80 text-blue-600';

          return (
            <motion.div
              key={card.title}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm"
              initial={{ opacity: 0, x: index % 2 === 0 ? -14 : 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: index * 0.08 }}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${toneClasses}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#061e35]">{card.title}</p>
                <p className="truncate text-[11px] text-slate-500">{card.note}</p>
              </div>
              <FiAlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function OrganizeMock() {
  const items = [
    { label: 'Overdue rent follow-up', meta: 'Auto reminder ready', color: 'bg-green-500' },
    { label: 'Maintenance request', meta: 'Assign vendor', color: 'bg-blue-500' },
    { label: 'Expense receipt', meta: 'Categorize for taxes', color: 'bg-amber-500' },
  ];

  return (
    <div className="h-full overflow-hidden bg-white p-4" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="mb-4 rounded-2xl border border-green-100 bg-green-50 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-500 text-white">
            <FiArrowRight className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-green-600">Organized</p>
            <p className="text-sm font-bold text-[#061e35]">Weekly priority queue</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <motion.div
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.08 }}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#061e35]">{item.label}</p>
                <p className="text-[11px] text-slate-500">{item.meta}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">Next</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className={`h-full rounded-full ${item.color}`}
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.7, delay: 0.15 + index * 0.08 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CalmMock() {
  return (
    <div className="h-full overflow-hidden bg-white p-4" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-green-100 bg-green-50 p-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-600">Calm</p>
          <h3 className="text-sm font-bold text-[#061e35]">This week is under control</h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/25">
          <FiCheckCircle className="h-5 w-5" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          ['Rent', '4/4 paid'],
          ['Leases', '1 renewal queued'],
          ['Expenses', 'Receipts matched'],
          ['Maintenance', '2 tasks scheduled'],
        ].map(([label, value], index) => (
          <motion.div
            key={label}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.07 }}
          >
            <div className="mb-2 h-1.5 w-10 rounded-full bg-green-400" />
            <p className="text-[11px] font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-xs font-bold leading-tight text-[#061e35]">{value}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Next weekly rhythm</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-bold text-[#061e35]">Review Monday checklist</span>
          <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold text-green-700">Ready</span>
        </div>
      </div>
    </div>
  );
}

function WorkflowStepper() {
  const [activeTab, setActiveTab] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const activeTabRef = useRef(0);
  const elapsedRef = useRef(0);
  const isHoveringRef = useRef(false);

  useEffect(() => {
    isHoveringRef.current = isHovering;
  }, [isHovering]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isHoveringRef.current) return;
      elapsedRef.current += TICK_MS;
      if (elapsedRef.current >= TAB_DURATIONS[activeTabRef.current]) {
        elapsedRef.current = 0;
        setActiveTab((current) => {
          const next = (current + 1) % workflowTabs.length;
          activeTabRef.current = next;
          return next;
        });
      }
      setElapsed(elapsedRef.current);
    }, TICK_MS);

    return () => clearInterval(interval);
  }, []);

  const handleTabClick = (index: number) => {
    activeTabRef.current = index;
    elapsedRef.current = 0;
    setElapsed(0);
    setActiveTab(index);
  };

  const progress = (elapsed / TAB_DURATIONS[activeTab]) * 100;

  const renderMock = () => {
    if (activeTab === 0) return <ChaosMock />;
    if (activeTab === 1) return <OrganizeMock />;
    return <CalmMock />;
  };

  return (
    <div
      className="w-full max-w-[500px] justify-self-center lg:justify-self-end"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="overflow-hidden rounded-[1.65rem] border border-slate-200 bg-white shadow-xl shadow-blue-900/10">
        <div className="bg-[#061e35]">
          <div className="flex items-stretch border-b border-white/[0.08]">
            <div className="flex flex-shrink-0 items-center gap-1.5 border-r border-white/[0.08] px-3 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex min-w-0 flex-1">
              {workflowTabs.map((tab, index) => {
                const isActive = index === activeTab;
                return (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => handleTabClick(index)}
                    className={`relative min-w-0 flex-1 px-2 py-3 text-center text-[9px] font-semibold leading-tight transition-colors duration-200 sm:text-[11px] ${
                      isActive ? 'bg-white/[0.12] text-white' : 'text-white/45 hover:bg-white/[0.06] hover:text-white/75'
                    }`}
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    <span className="block truncate">{tab.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                        <div className="h-full bg-green-400" style={{ width: `${progress}%`, transition: 'none' }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 rounded-md bg-white/10 px-3 py-1.5">
              <span className="font-mono text-[11px] text-white/35">workflow.propertypeace.io</span>
            </div>
          </div>
        </div>

        <div className="relative h-[380px] overflow-hidden bg-slate-50">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              className="absolute inset-0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {renderMock()}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`workflow-callout-${activeTab}`}
              className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-green-600/25"
              initial={{ opacity: 0, scale: 0.85, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.25, delay: 0.2 }}
            >
              <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-300" />
              {workflowTabs[activeTab].callout}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-4 min-h-[104px] px-1 text-center sm:min-h-[96px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`workflow-caption-${activeTab}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-600" style={{ fontFamily: '"Inter", sans-serif' }}>
              {workflowTabs[activeTab].eyebrow}
            </p>
            <p className="mt-1 text-sm font-bold text-[#061e35]" style={{ fontFamily: '"Poppins", sans-serif' }}>
              {workflowTabs[activeTab].headline}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500" style={{ fontFamily: '"Inter", sans-serif' }}>
              {workflowTabs[activeTab].detail}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function ProofBand() {
  return (
    <section className="relative overflow-hidden bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 h-px bg-slate-100" />

      <div className="relative mx-auto max-w-6xl">
        <motion.div
          className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="text-center lg:text-left">
            <span
              className="mb-4 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-green-500/20 bg-green-50 px-4 py-1.5 text-center text-xs font-semibold uppercase leading-snug tracking-widest text-green-600 shadow-sm"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              <FiCheckCircle className="h-4 w-4" />
              Built for real landlord workflows
            </span>
            <h2
              className="mb-5 text-3xl font-bold text-[#061e35] md:text-4xl lg:text-5xl"
              style={{ fontFamily: '"Poppins", sans-serif', lineHeight: 1.08 }}
            >
              From landlord chaos to a calm weekly rhythm.
            </h2>
            <p
              className="mb-8 mx-auto max-w-xl text-base leading-relaxed text-slate-600 md:text-lg lg:mx-0"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Property Peace is for landlords managing 1–50 units who are tired of chasing rent in texts,
              tracking expenses in spreadsheets, and wondering what fell through the cracks.
            </p>
            <Link
              href="https://app.propertypeace.io/register"
              className="inline-flex items-center justify-center rounded-none bg-gradient-to-r from-green-500 to-green-600 px-7 py-4 text-base font-bold text-white shadow-xl shadow-green-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700 hover:shadow-green-700/30"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Start free — organize your rentals
            </Link>
          </div>

          <WorkflowStepper />
        </motion.div>
      </div>
    </section>
  );
}
