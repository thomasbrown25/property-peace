import { FiChevronDown } from "react-icons/fi";

type RentCollectionFaqProps = {
  live: boolean;
};

export default function RentCollectionFaq({ live }: RentCollectionFaqProps) {
  const faqs = [
    {
      question: "How do landlords collect rent online with Property Peace?",
      answer: live
        ? "An organization owner or manager requests rent-payment access. After Property Peace approval, Stripe onboarding, and connected-payee review are complete, eligible tenants can use the payment options configured for the organization."
        : "Online rent payment access is not currently available. Landlords can still use Property Peace to organize rent charges, recorded payments, overdue balances, late fees, and reminders.",
    },
    {
      question: "Is online rent collection included with Free?",
      answer: "Yes. Rent payment access is included with the Free plan, but it starts off by default and requires organization approval and payment setup. SMS messaging remains a Premium feature and requires activation and configuration.",
    },
    {
      question: "Why does my organization need approval?",
      answer: "Property Peace reviews each request before unlocking onboarding. Approval only opens the setup process; it does not by itself enable tenant payments or transfers.",
    },
    {
      question: "How can tenants pay rent?",
      answer: "Available payment methods depend on the organization's completed Stripe configuration. Eligible tenants may be offered secure bank-account or supported card payment options only after all readiness checks pass.",
    },
    {
      question: "Can rent payments be tracked automatically?",
      answer: "Yes. Verified provider events update the Property Peace rent ledger and payment history, helping landlords reconcile rent without copying transactions from a general-purpose payment app.",
    },
    {
      question: "Does Property Peace support automatic reminders and custom late fees?",
      answer: "Landlords can configure late-fee rules and schedule rent reminders. These are rule-based follow-ups—not autonomous decisions—and SMS delivery requires Premium plus messaging setup.",
    },
    {
      question: "Is it safe to collect rent online?",
      answer: "Property Peace uses Stripe-hosted connection and payment flows, so Property Peace does not store raw bank-account or card credentials. Access and payment actions remain fail-closed until the required approval, onboarding, and readiness checks succeed.",
    },
    {
      question: "How quickly do rent payments reach a landlord?",
      answer: "Timing varies by payment method, provider processing, review status, and bank schedules. Property Peace also keeps safety holds in place—currently 7 days for card payments and 14 days for ACH—so transfers may remain unavailable after a tenant payment is accepted.",
    },
  ];

  return (
    <section aria-labelledby="rent-collection-faq" className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#15803D]">Frequently asked questions</p>
        <h2 id="rent-collection-faq" className="mt-4 text-3xl font-bold text-[#061E35] md:text-5xl">
          Rent collection software FAQs
        </h2>
      </div>

      <div className="mt-10 space-y-3">
        {faqs.map((faq, index) => (
          <details key={faq.question} className="group bg-[#F3F6F8] open:bg-[#EFF8F2]" open={index === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-6 py-5 text-left text-lg font-bold text-[#061E35] marker:content-none">
              {faq.question}
              <FiChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-6 pb-6 leading-relaxed text-[#405A70]">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}