'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function StickyCTA() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 600);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (dismissed || !visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#061e35] border-t border-white/10 shadow-2xl"
      role="complementary"
      aria-label="Get started prompt"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <p
          className="text-white text-sm md:text-base font-medium hidden sm:block"
          style={{ fontFamily: '"Inter", sans-serif' }}
        >
          Built for 1–50 unit landlords moving from spreadsheets to calm organization. Start free.
        </p>
        <div className="flex items-center gap-3 ml-auto">
          <Link
            href="https://app.propertypeace.io/register"
            className="inline-flex items-center justify-center px-6 py-2.5 text-white rounded-none font-bold text-sm transition-all duration-200 shadow-lg shadow-green-600/25 hover:shadow-green-600/35 hover:brightness-105 whitespace-nowrap"
            style={{
              fontFamily: '"Inter", sans-serif',
              backgroundColor: '#16a34a',
              backgroundImage: 'linear-gradient(135deg, #22c55e, #16a34a)'
            }}
          >
            Start free
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center justify-center px-5 py-2 bg-white/10 text-white rounded-none font-semibold text-sm transition-all duration-200 hover:bg-white/20 whitespace-nowrap"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Schedule Demo
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/50 hover:text-white transition-colors p-1 flex-shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
