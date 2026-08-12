'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TEAL = '#0ea5e9';
const GREEN = '#22c55e';
const NAVY = '#061e35';
const TICK_MS = 50;
const STEP_DURATIONS = [4500, 4500, 3500];

const steps = [
  { label: 'Tenant reports' },
  { label: 'Ticket created' },
  { label: 'Tracked to done' },
];

// ── Step 1: Animated chat ────────────────────────────────────────────────────
type ChatMsg = { from: 'agent' | 'tenant'; text: string; showAt: number };

const chatMessages: ChatMsg[] = [
  { from: 'agent',  text: 'Hi! What maintenance issue are you experiencing?',              showAt: 350  },
  { from: 'tenant', text: 'My kitchen faucet has been dripping for about 2 days.',         showAt: 1900 },
  { from: 'agent',  text: 'Any water damage around the sink, or just the drip?',           showAt: 2900 },
  { from: 'tenant', text: 'Just the drip — no damage that I can see.',                     showAt: 4000 },
];

function ChatStep() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const [typingFrom, setTypingFrom] = useState<'agent' | 'tenant'>('tenant');

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    chatMessages.forEach((msg, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), msg.showAt));
    });

    // Typing indicator before each tenant message
    timers.push(setTimeout(() => { setTypingFrom('tenant'); setShowTyping(true);  }, 1050));
    timers.push(setTimeout(() => { setShowTyping(false); }, 1900));
    timers.push(setTimeout(() => { setTypingFrom('tenant'); setShowTyping(true);  }, 3300));
    timers.push(setTimeout(() => { setShowTyping(false); }, 4000));

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* Chat header */}
      <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: `1px solid ${TEAL}18` }}>
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${TEAL}18` }}>
          <span className="text-[8px] font-bold" style={{ color: TEAL }}>P</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-primary-main leading-tight">Percy Maintenance Agent</p>
          <p className="text-[10px] font-medium" style={{ color: '#16a34a' }}>● Conversation active</p>
        </div>
        <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${TEAL}12`, color: TEAL, border: `1px solid ${TEAL}28` }}>
          42 Oak St · Unit 3B
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2.5 overflow-hidden">
        {chatMessages.slice(0, visibleCount).map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 7, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`flex items-end gap-1.5 ${msg.from === 'tenant' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.from === 'agent' && (
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5" style={{ background: `${TEAL}18` }}>
                <span className="text-[7px] font-bold" style={{ color: TEAL }}>P</span>
              </div>
            )}
            <div
              className="max-w-[78%] px-3 py-2 text-[11px] leading-relaxed"
              style={
                msg.from === 'agent'
                  ? { background: `${TEAL}0e`, color: '#374151', border: `1px solid ${TEAL}22`, borderRadius: '4px 14px 14px 14px' }
                  : { background: TEAL, color: '#ffffff', borderRadius: '14px 14px 4px 14px' }
              }
            >
              {msg.text}
            </div>
            {msg.from === 'tenant' && (
              <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mb-0.5">
                <span className="text-[8px] font-bold text-gray-500">J</span>
              </div>
            )}
          </motion.div>
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {showTyping && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-end gap-1.5 ${typingFrom === 'tenant' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="px-3 py-2 rounded-2xl flex items-center gap-1"
                style={typingFrom === 'tenant'
                  ? { background: `${TEAL}18`, borderRadius: '14px 14px 4px 14px' }
                  : { background: `${TEAL}0e`, border: `1px solid ${TEAL}22`, borderRadius: '4px 14px 14px 14px' }
                }
              >
                {[0, 150, 300].map((d) => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: TEAL, animationDelay: `${d}ms` }} />
                ))}
              </div>
              {typingFrom === 'tenant' && (
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mb-0.5">
                  <span className="text-[8px] font-bold text-gray-500">J</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Step 2: Ticket created ───────────────────────────────────────────────────
function TicketStep() {
  const details = [
    { label: 'Category',  value: 'Plumbing',               color: TEAL    },
    { label: 'Priority',  value: 'Medium',                  color: '#eab308' },
    { label: 'Property',  value: '42 Oak St · Unit 3B',     color: '#374151' },
    { label: 'Tenant',    value: 'James R.',                 color: '#374151' },
    { label: 'Photos',    value: '1 attached',              color: '#9ca3af' },
  ];

  return (
    <div style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* Ticket header */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-start justify-between gap-2 mb-3"
      >
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: TEAL }} />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: TEAL }}>New ticket · Just now</span>
          </div>
          <p className="text-sm font-bold text-primary-main">Kitchen faucet dripping</p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#fef9c3', color: '#a16207', border: '1px solid #fde047' }}>
          Open
        </span>
      </motion.div>

      {/* Detail rows */}
      <div className="space-y-2 mb-3">
        {details.map((d, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.1, duration: 0.25, ease: 'easeOut' }}
            className="flex items-center justify-between py-1.5 px-2.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}
          >
            <span className="text-[11px] text-[#9ca3af]">{d.label}</span>
            <span className="text-[11px] font-semibold" style={{ color: d.color }}>{d.value}</span>
          </motion.div>
        ))}
      </div>

      {/* AI summary */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, duration: 0.3 }}
        className="rounded-xl p-2.5 mb-3"
        style={{ background: `${TEAL}0a`, border: `1px solid ${TEAL}22` }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: TEAL }}>Percy Summary</p>
        <p className="text-[11px] leading-relaxed text-[#374151]">
          &ldquo;Faucet dripping for 2 days. No visible water damage. Standard plumbing repair.&rdquo;
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85 }}
        className="flex gap-2"
      >
        <button className="flex-1 py-1.5 text-xs font-semibold rounded-none text-white" style={{ background: NAVY }}>
          Assign Vendor
        </button>
        <button className="flex-1 py-1.5 text-xs font-semibold rounded-none" style={{ color: NAVY, border: `1px solid ${NAVY}22`, background: `${NAVY}06` }}>
          View Details
        </button>
      </motion.div>
    </div>
  );
}

// ── Step 3: Tracked to done ──────────────────────────────────────────────────
const timeline = [
  { label: 'Ticket submitted',   sub: 'Today · 9:15 AM',           done: true  },
  { label: 'Vendor assigned',    sub: "Mike's Plumbing · 9:18 AM",  done: true  },
  { label: 'Appointment set',    sub: 'Tomorrow · 10:00 – 11:00 AM',done: true  },
  { label: 'Tenant notified',    sub: 'Confirmation sent',           done: true  },
  { label: 'Resolved',           sub: 'Pending completion',          done: false },
];

function TrackingStep() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-primary-main">Kitchen faucet dripping</p>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${TEAL}12`, color: TEAL, border: `1px solid ${TEAL}28` }}>
          In Progress
        </span>
      </div>
      <p className="text-[11px] text-[#9ca3af] mb-4">42 Oak St · Unit 3B · James R.</p>

      {/* Timeline */}
      <div className="space-y-0">
        {timeline.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.13, duration: 0.28, ease: 'easeOut' }}
            className="flex items-start gap-3"
          >
            {/* Icon + connector */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: item.done ? (i === 1 ? '#dcfce7' : `${TEAL}18`) : 'rgba(0,0,0,0.04)', border: item.done ? (i === 1 ? '1px solid #86efac' : `1px solid ${TEAL}30`) : '1px solid rgba(0,0,0,0.08)' }}
              >
                {item.done ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke={i === 1 ? '#16a34a' : TEAL} strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-200" />
                )}
              </div>
              {i < timeline.length - 1 && (
                <div className="w-px flex-1 my-0.5" style={{ height: '20px', background: item.done ? `${TEAL}30` : 'rgba(0,0,0,0.06)' }} />
              )}
            </div>

            {/* Text */}
            <div className="pb-3 min-w-0">
              <p className="text-xs font-semibold" style={{ color: item.done ? '#042238' : '#9ca3af' }}>{item.label}</p>
              <p className="text-[10px] text-[#9ca3af]">{item.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Bullets ───────────────────────────────────────────────────────────────────
const bullets = [
  'Landlords open and manage maintenance records in Property Peace',
  'Limited Percy Pilot review is read-only and restricted to supported records',
  'Percy does not chat with tenants or ask diagnostic questions',
  'Percy does not determine issue type or urgency',
  'Percy does not create or edit maintenance requests',
  'Dispatch, notifications, reminders, and follow-up remain landlord-run',
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function MaintenanceAgent() {
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);

  const isPausedRef = useRef(false);
  const elapsedRef = useRef(0);
  const activeStepRef = useRef(0);

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

          {/* Left Side — Animated stepper */}
          <motion.div
            className="relative w-full"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            onViewportEnter={() => setStarted(true)}
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
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${GREEN}18` }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary-main" style={{ fontFamily: '"Inter", sans-serif' }}>
                        Percy Maintenance Agent
                      </p>
                      <p className="text-xs flex items-center gap-1.5" style={{ color: '#16a34a', fontFamily: '"Inter", sans-serif' }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#16a34a' }} />
                        Active · Tenant-initiated
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: `${GREEN}14`, color: '#16a34a', border: `1px solid ${GREEN}30`, fontFamily: '"Inter", sans-serif' }}
                  >
                    {activeStep === 0 ? 'In conversation' : activeStep === 1 ? 'Ticket ready' : 'In progress'}
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
                          background: isActive ? `${GREEN}0e` : 'rgba(0,0,0,0.02)',
                          border: isActive ? `1px solid ${GREEN}30` : '1px solid rgba(0,0,0,0.06)',
                        }}
                      >
                        <span
                          className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                          style={{ background: isActive ? GREEN : 'rgba(0,0,0,0.08)', color: isActive ? '#fff' : '#9ca3af' }}
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
                          <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: `${GREEN}20` }}>
                            <div className="h-full" style={{ width: `${progress}%`, background: GREEN, transition: 'none' }} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step content */}
              <div className="p-5 overflow-hidden" style={{ height: '385px' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    {activeStep === 0 && <ChatStep />}
                    {activeStep === 1 && <TicketStep />}
                    {activeStep === 2 && <TrackingStep />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Right Side — Content */}
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
              Percy Maintenance Agent
            </span>

            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5 text-primary-main"
              style={{ fontFamily: '"Poppins", sans-serif', lineHeight: '1.2' }}
            >
              Complete tickets,<br />not complaints.
            </h2>

            <p
              className="text-base md:text-lg text-[#737373] mb-6 leading-relaxed"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Property Peace keeps landlord-opened maintenance records organized for landlord review.
              In the limited Percy Pilot, Percy can provide read-only review of supported records;
              Percy does not chat with tenants, diagnose issues, determine issue type or urgency,
              create or edit requests, dispatch vendors, or send notifications or reminders.
            </p>

            <ul className="space-y-2.5 mb-6 text-left">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${GREEN}18` }}
                  >
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
              style={{ fontFamily: '"Inter", sans-serif', borderLeft: `3px solid ${GREEN}` }}
            >
              Landlords remain responsible for follow-up, vendor dispatch, and notifications.
            </p>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
