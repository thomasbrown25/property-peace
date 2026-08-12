'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import FeatureHeroMock from '@/components/Marketing/FeatureHeroMock';
import { FiShield, FiArrowRight, FiCheck, FiBookOpen, FiGlobe, FiMessageSquare } from 'react-icons/fi';

// ── Mock UI panels (mirrored from the app upgrade gate) ──────────────────────

function Mock1() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif', display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>LeaseShield</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', background: '#f0fdf4', color: '#16a34a', borderRadius: 12, border: '1px solid #bbf7d0', fontWeight: 600 }}>California</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 20px', gap: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Ask a landlord-tenant question</div>
        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', maxWidth: 220 }}>Evictions, deposits, lease terms, notices — in plain English</div>
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px' }}>
          <span style={{ flex: 1, fontSize: 11, color: '#475569' }}>What is the eviction process in California?</span>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mock2() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif', display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>LeaseShield</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', background: '#f0fdf4', color: '#16a34a', borderRadius: 12, border: '1px solid #bbf7d0', fontWeight: 600 }}>California</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ alignSelf: 'flex-end', background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 10, padding: '8px 12px', maxWidth: '80%', fontSize: 11, color: '#1e3a5f', fontWeight: 500 }}>
          What is the eviction process in California?
        </div>
        <div style={{ alignSelf: 'flex-start', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', maxWidth: '88%' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>LeaseShield</span>
            <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 8, border: '1px solid #bbf7d0' }}>CA</span>
          </div>
          <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.6 }}>
            In California, a landlord must first serve written notice — typically a <strong>3-day notice to pay or quit</strong> for unpaid rent. If the tenant doesn&apos;t comply, the landlord may file an <em>unlawful detainer</em> action in Superior Court.
          </div>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 8px' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a' }}>CA CCP § 1161 — Official Source</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mock3() {
  const items = [
    { label: 'Notice to pay or quit', value: '3 days' },
    { label: 'Security deposit max', value: '2× rent' },
    { label: 'Deposit return deadline', value: '21 days' },
    { label: 'Entry notice required', value: '24 hours' },
  ];
  return (
    <div style={{ fontFamily: '"Inter", sans-serif', display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>LeaseShield</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {['CA', 'TX', 'NY', 'FL'].map((s, i) => (
            <span key={s} style={{ fontSize: 10, padding: '2px 6px', background: i === 0 ? '#1e3a5f' : '#f1f5f9', color: i === 0 ? 'white' : '#64748b', borderRadius: 8, fontWeight: 600 }}>{s}</span>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', overflow: 'hidden' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>California Quick Reference</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 11, color: '#475569' }}>{item.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', background: '#f0fdf4', padding: '2px 8px', borderRadius: 6 }}>{item.value}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#16a34a', fontWeight: 600 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          Sourced from California Civil Code
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    icon: FiMessageSquare,
    label: 'Ask any question',
    desc: 'Type your landlord-tenant question in plain English — evictions, deposits, notices, habitability, and more. No legal jargon required.',
    Mock: Mock1,
  },
  {
    icon: FiBookOpen,
    label: 'Get sourced answers',
    desc: 'Every response cites official government statutes and codes. No blogs, no guesswork — only defensible, citable sources.',
    Mock: Mock2,
  },
  {
    icon: FiGlobe,
    label: 'All 50 states covered',
    desc: 'Landlord-tenant law varies dramatically by state. Select your state and get jurisdiction-specific guidance wherever your properties are.',
    Mock: Mock3,
  },
];

const BENEFITS = [
  'Answers backed by official government statutes',
  'Covers evictions, deposits, notices, habitability & more',
  'All 50 US states supported',
  'Conversational Percy Pilot — no legal jargon',
  'Included with Premium at no extra cost',
  'Always up to date with current law',
];

const FAQS = [
  {
    q: 'Is LeaseShield actual legal advice?',
    a: 'No — LeaseShield is an informational tool that cites official government sources. It\'s not a substitute for an attorney. For your specific situation, always consult a qualified lawyer.',
  },
  {
    q: 'Which states are covered?',
    a: 'All 50 US states. Just select your state when starting a conversation and LeaseShield will pull jurisdiction-specific statutes and rules.',
  },
  {
    q: 'Where do the answers come from?',
    a: 'LeaseShield uses only official government and legal sources — state statutes, housing authority guidance, and official .gov publications. No blogs or third-party summaries.',
  },
  {
    q: 'Is it included in my plan?',
    a: 'LeaseShield is a Premium feature. Upgrade to Premium to unlock unlimited conversations across all states.',
  },
];

export default function LeaseShieldPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const TICK = 50;
    const TOTAL = 4000;
    const id = setInterval(() => {
      setProgress(p => {
        const next = p + (TICK / TOTAL) * 100;
        if (next >= 100) {
          setActiveStep(s => (s + 1) % STEPS.length);
          return 0;
        }
        return next;
      });
    }, TICK);
    return () => clearInterval(id);
  }, []);

  const ActiveMock = STEPS[activeStep].Mock;

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-green-50/80 via-white to-white" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:gap-12">
          <div className="text-center lg:text-left">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-50 px-4 py-1.5 shadow-sm">
              <FiShield className="h-3.5 w-3.5 text-green-600" />
              <span className="text-sm font-semibold text-green-600" style={{ fontFamily: '"Inter", sans-serif' }}>Premium Feature</span>
            </div>
            <h1
              className="mb-6 text-4xl font-bold leading-tight text-primary-main md:text-5xl lg:text-6xl"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Know your rights.<br />
              <span className="text-green-600">Know the law.</span>
            </h1>
            <p
              className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-[#737373] md:text-xl lg:mx-0"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              LeaseShield is a Percy Pilot legal assistant that answers your landlord-tenant questions using only official government statutes — so you always have a defensible, sourced answer.
            </p>
            <div className="mx-auto grid max-w-[22rem] grid-cols-2 justify-center gap-2.5 sm:flex sm:max-w-none sm:flex-row sm:justify-center sm:gap-3 lg:mx-0 lg:justify-start">
              <Link
                href="https://app.propertypeace.io/register"
                className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700 hover:shadow-[0_10px_24px_rgba(34,197,94,0.25)] sm:min-h-[56px] rounded-none sm:px-8 sm:text-base"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Get started free
                <FiArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-none border border-[#E5E5E5] bg-white px-4 py-3 text-sm font-semibold text-primary-main shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-green-300 hover:text-green-600 sm:min-h-[56px] rounded-none sm:px-8 sm:text-base"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                View pricing
              </Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-[13px] font-semibold text-primary-main sm:flex sm:flex-wrap lg:justify-start" style={{ fontFamily: '"Inter", sans-serif' }}>
              {BENEFITS.slice(0, 4).map((item) => (
                <span key={item} className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-2xl border border-[#E5E5E5] bg-white px-3 py-2 leading-snug shadow-sm sm:min-h-0 sm:rounded-full sm:py-1">
                  <FiCheck className="h-4 w-4 flex-shrink-0 text-green-600" />{item}
                </span>
              ))}
            </div>
          </div>

          <FeatureHeroMock slug="lease-shield" title="LeaseShield" benefits={BENEFITS.slice(0, 4)} />
        </div>
      </section>

      {/* ── 3-Step Showcase ───────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-green-600 uppercase tracking-widest mb-2" style={{ fontFamily: '"Inter", sans-serif' }}>How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>
              Legal clarity in three steps
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Step tabs */}
            <div className="flex flex-col gap-4">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isActive = i === activeStep;
                return (
                  <button
                    key={i}
                    onClick={() => { setActiveStep(i); setProgress(0); }}
                    className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden ${
                      isActive
                        ? 'border-green-500 bg-white shadow-md'
                        : 'border-gray-200 bg-white hover:border-green-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[#061e35]' : 'bg-green-50'}`}>
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-green-600'}`} />
                      </div>
                      <div>
                        <div className={`text-sm font-bold mb-1 ${isActive ? 'text-primary-main' : 'text-gray-700'}`} style={{ fontFamily: '"Inter", sans-serif' }}>
                          Step {i + 1} · {step.label}
                        </div>
                        <div className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>{step.desc}</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-100">
                        <div className="h-full bg-green-500 transition-none" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Browser mock */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                {/* Browser chrome */}
                <div className="bg-[#061e35] px-4 py-3 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 bg-white/10 rounded px-3 py-1.5">
                    <span className="text-[10px] text-white/30 font-mono">app.propertypeace.io/lease-shield</span>
                  </div>
                </div>
                <div
                  key={activeStep}
                  className="h-72 bg-white"
                  style={{ animation: 'lsFadeIn 0.3s ease-out' }}
                >
                  <ActiveMock />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits grid ─────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-green-600 uppercase tracking-widest mb-2" style={{ fontFamily: '"Inter", sans-serif' }}>Everything you need</p>
            <h2 className="text-3xl md:text-4xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>
              Built for landlords, not lawyers
            </h2>
            <p className="mt-4 text-gray-500 max-w-xl mx-auto" style={{ fontFamily: '"Inter", sans-serif' }}>
              Get the answers you need to run your properties confidently — without a $400/hour attorney on speed dial.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BENEFITS.map((b) => (
              <div key={b} className="flex items-start gap-3 p-5 rounded-2xl bg-white border border-gray-100">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FiCheck className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-700" style={{ fontFamily: '"Inter", sans-serif' }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use cases ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-green-600 uppercase tracking-widest mb-2" style={{ fontFamily: '"Inter", sans-serif' }}>Common questions</p>
            <h2 className="text-3xl md:text-4xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>
              What landlords ask
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { q: 'How much notice do I need to give before entering a tenant\'s unit?', tag: 'Entry & access' },
              { q: 'What\'s the maximum security deposit I can charge in my state?', tag: 'Security deposits' },
              { q: 'What\'s the step-by-step eviction process where my property is located?', tag: 'Evictions' },
              { q: 'Am I required to allow emotional support animals even with a no-pets lease?', tag: 'Fair housing' },
              { q: 'How many days do I have to return a security deposit after move-out?', tag: 'Move-out' },
              { q: 'What disclosures am I legally required to make in a lease agreement?', tag: 'Lease disclosures' },
            ].map(({ q, tag }) => (
              <div key={q} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-bold mb-3" style={{ fontFamily: '"Inter", sans-serif' }}>{tag}</div>
                <p className="text-sm text-gray-700 leading-relaxed font-medium" style={{ fontFamily: '"Inter", sans-serif' }}>&ldquo;{q}&rdquo;</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/lease-shield/blog" className="text-green-600 font-semibold text-sm hover:underline" style={{ fontFamily: '"Inter", sans-serif' }}>
              See real examples from landlords →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>Frequently asked</h2>
          </div>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
            {FAQS.map((faq, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-primary-main text-sm" style={{ fontFamily: '"Inter", sans-serif' }}>{faq.q}</span>
                  <span className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#061e35] px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6">
            <FiShield className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: '"Poppins", sans-serif' }}>
            Stop guessing. Start knowing.
          </h2>
          <p className="text-white/70 mb-8 text-lg max-w-xl mx-auto" style={{ fontFamily: '"Inter", sans-serif' }}>
            LeaseShield is included with Premium. Get started today and get instant, sourced answers to any landlord-tenant question.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="https://app.propertypeace.io/register"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-none font-bold hover:from-green-600 hover:to-green-700 hover:shadow-[0_10px_24px_rgba(34,197,94,0.25)] transition-colors text-base shadow-sm"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Start Free
              <FiArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-main rounded-none font-semibold hover:border-green-300 hover:text-green-600 transition-colors border border-[#E5E5E5] text-base"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              See Premium plans
            </Link>
          </div>
          <p className="mt-5 text-white/40 text-xs" style={{ fontFamily: '"Inter", sans-serif' }}>
            For informational purposes only. Not legal advice. Consult a qualified attorney for your specific situation.
          </p>
        </div>
      </section>

      <style jsx global>{`
        @keyframes lsFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
