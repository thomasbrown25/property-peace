import StructuredData from '@/components/SEO/StructuredData';

const faqs = [
  {
    question: 'What is an AI property assistant?',
    answer: 'An AI property assistant helps you understand supported rental records and spot items that may need review. Percy is Property Peace’s limited-pilot attention layer, not a replacement for your judgment or the underlying property-management workflows.',
  },
  {
    question: 'What can Percy help with today?',
    answer: 'In the limited Percy Pilot, Percy can provide portfolio briefings, answer supported questions about portfolio, recorded rent payments, current maintenance, leases, applications, and urgent in-app conversations, and link context to supported workflow categories. It can also surface maintenance status, priority, and age signals plus upcoming lease starts, expirations, and supported signature-status tasks.',
  },
  {
    question: 'Will Percy message tenants or change records without approval?',
    answer: 'No. Current Percy chat is read-only. It does not change records, send tenant messages, sign leases, process payments, dispatch vendors, or execute actions. You review the context and decide what happens next.',
  },
  {
    question: 'Is Property Peace still property-management software?',
    answer: 'Yes. Property Peace remains the system where you organize and manage your rental records. Percy helps summarize supported records; you continue the work in the relevant Property Peace workflow.',
  },
  {
    question: 'Can I start free?',
    answer: 'Yes. The Free plan supports up to 5 units with core tools for listings, leads, applications, tenant access, maintenance requests, leases, basic rent and expense tracking, and documents. No credit card is required. Percy Pilot access is limited and is not guaranteed as a Free or Premium plan entitlement.',
  },
];

export default function PercyFAQ() {
  return (
    <section className="bg-[#F4F8F5] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-700">FAQ</p>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] text-[#061E35] sm:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Straight answers about Percy and Property Peace.</h2>
        </div>
        <div className="mt-10 border-t border-slate-300">
          {faqs.map((faq) => (
            <details key={faq.question} className="group border-b border-slate-300 bg-transparent">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-5 font-bold text-[#061E35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span><span className="text-2xl font-normal text-green-700 transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="max-w-3xl pb-6 pr-8 text-sm leading-7 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>
        <StructuredData data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((faq) => ({ '@type': 'Question', name: faq.question, acceptedAnswer: { '@type': 'Answer', text: faq.answer } })) }} />
      </div>
    </section>
  );
}
