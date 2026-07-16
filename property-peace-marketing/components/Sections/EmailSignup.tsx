'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FiUserPlus } from 'react-icons/fi';

export default function EmailSignup() {
  const [email, setEmail] = useState('');

  const handleRegisterClick = (e: React.MouseEvent) => {
    if (!email.trim()) {
      return;
    }
    e.preventDefault();
    window.location.href = `https://app.propertypeace.io/register${email ? `?email=${encodeURIComponent(email)}` : ''}`;
  };

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#fcfbfa]">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          {/* Email Input */}
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRegisterClick(e as any);
              }
            }}
            className="flex-1 w-full sm:w-auto px-6 py-3 rounded-full border border-[#E5E5E5] bg-white text-primary-main placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#042238] focus:border-transparent transition-all"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          />

          {/* Create Free Account Button */}
          <Link
            href={`https://app.propertypeace.io/register${email ? `?email=${encodeURIComponent(email)}` : ''}`}
            onClick={handleRegisterClick}
            className="px-5 py-2.5 bg-primary-main text-white rounded-none font-medium transition-all duration-300 flex items-center justify-center space-x-2 hover:bg-primary-hover hover:translate-y-[-2px] hover:shadow-[0_4px_12px_rgba(47,93,255,0.3)] whitespace-nowrap"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            <FiUserPlus className="w-4 h-4" />
            <span>Create Account</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
