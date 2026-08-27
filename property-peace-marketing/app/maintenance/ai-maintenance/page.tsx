import type { Metadata } from "next";
import Link from "next/link";
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCamera,
  FiCheck,
  FiChevronRight,
  FiClipboard,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiHome,
  FiMessageSquare,
  FiShield,
  FiTool,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import StructuredData from "@/components/SEO/StructuredData";
import { applyOttoSeo } from "@/lib/otto-seo";
import AIMaintenanceFAQ from "./AIMaintenanceFAQ";

export const metadata: Metadata = applyOttoSeo('/maintenance/ai-maintenance/', {
  title: "Percy Pilot Maintenance Management for Landlords | Property Peace",
  description:
    "Organize tenant maintenance requests, photos, priorities, vendors, and repair history with Percy-assisted tools available through the limited Percy Pilot.",
  keywords:
    "Percy Pilot maintenance management, rental property maintenance software, landlord maintenance tracking, work order tracking, tenant maintenance requests, maintenance ticket software, software for small landlords",
  alternates: { canonical: "/maintenance/ai-maintenance" },
  openGraph: {
    title: "Percy Pilot Maintenance Management for Landlords | Property Peace",
    description:
      "Bring maintenance requests, photos, priorities, vendors, and repair history into one clear landlord workflow.",
    type: "website",
    url: "/maintenance/ai-maintenance",
  },
  twitter: {
    card: "summary_large_image",
    title: "Percy Pilot Maintenance Management for Landlords | Property Peace",
    description:
      "Organize rental maintenance work with Percy-assisted intake and a clear landlord-controlled workflow.",
  },
});

const workflow = [
  {
    label: "Tenant report",
    title: "Capture the full issue",
    body: "A request starts with the property, unit, description, and supporting photos in one place.",
  },
  {
    label: "Percy-assisted intake",
    title: "Bring the signal forward",
    body: "The limited pilot helps organize the request and surface context that may need faster attention.",
  },
  {
    label: "Landlord decision",
    title: "Review and take action",
    body: "You confirm the priority, communicate with the tenant, and decide who should handle the work.",
  },
  {
    label: "Repair record",
    title: "Close with history",
    body: "Status, notes, vendor details, and costs stay connected to the property after the repair is done.",
  },
];

