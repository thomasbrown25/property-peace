"use client";

import { useState } from "react";
import { FiChevronDown } from "react-icons/fi";

export type FAQItem = { question: string; answer: string };

export default function AIMaintenanceFAQ({ faqs }: { faqs: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="border-t border-[var(--brand-border)]">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;
        const panelId = `ai-maintenance-faq-panel-${index}`;
        const triggerId = `ai-maintenance-faq-trigger-${index}`;

        return (
          <div key={faq.question} className="border-b border-[var(--brand-border)]">
            <h3>
              <button
                id={triggerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-5 py-6 text-left text-brand-forest transition-colors hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-inset"
              >
                <span className="text-base font-bold sm:text-lg" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>
                  {faq.question}
                </span>
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center border transition-colors ${isOpen ? "border-brand-teal bg-brand-teal text-white" : "border-[var(--brand-border)] text-brand-slate"}`}>
                  <FiChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              hidden={!isOpen}
              className="pb-6 pr-12"
            >
              <p className="text-sm leading-7 text-brand-slate" style={{ fontFamily: '"Inter", sans-serif' }}>
                {faq.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
