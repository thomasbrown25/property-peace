import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowLeft, FiCheck, FiShield, FiClock, FiCalendar, FiExternalLink, FiZap } from "react-icons/fi";
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/lease-shield/blog/', {
  title: "How LeaseShield Helps Landlords: Real Scenarios & Examples | Property Peace",
  description: "See how LeaseShield helps landlords get accurate lease and state law answers from government sources only. Real scenarios: security deposits, notice periods, lease clauses, and compliance.",
  keywords: "LeaseShield examples, how LeaseShield helps landlords, lease law answers, state landlord tenant law scenarios, security deposit law, lease compliance, government sources lease",
  openGraph: {
    title: "How LeaseShield Helps Landlords: Real Scenarios & Examples | Property Peace",
    description: "Real scenarios of how LeaseShield gives landlords accurate, government-sourced answers on security deposits, notice periods, lease clauses, and state law.",
    type: "website",
    url: "https://propertypeace.io/lease-shield/blog",
  },
  twitter: {
    card: "summary_large_image",
    title: "How LeaseShield Helps Landlords: Real Scenarios | Property Peace",
    description: "Examples of how LeaseShield helps with lease and state law questions using only government sources.",
  },
  alternates: {
    canonical: "https://propertypeace.io/lease-shield/blog",
  },
  robots: {
    index: true,
    follow: true,
  },
});

const scenarios = [
  {
    title: "Security deposit deadline and itemized statement",
    situation: "A landlord in Texas wasn’t sure how many days they had to return the security deposit or send an itemized statement after move-out.",
    howLeaseShieldHelped: "LeaseShield pulled the exact Texas Property Code sections and official state guidance. The landlord got the correct deadline (30 days), the required contents of an itemized statement, and direct links to the .gov source—avoiding a late return that could have led to penalties.",
    outcome: "The landlord returned the deposit and statement on time and with the right wording, reducing legal risk.",
  },
  {
    title: "Notice period for lease non-renewal",
    situation: "A landlord in New York wanted to end a month-to-month tenancy and didn’t know how much notice was required.",
    howLeaseShieldHelped: "LeaseShield cited New York Real Property Law and state housing resources. The landlord learned the required notice period (30 days for month-to-month in many cases) and that the notice had to be in writing, with links to the official state sources.",
    outcome: "The landlord sent a proper written notice and avoided a dispute over invalid notice.",
  },
  {
    title: "Clarifying a lease clause for a tenant",
    situation: "A tenant asked whether a “no pets” clause allowed an emotional support animal. The landlord didn’t want to guess under fair housing rules.",
    howLeaseShieldHelped: "LeaseShield pointed to the applicable state and federal guidance (HUD, state housing agency) so the landlord could see how reasonable accommodation requests work and what can and can’t be required. All answers were tied to government and official sources.",
    outcome: "The landlord responded to the tenant with confidence and stayed compliant with fair housing.",
  },
  {
    title: "Late fees and maximum amounts",
    situation: "A landlord in California wanted to charge a late fee but wasn’t sure if their lease amount was allowed under state law.",
    howLeaseShieldHelped: "LeaseShield surfaced California Civil Code and state guidance on late fees, including limits and when they can be charged. The landlord got the correct rules and official links instead of relying on forums or generic advice.",
    outcome: "The landlord adjusted the lease terms to match state law and avoided unenforceable or excessive late fees.",
  },
  {
    title: "Right of entry and notice to enter",
    situation: "A landlord needed to schedule maintenance and didn’t know how much advance notice was required before entering the unit.",
    howLeaseShieldHelped: "LeaseShield cited the state’s landlord-tenant statute on right of entry and notice (e.g., 24 or 48 hours, depending on state). The answer included the exact code section and .gov link.",
    outcome: "The landlord gave proper notice and documented it, protecting both the tenant’s privacy and the landlord’s right to access.",
  },
  {
    title: "Rent increase rules before renewal",
    situation: "A landlord wanted to raise rent at renewal but needed to know whether their state or city required advance notice or capped the increase.",
    howLeaseShieldHelped: "LeaseShield checked official state and local housing resources, surfaced the required notice timing, and showed where local rent stabilization or notice rules could apply.",
    outcome: "The landlord sent the renewal offer with the right timing and avoided surprising the tenant with an unenforceable increase.",
  },
];