const faqs = [
  {
    question: "What is Percy Pilot maintenance management?",
    answer:
      "Percy Pilot is a limited-availability set of assisted tools designed to help organize maintenance intake and highlight useful context. Landlords remain responsible for reviewing every request, deciding its urgency, and choosing the response.",
  },
  {
    question: "Does Percy decide whether a request is an emergency?",
    answer:
      "No. Percy may help surface language or context that appears urgent, but it does not replace landlord judgment, emergency procedures, qualified vendors, or local legal requirements. Always review requests and respond based on the actual situation.",
  },
  {
    question: "Can tenants include photos with a request?",
    answer:
      "Yes. Photos and request details can stay together so you and your vendors have better context before the first visit.",
  },
  {
    question: "Can I keep vendor and repair costs with the work order?",
    answer:
      "Property Peace helps keep vendor details, notes, status, and repair costs connected to the maintenance record and property.",
  },
  {
    question: "Is Property Peace built for small landlords?",
    answer:
      "Yes. Property Peace is designed for independent landlords and hands-on rental owners managing 1–50 units, without an enterprise property-management learning curve.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

const relatedTools = [
  {
    href: "/maintenance/in-app-messaging",
    label: "Maintenance messaging",
    description: "Keep tenant updates and repair context attached to the request.",
    icon: FiMessageSquare,
  },
  {
    href: "/features/maintenance-tracking",
    label: "Maintenance tracking",
    description: "Follow every request from open work to a documented resolution.",
    icon: FiClipboard,
  },
  {
    href: "/rent/expense-tracking",
    label: "Expense tracking",
    description: "Connect repair spending to the property and its financial record.",
    icon: FiDollarSign,
  },
];

export default function AIMaintenancePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-white">
      <StructuredData data={faqSchema} />

      <section
        data-marketing-hero-theme="light"
        className="relative border-b border-[#DCE6ED] bg-white px-4 pb-20 pt-28 sm:px-6 sm:pb-24 sm:pt-36 lg:px-8"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_74%_28%,rgba(187,247,208,0.55),transparent_34%),linear-gradient(180deg,#F7FBF8_0%,#FFFFFF_78%)]" />
        <div className="relative mx-auto max-w-6xl">
          <Link
            href="/features/maintenance-tracking"
            className="mb-9 inline-flex items-center gap-2 text-sm font-semibold text-[#637083] transition-colors hover:text-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] focus-visible:ring-offset-4"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Features <FiChevronRight className="h-4 w-4" /> Maintenance
          </Link>

          <div data-marketing-hero-layout="split" className="grid items-center gap-14 lg:grid-cols-[0.94fr_1.06fr] lg:gap-16">
            <div>
              <div
                className="mb-6 inline-flex items-center gap-2 border border-[#B7E4C7] bg-[#F0FDF4] px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#15803D]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                <FiTool className="h-4 w-4" /> Limited Percy Pilot
              </div>
              <h1
                className="max-w-2xl text-[2.7rem] font-semibold leading-[1.04] tracking-[-0.05em] text-[#061E35] sm:text-5xl lg:text-[3.7rem]"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Turn maintenance chaos into a clear next step.
              </h1>
              <p
                className="mt-6 max-w-xl text-lg leading-8 text-[#405A70]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Bring tenant requests, photos, status, vendors, and repair history into one landlord-controlled workflow—with Percy-assisted intake available through a limited pilot.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="https://app.propertypeace.io/register"
                  className="inline-flex min-h-[54px] items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 px-7 py-3.5 font-bold text-white shadow-lg shadow-green-700/15 transition hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-4 motion-reduce:transform-none"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  Start free <FiArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#maintenance-workflow"
                  className="inline-flex min-h-[54px] items-center justify-center border border-[#B8C8D5] bg-white px-7 py-3.5 font-semibold text-[#061E35] transition hover:border-[#15803D] hover:text-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] focus-visible:ring-offset-4"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  See the workflow
                </Link>
              </div>

              <div
                className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium text-[#405A70]"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                {["Free for up to 5 units", "Built for 1–50 units", "You stay in control"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <FiCheck className="h-4 w-4 text-[#16A34A]" /> {item}
                  </span>
                ))}
              </div>
            </div>

            <aside
              aria-label="Maintenance request triage preview"
              className="relative border border-[#C9D8E4] bg-white shadow-[0_30px_80px_rgba(6,30,53,0.16)]"
            >
              <div className="flex items-center justify-between border-b border-[#DCE6ED] bg-[#061E35] px-5 py-4 text-white sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center bg-white/10">
                    <FiTool className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Maintenance</p>
                    <p className="text-sm font-semibold">New request · #284</p>
                  </div>
                </div>
                <span className="border border-green-300/30 bg-green-400/10 px-2.5 py-1 text-xs font-semibold text-green-200">
                  Percy-assisted
                </span>
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-5 border-b border-[#DCE6ED] pb-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#637083]">Tenant report</p>
                    <h2
                      className="mt-2 text-xl font-bold leading-tight text-[#061E35] sm:text-2xl"
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                    >
                      Water spreading under the kitchen sink
                    </h2>
                    <p className="mt-2 flex items-center gap-2 text-sm text-[#637083]">
                      <FiHome className="h-4 w-4" /> 14 Wren Lane · Unit 2B
                    </p>
                  </div>
                  <div className="hidden h-20 w-20 flex-shrink-0 items-center justify-center bg-[#EDF3F7] text-[#637083] sm:flex">
                    <FiCamera className="h-6 w-6" />
                  </div>
                </div>

                <dl className="divide-y divide-[#DCE6ED]">
                  <div className="grid grid-cols-[8.25rem_1fr] items-center gap-3 py-4 text-sm">
                    <dt className="flex items-center gap-2 font-medium text-[#637083]">
                      <FiAlertTriangle className="h-4 w-4" /> Priority
                    </dt>
                    <dd className="justify-self-start border border-[#FED7AA] bg-[#FFF7ED] px-2.5 py-1 font-bold text-[#C2410C]">
                      Emergency priority
                    </dd>
                  </div>
                  <div className="grid grid-cols-[8.25rem_1fr] items-center gap-3 py-4 text-sm">
                    <dt className="flex items-center gap-2 font-medium text-[#637083]">
                      <FiTool className="h-4 w-4" /> Category
                    </dt>
                    <dd className="font-semibold text-[#061E35]">Plumbing · active leak</dd>
                  </div>
                  <div className="grid grid-cols-[8.25rem_1fr] items-center gap-3 py-4 text-sm">
                    <dt className="flex items-center gap-2 font-medium text-[#637083]">
                      <FiClock className="h-4 w-4" /> Submitted
                    </dt>
                    <dd className="font-semibold text-[#061E35]">Today at 8:42 AM</dd>
                  </div>
                  <div className="grid grid-cols-[8.25rem_1fr] items-center gap-3 py-4 text-sm">
                    <dt className="flex items-center gap-2 font-medium text-[#637083]">
                      <FiShield className="h-4 w-4" /> Decision
                    </dt>
                    <dd className="font-semibold text-[#061E35]">Landlord review needed</dd>
                  </div>
                </dl>

                <div className="mt-1 flex items-center justify-between gap-4 bg-[#F0FDF4] px-4 py-3 text-sm text-[#14532D]">
                  <span className="font-semibold">Next: review request and contact a vendor</span>
                  <FiArrowRight className="h-4 w-4 flex-shrink-0" />
                </div>
                <p className="mt-3 text-center text-[11px] text-[#637083]">Illustrative pilot view · Final decisions remain with the landlord</p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <main>
        <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#15803D]">Where maintenance breaks down</p>
              <h2
                className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#061E35] sm:text-4xl"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                The request is not the hard part. The handoff is.
              </h2>
            </div>
            <div className="border-t border-[#B8C8D5]">
              {[
                ["01", "Scattered context", "Photos arrive by text, details live in email, and the property address gets repeated from memory."],
                ["02", "Unclear priority", "A true emergency and a cosmetic fix can sit side by side without enough context to choose the next move."],
                ["03", "Missing history", "Vendor notes, costs, and completion details disappear before the next recurring issue surfaces."],
              ].map(([number, title, body]) => (
                <div key={number} className="grid gap-3 border-b border-[#DCE6ED] py-6 sm:grid-cols-[3rem_11rem_1fr] sm:gap-5">
                  <span className="text-xs font-bold tracking-[0.18em] text-[#15803D]">{number}</span>
                  <h3 className="font-bold text-[#061E35]" style={{ fontFamily: '"Poppins", sans-serif' }}>{title}</h3>
                  <p className="text-sm leading-6 text-[#405A70]" style={{ fontFamily: '"Inter", sans-serif' }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="maintenance-workflow" className="scroll-mt-24 bg-[#061E35] px-4 py-20 text-white sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-300">From report to repair record</p>
              <h2
                className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl md:text-5xl"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                One request. Four clear handoffs.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/70" style={{ fontFamily: '"Inter", sans-serif' }}>
                Property Peace keeps the work moving without taking the decision away from the person responsible for the property.
              </p>
            </div>

            <ol className="mt-14 grid border-l border-white/20 md:grid-cols-4 md:border-l-0 md:border-t">
              {workflow.map((step, index) => (
                <li key={step.label} className="relative border-b border-white/15 px-6 py-7 md:border-b-0 md:border-r md:px-6 md:py-9 first:md:pl-0 last:md:border-r-0">
                  <span className="absolute -left-[7px] top-8 h-3 w-3 bg-green-400 md:-top-[7px] md:left-6 first:md:left-0" />
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-300">
                    {String(index + 1).padStart(2, "0")} · {step.label}
                  </p>
                  <h3 className="mt-4 text-lg font-bold" style={{ fontFamily: '"Poppins", sans-serif' }}>{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65" style={{ fontFamily: '"Inter", sans-serif' }}>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-[#F6F9FB] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-end gap-8 border-b border-[#B8C8D5] pb-10 lg:grid-cols-[1fr_0.8fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#15803D]">Responsible by design</p>
                <h2
                  className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#061E35] sm:text-4xl"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  Percy helps organize the intake. You stay in charge of the repair.
                </h2>
              </div>
              <p className="text-base leading-7 text-[#405A70]" style={{ fontFamily: '"Inter", sans-serif' }}>
                Maintenance can involve safety, habitability, access, and local legal duties. Assisted signals are useful context—not a substitute for your review or a qualified professional.
              </p>
            </div>

            <div className="grid md:grid-cols-2">
              <div className="border-b border-[#DCE6ED] py-10 md:border-b-0 md:border-r md:pr-12">
                <div className="flex items-center gap-3 text-[#15803D]">
                  <FiTool className="h-5 w-5" />
                  <p className="text-xs font-bold uppercase tracking-[0.18em]">Percy can help</p>
                </div>
                <ul className="mt-7 space-y-5">
                  {["Organize request details and maintenance context", "Surface language that may deserve faster attention", "Keep intake easier to scan across a growing portfolio"].map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-[#405A70]">
                      <FiCheck className="mt-1 h-4 w-4 flex-shrink-0 text-[#16A34A]" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="py-10 md:pl-12">
                <div className="flex items-center gap-3 text-[#061E35]">
                  <FiUserCheck className="h-5 w-5" />
                  <p className="text-xs font-bold uppercase tracking-[0.18em]">The landlord decides</p>
                </div>
                <ul className="mt-7 space-y-5">
                  {["Whether the situation is an emergency", "What response, access, and communication are appropriate", "Which qualified vendor to contact and when work is complete"].map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-[#405A70]">
                      <FiChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-[#061E35]" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#15803D]">A record that survives the repair</p>
              <h2
                className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#061E35] sm:text-4xl"
                style={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Keep the evidence, conversation, work, and cost connected.
              </h2>
            </div>

            <div className="mt-12 grid border-y border-[#B8C8D5] sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: FiCamera, title: "Photos and context", body: "See what the tenant reported before anyone arrives on-site." },
                { icon: FiMessageSquare, title: "Updates in one thread", body: "Keep repair communication with the request instead of personal texts." },
                { icon: FiUsers, title: "Vendor coordination", body: "Record who is handling the work and what still needs follow-up." },
                { icon: FiFileText, title: "Costs and history", body: "Leave a useful property record after the ticket is closed." },
              ].map(({ icon: Icon, title, body }, index) => (
                <div key={title} className={`py-8 sm:px-7 ${index % 2 === 0 ? "sm:border-r" : ""} ${index < 2 ? "border-b lg:border-b-0" : ""} lg:border-r lg:last:border-r-0 border-[#DCE6ED] first:sm:pl-0`}>
                  <Icon className="h-6 w-6 text-[#15803D]" />
                  <h3 className="mt-6 font-bold text-[#061E35]" style={{ fontFamily: '"Poppins", sans-serif' }}>{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#405A70]" style={{ fontFamily: '"Inter", sans-serif' }}>{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col justify-between gap-4 border border-[#DCE6ED] bg-[#F6F9FB] px-6 py-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <FiShield className="h-5 w-5 flex-shrink-0 text-[#15803D]" />
                <p className="text-sm font-semibold text-[#061E35]">Built for hands-on landlords managing 1–50 units.</p>
              </div>
              <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-bold text-[#15803D] hover:text-[#061E35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] focus-visible:ring-offset-4">
                Compare plans <FiArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-[#F6F9FB] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#15803D]">Connected workflows</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-[#061E35]" style={{ fontFamily: '"Poppins", sans-serif' }}>
                  Maintenance does not live alone.
                </h2>
              </div>
              <div className="border-t border-[#B8C8D5]">
                {relatedTools.map(({ href, label, description, icon: Icon }) => (
                  <Link key={href} href={href} className="group grid gap-4 border-b border-[#DCE6ED] py-6 transition-colors hover:bg-white sm:grid-cols-[2.5rem_12rem_1fr_1.5rem] sm:items-center sm:px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] focus-visible:ring-inset">
                    <Icon className="h-5 w-5 text-[#15803D]" />
                    <span className="font-bold text-[#061E35]" style={{ fontFamily: '"Poppins", sans-serif' }}>{label}</span>
                    <span className="text-sm leading-6 text-[#405A70]" style={{ fontFamily: '"Inter", sans-serif' }}>{description}</span>
                    <FiArrowRight className="h-4 w-4 text-[#637083] transition-transform group-hover:translate-x-1 motion-reduce:transform-none" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#15803D]">Straight answers</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-[#061E35] sm:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
                Percy Pilot maintenance FAQs
              </h2>
              <p className="mt-5 max-w-sm text-base leading-7 text-[#405A70]" style={{ fontFamily: '"Inter", sans-serif' }}>
                What the limited pilot can help with—and where landlord judgment still matters.
              </p>
            </div>
            <AIMaintenanceFAQ faqs={faqs} />
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
          <div className="relative mx-auto max-w-6xl overflow-hidden bg-[#061E35] px-6 py-14 text-center text-white sm:px-10 sm:py-16">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.2),transparent_62%)]" />
            <div className="relative mx-auto max-w-3xl">
              <FiTool className="mx-auto h-7 w-7 text-green-300" />
              <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
                Give every repair a clear place to go.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/70" style={{ fontFamily: '"Inter", sans-serif' }}>
                Start with organized maintenance tracking today. Percy-assisted tools are available separately through the limited pilot.
              </p>
              <Link
                href="https://app.propertypeace.io/register"
                className="mt-8 inline-flex min-h-[54px] items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 px-8 py-3.5 font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#061E35] motion-reduce:transform-none"
                style={{ fontFamily: '"Inter", sans-serif' }}
              >
                Start free <FiArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
