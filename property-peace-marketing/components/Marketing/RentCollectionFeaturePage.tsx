import Image from "next/image";
import Link from "next/link";
import { FiCheck, FiZap } from "react-icons/fi";
import { rentPaymentsAreLive } from "@/lib/rent-payment-launch";
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

const cashFlowIcon = "/images/rent-collection/workflow/cash-flow-resources.webp";

const workflowItems = [
  {
    icon: "/images/rent-collection/workflow/properties-tenants.webp",
    title: "Properties and tenants",
    body: "Keep units, leases, contacts, and rent details connected.",
  },
  {
    icon: "/images/rent-collection/workflow/rent-ledger.webp",
    title: "Rent ledger",
    body: "Track charges, verified payments, overdue balances, and payment history.",
  },
  {
    icon: "/images/rent-collection/workflow/follow-up-reminders.webp",
    title: "Follow-up reminders",
    body: "Schedule in-app and email reminders; SMS messaging requires activation and configuration.",
  },
  {
    icon: "/images/rent-collection/workflow/maintenance.webp",
    title: "Maintenance",
    body: "Move repair requests into an organized workflow alongside each property.",
  },
  {
    icon: "/images/rent-collection/workflow/lease-records.webp",
    title: "Lease records",
    body: "Store lease documents, dates, and renewal information in one place.",
  },
  {
    icon: cashFlowIcon,
    title: "Cash-flow resources",
    body: "Use landlord-focused templates to plan income and expenses beyond the monthly rent cycle.",
  },
];

