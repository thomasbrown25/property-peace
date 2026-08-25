import Link from "next/link";
import {
  FiArrowLeft,
  FiBell,
  FiBookOpen,
  FiCheck,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiHome,
  FiShield,
  FiTool,
  FiZap,
} from "react-icons/fi";
import { rentPaymentsAreLive } from "@/lib/rent-payment-launch";
import RentCollectionHeroMock from "./RentCollectionHeroMock";
import RentCollectionFaq from "./RentCollectionFaq";

const trustItems = [
  "Included with Free",
  "Secure bank connections",
  "Automatic payment tracking",
];

const tenantBenefits = [
  {
    title: "A clear balance",
    body: "Tenants can see what is due and review their payment history without chasing down old messages.",
  },
  {
    title: "Secure payment setup",
    body: "Eligible tenants connect a bank account or supported card through Stripe-hosted payment flows.",
  },
  {
    title: "Helpful reminders",
    body: "Scheduled notices make due dates and overdue balances easier to keep track of.",
  },
  {
    title: "Receipts that stay organized",
    body: "Verified payment events update the rent ledger so both sides have a consistent record.",
  },
];

const workflowItems = [
  {
    icon: FiHome,
    title: "Properties and tenants",
    body: "Keep units, leases, contacts, and rent details connected.",
  },
  {
    icon: FiDollarSign,
    title: "Rent ledger",
    body: "Track charges, verified payments, overdue balances, and payment history.",
  },
  {
    icon: FiBell,
    title: "Follow-up reminders",
    body: "Schedule in-app and email reminders; configured SMS messaging remains a Premium feature.",
  },
  {
    icon: FiTool,
    title: "Maintenance",
    body: "Move repair requests into an organized workflow alongside each property.",
  },
  {
    icon: FiFileText,
    title: "Lease records",
    body: "Store lease documents, dates, and renewal information in one place.",
  },
  {
    icon: FiBookOpen,
    title: "Cash-flow resources",
    body: "Use landlord-focused templates to plan income and expenses beyond the monthly rent cycle.",
  },
];

