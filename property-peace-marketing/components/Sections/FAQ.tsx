'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiChevronDown } from 'react-icons/fi';
import StructuredData from '@/components/SEO/StructuredData';

const faqs = [
  {
    question: 'Is Property Peace built for small landlords?',
    answer: 'Yes. Property Peace is designed for independent landlords and small portfolios, especially owners managing 1–50 units who want a calmer system without enterprise complexity.',
  },
  {
    question: 'Can I start without a credit card?',
    answer: 'Yes. You can start free with no credit card required, organize your first units, and decide when you are ready to upgrade.',
  },
  {
    question: 'Does Property Peace replace spreadsheets?',
    answer: 'Property Peace is a structured system of record and workflows for self-managing landlords. It helps replace scattered spreadsheets for rent tracking, expenses, lease dates, maintenance notes, reminders, and reporting so rental work stays in one place.',
  },
  {
    question: 'What is Percy?',
    answer: 'Percy is Property Peace’s AI property assistant. It sits alongside the organized records and workflows in Property Peace to help a landlord review supported information; Percy is not a separate property-management service or a replacement for landlord judgment.',
  },
  {
    question: 'What can Percy do today?',
    answer: 'In the limited Percy Pilot, Percy provides landlord-opened, read-only briefings and source-linked context for supported rent-payment, maintenance, lease, and urgent in-app conversation records. It does not autonomously contact tenants or vendors, change records, send reminders, make payments, or execute actions.',
  },
  {
    question: 'Is Percy included in the Free or Premium plan?',
    answer: 'No. Percy Pilot access may be offered separately, but it is not a Free or Premium plan entitlement. Pilot availability and supported records can change as the product is tested.',
  },
  {
    question: 'Can I track income and expenses by property?',
    answer: 'Yes. You can keep income, expenses, receipts, and reports tied to the right rental property so tax-time cleanup is easier.',
  },
  {
    question: 'Can I import properties into Property Peace?',
    answer: 'Property Peace includes a product importer for properties and basic units. Percy does not run imports, and tenants, leases, rent history, expenses, and communications are not included in the current import workflow.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. There are no long-term contracts. You can cancel whenever your needs change.',
  },
];

export default function FAQ() {
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());

  const toggleQuestion = (question: string) => {
    setOpenQuestions((current) => {
      const next = new Set(current);

      if (next.has(question)) {
        next.delete(question);
      } else {
        next.add(question);
      }

      return next;
    });
  };

  return (
    <section className="relative overflow-hidden bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.28), transparent)' }}
      />
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="mx-auto mb-10 max-w-3xl text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <span
            className="mb-5 inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest"
            style={{ fontFamily: '"Inter", sans-serif', color: '#16a34a', borderColor: 'rgba(34,197,94,0.20)', background: 'rgba(34,197,94,0.08)' }}
          >
            FAQ
          </span>
          <h2
            className="mb-4 text-3xl font-bold text-primary-main md:text-4xl lg:text-5xl"
            style={{ fontFamily: '"Poppins", sans-serif', lineHeight: '1.15' }}
          >
            Questions landlords ask before getting started.
          </h2>
          <p
            className="text-base leading-relaxed text-[#737373] md:text-lg"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Get the basics on setup, pricing, accounting, Property Peace workflows, and the current limits of the Percy Pilot.
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((faq, index) => {
            const isOpen = openQuestions.has(faq.question);

            return (
              <motion.div
                key={faq.question}
                className={`rounded-2xl border p-5 shadow-[0_16px_45px_rgba(6,30,53,0.06)] transition-colors duration-300 ${
                  isOpen ? 'border-green-200 bg-green-50/30' : 'border-slate-200 bg-white'
                }`}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, ease: 'easeOut', delay: index * 0.04 }}
              >
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-start justify-between gap-4 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                  onClick={() => toggleQuestion(faq.question)}
                >
                  <span
                    className="text-base font-semibold text-primary-main"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    {faq.question}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600 transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  >
                    <FiChevronDown className="h-4 w-4" />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-answer-${index}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p
                        className="mt-4 border-l-2 border-green-400 pl-4 text-sm leading-6 text-[#516A80]"
                        style={{ fontFamily: '"Inter", sans-serif' }}
                      >
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <StructuredData
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((faq) => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
              },
            })),
          }}
        />
      </div>
    </section>
  );
}