export default function RentCollectionFeaturePage() {
  const live = rentPaymentsAreLive;

  return (
    <main className="bg-brand-forest text-white">
      <section data-marketing-hero-theme="dark" className="relative isolate overflow-hidden bg-brand-forest">
        <div
          className="absolute inset-0 bg-cover bg-[position:70%_center] bg-no-repeat sm:bg-[position:65%_center] lg:bg-center"
          style={{ backgroundImage: 'url(/images/rent-collection/hero.png)' }}
          aria-hidden="true"
        />
        <div
          className="marketing-home-hero-fade absolute inset-0 after:absolute after:inset-0 after:bg-[linear-gradient(to_bottom,rgba(16,44,41,0.55),transparent_24%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl marketing-gutter pb-16 pt-32 sm:pt-36 lg:pb-20">
          <div className="grid items-center gap-8 lg:min-h-[400px] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
            <div className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left">
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-brand-mint">
                COLLECT RENT ONLINE
              </p>
              <h1 className="max-w-3xl text-[2.55rem] font-extrabold leading-[1.06] text-white sm:text-5xl md:text-6xl">
                Track rent collection <span className="text-brand-mint">with ease.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-brand-ivory md:text-xl">
                See who’s paid, spot overdue balances, and automate tenant follow-ups with AI. Collect rent securely through Stripe once your organization completes approval and setup.
              </p>

              <div className="mx-auto mt-8 grid max-w-[22rem] grid-cols-2 gap-3 sm:flex sm:max-w-none sm:justify-center lg:mx-0 lg:justify-start">
                <Link href="https://app.propertypeace.io/register" className="inline-flex min-h-14 items-center justify-center gap-2 bg-brand-teal px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-teal sm:px-7 sm:text-base">
                  <FiZap className="h-4 w-4" />
                  Get Started
                </Link>
                <Link href="/pricing" className="inline-flex min-h-14 items-center justify-center border border-[var(--brand-border)] bg-brand-surface px-3 py-3 text-sm font-semibold text-brand-forest transition hover:border-brand-teal hover:text-brand-teal sm:px-7 sm:text-base">
                  View Pricing
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm font-semibold text-brand-ivory lg:justify-start">
                {trustItems.map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <FiCheck className="h-4 w-4 shrink-0 text-brand-mint" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <Image
              src="/images/rent-collection/hero-wren.webp"
              alt="Wren AI floats above a green ring and points to a checkmark on a payment tablet."
              width={1128}
              height={1128}
              loading="eager"
              className="mx-auto h-auto w-full max-w-[240px] drop-shadow-[0_18px_28px_rgba(0,0,0,0.3)] sm:max-w-[290px] lg:max-w-[400px]"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl marketing-gutter py-20 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-mint">Built for rental income</p>
        <h2 className="mx-auto mt-4 max-w-4xl text-3xl font-extrabold leading-tight text-white md:text-5xl">
          Make rent collection a smooth automated process for you and your tenants
        </h2>
        <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-brand-ivory">
          General-purpose transfers and paper checks leave landlords piecing records together. Property Peace keeps rent-specific charges, reminders, and verified payment activity connected to the right tenant and lease.
        </p>

        <div className="mt-10 grid gap-5 text-left md:grid-cols-3">
          {[
            ["Set the rules once", "Configure rent details and custom late-fee rules for each lease."],
            ["Follow up consistently", "Keep due-date and overdue reminders on a predictable schedule."],
            ["Reconcile with confidence", "Use verified payment events to update one organized rent ledger."],
          ].map(([title, body]) => (
            <article key={title} className="border border-white/10 bg-brand-forest-raised p-7">
              <FiCheck className="h-7 w-7 text-brand-teal" />
              <h3 className="mt-5 text-xl font-extrabold text-white">{title}</h3>
              <p className="mt-3 leading-relaxed text-brand-ivory">{body}</p>
            </article>
          ))}
        </div>

        <Link href="https://app.propertypeace.io/register" className="mt-9 inline-flex min-h-14 items-center justify-center bg-brand-teal px-8 py-3 font-semibold text-white transition hover:bg-brand-teal">
          Get Started
        </Link>
      </section>

      <section className="relative isolate overflow-hidden bg-brand-forest marketing-gutter py-20 text-white">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-[position:70%_center] bg-no-repeat lg:bg-center"
          style={{ backgroundImage: 'url(/images/rent-collection/tenants.png)' }}
          aria-hidden="true"
        />
        <div
          className="marketing-home-hero-fade marketing-home-hero-fade--copy-on-right pointer-events-none absolute inset-0 after:absolute after:inset-0 after:bg-[linear-gradient(to_bottom,var(--brand-forest),transparent_16%)] lg:after:hidden"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-mint">A better tenant experience</p>
            <h2 className="mt-4 text-3xl font-extrabold md:text-5xl">Rent day should feel straightforward for tenants, too.</h2>
            <p className="mt-5 text-lg leading-relaxed text-brand-ivory">
              Give tenants a clear place to understand balances, follow payment instructions, and find their records.
            </p>
          </div>

          <div className="mt-12 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {tenantBenefits.map((benefit) => (
              <article key={benefit.title} className="flex gap-4">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal">
                  <FiCheck className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-lg font-extrabold">{benefit.title}</h3>
                  <p className="mt-2 leading-relaxed text-brand-ivory">{benefit.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl marketing-gutter py-20">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-mint">More than rent collection</p>
            <h2 className="mt-4 text-3xl font-extrabold text-white md:text-5xl">Keep the whole rental workflow connected.</h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-brand-ivory">
              Property Peace brings the records around rent day into the same calm workspace as the rest of your property operations.
            </p>

            <div className="mt-9 grid gap-6 sm:grid-cols-2">
              {workflowItems.map(({ icon, title, body }) => (
                <article key={title} className="flex gap-4">
                  <Image src={icon} alt="" width={44} height={44} className="h-11 w-11 shrink-0" />
                  <div>
                    <h3 className="font-extrabold text-white">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-brand-ivory">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="self-center border border-white/10 bg-brand-forest-raised p-8 md:p-10">
            <Image src={cashFlowIcon} alt="" width={56} height={56} className="h-14 w-14" />
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-brand-ivory">Free landlord resource</p>
            <h2 className="mt-3 text-2xl font-extrabold text-white">Rental property cash-flow template</h2>
            <p className="mt-4 leading-relaxed text-brand-ivory">
              Build a clearer monthly view of rental income, operating expenses, and the cash you can plan around.
            </p>
            <Link className="mt-6 inline-flex items-center font-semibold text-brand-mint underline decoration-2 underline-offset-4 hover:text-brand-mint" href="/blog/rental-property-cash-flow-template-landlords/">
              Get the cash-flow template
            </Link>
          </aside>
        </div>
      </section>

      <RentCollectionFaq live={live} />
    </main>
  );
}