export default function RentCollectionFeaturePage() {
  const live = rentPaymentsAreLive;

  return (
    <main className="bg-white">
      <section data-marketing-hero-theme="light" className="relative overflow-hidden bg-gradient-to-b from-white to-[#F6FAF8]">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-6 sm:pt-36 lg:px-8 lg:pb-24">
          <Link href="/features" className="mb-9 inline-flex items-center text-sm font-semibold text-[#637083] transition-colors hover:text-[#15803D]">
            <FiArrowLeft className="mr-2 h-4 w-4" />
            Back to Features
          </Link>

          <div className="grid items-center gap-12 lg:grid-cols-[0.93fr_1.07fr]">
            <div>
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#15803D]">
                COLLECT RENT ONLINE
              </p>
              <h1 className="max-w-3xl text-[2.55rem] font-bold leading-[1.06] text-[#061E35] sm:text-5xl md:text-6xl">
                The smooth, secure way to collect rent.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#405A70] md:text-xl">
                Custom late fees, automatic AI-assisted follow-ups, and secure bank connections help keep every rent cycle moving.
              </p>

              {!live && (
                <p role="status" className="mt-6 max-w-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
                  Online rent payment access is not currently available. You can still use Property Peace to organize rent records, balances, and reminders.
                </p>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="https://app.propertypeace.io/register" className="inline-flex min-h-14 items-center justify-center gap-2 bg-[#16A34A] px-7 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#15803D]">
                  <FiZap className="h-4 w-4" />
                  {live ? "Set Up Rent Payments" : "Request Rent Payment Access"}
                </Link>
                <Link href="/pricing" className="inline-flex min-h-14 items-center justify-center border border-[#D5E0E7] bg-white px-7 py-3 font-semibold text-[#061E35] transition hover:border-[#16A34A] hover:text-[#15803D]">
                  View Pricing
                </Link>
              </div>

              <div className="mt-6 grid gap-2 text-sm font-semibold text-[#405A70] sm:grid-cols-3">
                {trustItems.map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <FiCheck className="h-4 w-4 shrink-0 text-[#16A34A]" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <RentCollectionHeroMock />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#15803D]">Built for rental income</p>
        <h2 className="mx-auto mt-4 max-w-4xl text-3xl font-bold leading-tight text-[#061E35] md:text-5xl">
          Make rent collection a smooth automated process for you and your tenants
        </h2>
        <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-[#516A80]">
          General-purpose transfers and paper checks leave landlords piecing records together. Property Peace keeps rent-specific charges, reminders, and verified payment activity connected to the right tenant and lease.
        </p>

        <div className="mt-10 grid gap-5 text-left md:grid-cols-3">
          {[
            ["Set the rules once", "Configure rent details and custom late-fee rules for each lease."],
            ["Follow up consistently", "Keep due-date and overdue reminders on a predictable schedule."],
            ["Reconcile with confidence", "Use verified payment events to update one organized rent ledger."],
          ].map(([title, body]) => (
            <article key={title} className="bg-[#F0FDF4] p-7">
              <FiCheck className="h-7 w-7 text-[#16A34A]" />
              <h3 className="mt-5 text-xl font-bold text-[#061E35]">{title}</h3>
              <p className="mt-3 leading-relaxed text-[#516A80]">{body}</p>
            </article>
          ))}
        </div>

        <Link href="https://app.propertypeace.io/register" className="mt-9 inline-flex min-h-14 items-center justify-center bg-[#16A34A] px-8 py-3 font-semibold text-white transition hover:bg-[#15803D]">
          {live ? "Collect Rent Securely" : "Request Rent Payment Access"}
        </Link>
      </section>

      <section className="bg-[#061E35] px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5EE58A]">A better tenant experience</p>
            <h2 className="mt-4 text-3xl font-bold md:text-5xl">Rent day should feel straightforward for tenants, too.</h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-200">
              Give tenants a clear place to understand balances, follow payment instructions, and find their records.
            </p>
          </div>

          <div className="mt-12 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {tenantBenefits.map((benefit) => (
              <article key={benefit.title} className="flex gap-4">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#16A34A]">
                  <FiCheck className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-lg font-bold">{benefit.title}</h3>
                  <p className="mt-2 leading-relaxed text-slate-200">{benefit.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#15803D]">More than rent collection</p>
            <h2 className="mt-4 text-3xl font-bold text-[#061E35] md:text-5xl">Keep the whole rental workflow connected.</h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#516A80]">
              Property Peace brings the records around rent day into the same calm workspace as the rest of your property operations.
            </p>

            <div className="mt-9 grid gap-6 sm:grid-cols-2">
              {workflowItems.map(({ icon: Icon, title, body }) => (
                <article key={title} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#EAF9EF] text-[#15803D]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-[#061E35]">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#516A80]">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="self-center bg-[#F3F6F8] p-8 md:p-10">
            <FiBookOpen className="h-9 w-9 text-[#16A34A]" />
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#637083]">Free landlord resource</p>
            <h2 className="mt-3 text-2xl font-bold text-[#061E35]">Rental property cash-flow template</h2>
            <p className="mt-4 leading-relaxed text-[#516A80]">
              Build a clearer monthly view of rental income, operating expenses, and the cash you can plan around.
            </p>
            <Link className="mt-6 inline-flex items-center font-semibold text-[#15803D] underline decoration-2 underline-offset-4" href="/blog/rental-property-cash-flow-template-landlords/">
              Get the cash-flow template
            </Link>
          </aside>
        </div>
      </section>

      <section className="bg-[#F6FAF8] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl text-center">
          <FiShield className="mx-auto h-9 w-9 text-[#16A34A]" />
          <h2 className="mt-5 text-3xl font-bold text-[#061E35] md:text-4xl">Approval comes before payment setup.</h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-[#516A80]">
            Rent payment access starts off for every organization. An owner or manager requests access, Property Peace reviews the request, and Stripe onboarding plus connected-payee review happen separately before tenant payments can be enabled.
          </p>
          <div className="mx-auto mt-9 grid max-w-4xl gap-4 text-left md:grid-cols-3">
            {[
              [FiClock, "1. Request access", "Submit the organization request from Property Peace."],
              [FiShield, "2. Complete review", "Wait for approval, then finish the required Stripe setup."],
              [FiCheck, "3. Confirm readiness", "Payments unlock only after every pay and transfer gate is ready."],
            ].map(([Icon, title, body]) => {
              const StepIcon = Icon as typeof FiCheck;
              return (
                <article key={title as string} className="bg-white p-6">
                  <StepIcon className="h-6 w-6 text-[#16A34A]" />
                  <h3 className="mt-4 font-bold text-[#061E35]">{title as string}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#516A80]">{body as string}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <RentCollectionFaq live={live} />
    </main>
  );
}