export default function LeaseShieldBlogPage() {
  return (
    <div className="min-h-screen bg-white">
      <section data-marketing-hero-theme="light" className="relative overflow-hidden bg-gradient-to-b from-white to-[#F7FAFC] px-4 pb-20 pt-32 text-[#061E35] sm:px-6 md:pb-24 md:pt-36 lg:px-8">
        <div className="relative mx-auto max-w-6xl">
          <Link
            href="/features/lease-shield"
            className="mb-8 inline-flex items-center text-[#637083] transition-colors hover:text-[#061E35]"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            <FiArrowLeft className="w-4 h-4 mr-2" />
            Back to LeaseShield
          </Link>

          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#DCE6ED] bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#16A34A]" style={{ fontFamily: '"Inter", sans-serif' }}>
                <FiShield className="w-3.5 h-3.5" />
                LeaseShield Blog
              </div>
              <h1
                className="mb-6 text-4xl font-bold leading-tight text-[#061E35] md:text-6xl"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                How LeaseShield Helps Landlords: Real Scenarios and Examples
              </h1>
              <p
                className="mb-7 text-lg leading-relaxed text-[#405A70] md:text-xl"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                LeaseShield answers lease and state law questions using only government and official state law sources, so landlords can act with confidence instead of guessing from random forums.
              </p>
              <div className="mb-8 flex flex-wrap items-center gap-5 text-sm text-[#637083]" style={{ fontFamily: '"Inter", sans-serif' }}>
                <span className="flex items-center gap-1.5"><FiCalendar className="w-3.5 h-3.5" /> Updated Jan 2026</span>
                <span className="text-[#DCE6ED]">·</span>
                <span className="flex items-center gap-1.5"><FiClock className="w-3.5 h-3.5" /> 6 min read</span>
                <span className="text-[#DCE6ED]">·</span>
                <span>Property Peace Team</span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="https://app.propertypeace.io/register"
                  className="inline-flex items-center justify-center gap-2 rounded-none px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:brightness-95"
                  style={{ fontFamily: '"Inter", sans-serif', background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                >
                  Ask LeaseShield a Question
                  <FiZap className="h-4 w-4" />
                </Link>
                <Link
                  href="/features/lease-shield"
                  className="inline-flex items-center justify-center gap-2 rounded-none border border-[#DCE6ED] bg-white px-6 py-3.5 text-sm font-semibold text-[#061E35] transition-all hover:bg-[#F7FAFC]"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  See how it works
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-[#DCE6ED] bg-white p-6 shadow-[0_24px_60px_rgba(6,30,53,0.10)]">
              <div className="rounded-2xl border border-[#DCE6ED] bg-[#F7FAFC] p-5">
                <div className="mb-4 flex items-center justify-between border-b border-[#DCE6ED] pb-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>
                    <FiShield className="h-4 w-4 text-[#2f5dff]" /> Sample source-backed answer
                  </div>
                  <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-bold text-[#2f5dff]">.gov only</span>
                </div>
                <p className="mb-3 text-sm font-semibold text-primary-main" style={{ fontFamily: '"Inter", sans-serif' }}>
                  “How long do I have to return a security deposit?”
                </p>
                <p className="mb-4 text-sm leading-relaxed text-[#405A70]" style={{ fontFamily: '"Inter", sans-serif' }}>
                  LeaseShield summarizes the applicable state rule, then links back to official statutes, housing agency pages, or attorney general guidance so you can verify the answer.
                </p>
                <div className="rounded-xl bg-[#f7fbff] p-4 text-sm text-[#405a70]" style={{ fontFamily: '"Inter", sans-serif' }}>
                  <div className="mb-2 flex items-center gap-2 font-semibold text-primary-main"><FiExternalLink className="h-4 w-4 text-[#2f5dff]" /> Example citations</div>
                  <ul className="space-y-2">
                    <li>State property code section</li>
                    <li>Attorney general landlord guide</li>
                    <li>Official housing agency resource</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <article className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16">
        {/* Intro */}
        <section className="mb-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f5dff]" style={{ fontFamily: '"Inter", sans-serif' }}>
              Why it matters
            </p>
            <h2
              className="text-3xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Government-only sources reduce risk
            </h2>
          </div>
          <div className="space-y-5">
            <p
              className="text-[17px] text-[#405a70] leading-[1.85]"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Generic AI and random blogs can give outdated or wrong advice. LeaseShield is different: every answer is grounded in your state’s statutes, attorney general guides, housing agency resources, and .gov websites. You get the same kind of sources lawyers and courts use—so you can act with confidence and stay compliant.
            </p>
            <p
              className="text-[17px] text-[#405a70] leading-[1.85]"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Below are examples of how landlords use LeaseShield in common situations. These illustrate the types of questions LeaseShield handles and how citable, state-specific answers help.
            </p>
          </div>
        </section>

        {/* Scenarios */}
        <section className="grid gap-6 lg:grid-cols-2" aria-label="LeaseShield help scenarios">
          {scenarios.map((scenario, index) => (
            <div
              key={index}
              className="border border-[#dfeaf5] rounded-[24px] p-6 md:p-7 bg-white shadow-[0_14px_38px_rgba(10,45,82,0.06)]"
              itemScope
              itemType="https://schema.org/Article"
            >
              <div className="mb-5 flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#eef4ff] text-sm font-bold text-[#2f5dff]">
                  {index + 1}
                </div>
                <h2
                  className="text-xl md:text-2xl font-bold text-primary-main leading-tight"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                  itemProp="headline"
                >
                  {scenario.title}
                </h2>
              </div>
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-[#8fa8c0] uppercase tracking-[0.18em] mb-2" style={{ fontFamily: '"Inter", sans-serif' }}>
                    Situation
                  </h3>
                  <p className="text-[15px] text-[#405a70] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }} itemProp="description">
                    {scenario.situation}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-primary-main uppercase tracking-[0.18em] mb-2 flex items-center gap-2" style={{ fontFamily: '"Inter", sans-serif' }}>
                    <FiCheck className="w-4 h-4 text-[#2f5dff]" />
                    How LeaseShield helped
                  </h3>
                  <p className="text-[15px] text-[#405a70] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                    {scenario.howLeaseShieldHelped}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#dfeaf5] bg-[#f8fbff] p-4">
                  <p className="text-[15px] text-primary-main font-medium leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                    <span className="font-bold">Outcome:</span> {scenario.outcome}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="mt-14 overflow-hidden rounded-[28px] bg-[#061e35] p-8 text-center text-white md:p-12">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
            <FiShield className="h-6 w-6" />
          </div>
          <h2
            className="text-2xl md:text-4xl font-bold mb-4"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Ask LeaseShield before you guess
          </h2>
          <p
            className="text-lg text-white/70 max-w-2xl mx-auto mb-7 leading-relaxed"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Use LeaseShield inside Property Peace for lease and state law questions backed only by official sources. No extra cost.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="https://app.propertypeace.io/register"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#ff7a1a] text-white rounded-none font-bold hover:bg-[#ff8f3d] transition-all hover:-translate-y-0.5"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Ask LeaseShield a Question
              <FiZap className="h-4 w-4" />
            </Link>
            <Link
              href="/features/lease-shield"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/10 text-white border border-white/15 rounded-none font-semibold hover:bg-white/15 transition-colors"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Learn about LeaseShield
            </Link>
          </div>
        </section>
      </article>
    </div>
  );
}
