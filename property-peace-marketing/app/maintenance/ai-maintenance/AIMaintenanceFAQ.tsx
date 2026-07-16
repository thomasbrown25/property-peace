"use client";

import { useState } from "react";
import { FiChevronDown } from "react-icons/fi";

export type FAQItem = { question: string; answer: string };

export default function AIMaintenanceFAQ({ faqs }: { faqs: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      {faqs.map((faq, index) => (
        <div
          key={index}
          className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        >
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="w-full px-6 py-5 flex items-center justify-between text-left bg-white hover:bg-[#F5F5F5] transition-colors"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            <span className="text-lg font-semibold text-primary-main pr-4" style={{ fontFamily: '"Poppins", sans-serif' }}>
              {faq.question}
            </span>
            <FiChevronDown
              className={`w-5 h-5 text-[#737373] flex-shrink-0 transition-transform ${
                openIndex === index ? "rotate-180" : ""
              }`}
            />
          </button>
          {openIndex === index && (
            <div className="px-6 py-5 bg-[#F5F5F5] border-t border-[#E5E5E5]">
              <p className="text-[#737373] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                {faq.answer}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
