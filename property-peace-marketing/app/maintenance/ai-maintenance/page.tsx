import type { Metadata } from "next";
import Link from "next/link";
import { applyOttoSeo } from '@/lib/otto-seo';
import {
  FiCheck,
  FiArrowRight,
  FiTool,
  FiCamera,
  FiUsers,
  FiDollarSign,
} from "react-icons/fi";
import StructuredData from "@/components/SEO/StructuredData";
import AIMaintenanceFAQ from "./AIMaintenanceFAQ";

export const metadata: Metadata = applyOttoSeo('/maintenance/ai-maintenance/', {
  title: "AI Maintenance Records Review for Landlords | Property Peace",
  description:
    "Rental property maintenance software for requests, work orders, photos, vendors, and costs. In the limited Percy Pilot, review supported maintenance records by status, priority, and age signals.",
  keywords:
    "Percy Pilot maintenance management, rental property maintenance software, landlord maintenance tracking, work order tracking, tenant maintenance requests, maintenance ticket software, work order management system, software for small landlords, landlord expense software",
  alternates: { canonical: "/maintenance/ai-maintenance" },
  openGraph: {
    title: "AI Maintenance Records Review for Landlords | Property Peace",
    description:
      "Rental property maintenance software with landlord-run work order and vendor tracking, plus read-only review of supported records in the limited Percy Pilot.",
    type: "website",
  },
});

const faqSchema = [
  {
    question: "What is Percy Pilot maintenance management software?",
    answer:
      "Property Peace provides the maintenance system landlords use to record requests, set priorities, update statuses, assign vendors, and track costs. In the limited Percy Pilot, Percy can review current supported maintenance records and organize recorded status, priority, and age signals. Percy is read-only: it does not diagnose repairs, dispatch vendors, update requests, or resolve emergencies.",
  },
  {
    question: "How does Property Peace prioritize work orders?",
    answer:
      "Landlords review each request and set its priority in the Property Peace work order workflow. In the limited Percy Pilot, Percy can organize supported current records by their recorded priority, status, and age so the landlord can decide what to handle first. Percy does not diagnose an issue or change its priority.",
  },
  {
    question: "Can tenants upload photos?",
    answer:
      "Yes. Tenants can submit maintenance requests with photo uploads through the tenant portal. Photos help you and vendors understand the issue before showing up, reduce back-and-forth, and create a clear record for each repair. It's part of our maintenance ticket software designed for small landlords.",
  },
  {
    question: "Does it track vendor payments?",
    answer:
      "Yes. You can assign vendors to work orders and track costs per repair. Property Peace helps you see what you're spending per property and per request, so you can manage budgets and coordinate vendor follow-ups. This supports better landlord maintenance management and expense tracking.",
  },
  {
    question: "Is this software good for small landlords?",
    answer:
      "Yes. Property Peace is built for small landlords (1–50 units), including DIY landlords, growing portfolios, and multi-family owners. You get rental property maintenance software that's easy to use without enterprise complexity. No spreadsheets, no lost tenant messages—just one place for maintenance requests, work order tracking, and vendor coordination.",
  },
  {
    question: "Can I export maintenance records for taxes?",
    answer:
      "Yes. You can track every repair cost and export reports for tax reporting. Automatically log maintenance expenses per property for Schedule E filing and landlord expense software needs. Rental tax tracking and schedule E expense tracking are built in so you're ready at tax time.",
  },
];

export default function AIMaintenancePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 bg-primary-main/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FiTool className="w-8 h-8 text-primary-main" />
          </div>
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-main mb-4"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            AI Maintenance Records Review for Landlords
          </h1>
          <p
            className="text-xl md:text-2xl font-semibold text-primary-main mb-4 max-w-2xl mx-auto"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Never miss a repair again.
          </p>
          <p
            className="text-lg text-[#737373] mb-4 max-w-2xl mx-auto"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Rental property maintenance software where landlords track tenant requests, work orders, photos, vendors, and costs—all in one place.
          </p>
          <p
            className="text-base text-[#737373] mb-8 max-w-xl mx-auto"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Stop losing requests in texts and spreadsheets. Get started free.
          </p>
          <Link
            href="https://app.propertypeace.io/register"
            className="inline-flex items-center space-x-2 px-8 py-4 bg-primary-main text-white rounded-none font-semibold hover:bg-primary-hover transition-colors"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            <span>Get Started</span>
            <FiArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary-main">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-white mb-8 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            The Problem with Managing Rental Property Maintenance
          </h2>
          <div className="space-y-4 text-lg" style={{ fontFamily: '"Inter", sans-serif' }}>
            <p style={{ color: "rgba(255,255,255,0.95)" }}>
              <strong style={{ color: "#ffffff" }}>Lost tenant messages</strong>—requests buried in text threads or email.
              <strong style={{ color: "#ffffff" }}> Text message chaos</strong>—no single place to see what’s open, what’s done, or who’s responsible.
              <strong style={{ color: "#ffffff" }}> Spreadsheet tracking</strong>—manual updates that fall behind the moment you’re busy.
              Sound familiar? Landlord maintenance management gets harder when you can’t tell emergencies from cosmetic fixes, and when <strong style={{ color: "#ffffff" }}>vendor coordination</strong> means chasing people across multiple apps.
            </p>
            <p style={{ color: "rgba(255,255,255,0.95)" }}>
              Property Peace is rental property maintenance software that fixes this. Landlords run tenant requests, work order tracking, and vendor coordination in one place. In the limited Percy Pilot, Percy reviews supported current records by status, priority, and age signals without changing them.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works (Expanded Blocks) */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#F5F5F5]">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-12 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            How It Works
          </h2>
          <div className="space-y-10">
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-[#E5E5E5]">
              <h3 className="text-xl font-bold text-primary-main mb-3" style={{ fontFamily: '"Poppins", sans-serif' }}>
                Review Supported Maintenance Records with Percy
              </h3>
              <p className="text-[#737373] leading-relaxed mb-3" style={{ fontFamily: '"Inter", sans-serif' }}>
                Tenants submit requests through the Property Peace portal, and landlords record priority, status, photos, and vendor details in the maintenance workflow. In the limited Percy Pilot, Percy can review supported current records and organize their recorded status, priority, and age signals.
              </p>
              <p className="text-[#737373] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                Percy does not diagnose repairs. Percy does not route work or dispatch vendors. Percy does not update requests. The landlord reviews the records, decides urgency, and determines what happens next.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-[#E5E5E5]">
              <h3 className="text-xl font-bold text-primary-main mb-3" style={{ fontFamily: '"Poppins", sans-serif' }}>
                Smart Work Order Prioritization
              </h3>
              <p className="text-[#737373] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                Emergencies surface first. Non-urgent and cosmetic items stay organized in a queue. You decide what to tackle when, with full visibility so nothing slips. Work order tracking that actually reflects how you run your rentals.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-[#E5E5E5]">
              <h3 className="text-xl font-bold text-primary-main mb-3" style={{ fontFamily: '"Poppins", sans-serif' }}>
                Status Tracking and Follow-Up Review
              </h3>
              <p className="text-[#737373] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                Use Property Peace to track each request from submission to completion and review which follow-ups are due. Percy notifications and maintenance drafts are planned; today, landlords open the records and handle vendor and tenant follow-up themselves.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-[#E5E5E5]">
              <h3 className="text-xl font-bold text-primary-main mb-3" style={{ fontFamily: '"Poppins", sans-serif' }}>
                Photo Uploads for Clear Repair Documentation
              </h3>
              <p className="text-[#737373] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                Tenants can attach photos to every request. You and your vendors see exactly what’s wrong before showing up. Better diagnosis, fewer callbacks, and a clear paper trail for each repair—all part of your rental property maintenance software.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-[#E5E5E5]">
              <h3 className="text-xl font-bold text-primary-main mb-3" style={{ fontFamily: '"Poppins", sans-serif' }}>
                Vendor and Cost Tracking
              </h3>
              <p className="text-[#737373] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                Assign vendors to work orders and track costs per repair and per property. See where your money goes, coordinate follow-ups, and keep landlord maintenance management and expense tracking in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary-main">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-white mb-8 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Who This Is For
          </h2>
          <p className="text-xl font-semibold text-white mb-6 text-center" style={{ fontFamily: '"Poppins", sans-serif' }}>
            Built for Small Landlords (1–50 Units)
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {["DIY landlords", "Growing portfolios", "Property managers", "Multi-family owners"].map((item, i) => (
              <div key={i} className="flex items-center space-x-3">
                <FiCheck className="w-5 h-5 text-white flex-shrink-0" />
                <span className="text-white" style={{ fontFamily: '"Inter", sans-serif' }}>{item}</span>
              </div>
            ))}
          </div>
          <p className="text-lg mt-8 text-center max-w-2xl mx-auto" style={{ fontFamily: '"Inter", sans-serif', color: "rgba(255,255,255,0.9)" }}>
            Whether you need software for small landlords, rental management software for 10 units, or simple landlord tools that scale, Property Peace provides landlord-run maintenance workflows plus limited, read-only Percy Pilot review of supported records.
          </p>
        </div>
      </section>

      {/* Feature Deep Dive Blocks */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#F5F5F5]">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-12 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Feature Deep Dive
          </h2>
          <div className="space-y-10">
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-[#E5E5E5] flex flex-col sm:flex-row gap-6 items-start">
              <div className="w-14 h-14 bg-primary-main/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <FiCamera className="w-7 h-7 text-primary-main" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary-main mb-2" style={{ fontFamily: '"Poppins", sans-serif' }}>
                  Photo Uploads for Every Request
                </h3>
                <p className="text-[#737373] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                  Tenants attach photos when they submit a request. You and vendors see the issue before stepping on-site—faster diagnosis, fewer repeat visits, and a clear record for every repair. Essential for maintenance ticket software and work order tracking that actually works.
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-[#E5E5E5] flex flex-col sm:flex-row gap-6 items-start">
              <div className="w-14 h-14 bg-primary-main/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <FiUsers className="w-7 h-7 text-primary-main" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary-main mb-2" style={{ fontFamily: '"Poppins", sans-serif' }}>
                  Vendor Tracking and Coordination
                </h3>
                <p className="text-[#737373] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                  Assign vendors to work orders and keep all maintenance conversations in one place. See who’s doing what, when, and avoid the back-and-forth that slows down landlord maintenance management. One system for tenant maintenance requests and vendor coordination.
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-[#E5E5E5] flex flex-col sm:flex-row gap-6 items-start">
              <div className="w-14 h-14 bg-primary-main/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <FiDollarSign className="w-7 h-7 text-primary-main" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary-main mb-2" style={{ fontFamily: '"Poppins", sans-serif' }}>
                  Track Every Repair Cost for Tax Reporting
                </h3>
                <p className="text-[#737373] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                  Automatically log maintenance expenses per property and export reports for Schedule E filing. Rental tax tracking and schedule E expense tracking in one place—landlord expense software that keeps you ready at tax time without spreadsheets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Internal Linking + CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white border-t border-[#E5E5E5]">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-2xl md:text-3xl font-bold text-primary-main mb-6 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            More Ways Property Peace Helps Landlords
          </h2>
          <p className="text-[#737373] text-center mb-8 max-w-2xl mx-auto" style={{ fontFamily: '"Inter", sans-serif' }}>
            Explore related Property Peace tools to see how maintenance, rent, accounting, and landlord workflows connect.
          </p>
          <ul className="flex flex-wrap justify-center gap-4 text-center">
            <li>
              <Link href="/pricing" className="text-primary-main hover:text-primary-hover font-medium underline" style={{ fontFamily: '"Inter", sans-serif' }}>
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/features/maintenance-tracking" className="text-primary-main hover:text-primary-hover font-medium underline" style={{ fontFamily: '"Inter", sans-serif' }}>
                Tenant portal & maintenance tracking
              </Link>
            </li>
            <li>
              <Link href="/features/rent-collection" className="text-primary-main hover:text-primary-hover font-medium underline" style={{ fontFamily: '"Inter", sans-serif' }}>
                Rent collection
              </Link>
            </li>
            <li>
              <Link href="/rent/expense-tracking" className="text-primary-main hover:text-primary-hover font-medium underline" style={{ fontFamily: '"Inter", sans-serif' }}>
                Expense tracking
              </Link>
            </li>
            <li>
              <Link href="/blog" className="text-primary-main hover:text-primary-hover font-medium underline" style={{ fontFamily: '"Inter", sans-serif' }}>
                Blog
              </Link>
            </li>
            <li>
              <Link href="/blog/how-to-handle-maintenance-requests-like-pro" className="text-primary-main hover:text-primary-hover font-medium underline" style={{ fontFamily: '"Inter", sans-serif' }}>
                How to handle maintenance requests like a pro
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold text-primary-main mb-10 text-center"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Frequently Asked Questions
          </h2>
          <AIMaintenanceFAQ faqs={faqSchema} />
          <StructuredData
            data={{
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqSchema.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.answer,
                },
              })),
            }}
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary-main text-center">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-2xl md:text-3xl font-bold text-white mb-4"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Ready to Stop Losing Maintenance Requests?
          </h2>
          <p className="text-white/90 mb-6 max-w-xl mx-auto" style={{ fontFamily: '"Inter", sans-serif' }}>
            Use Property Peace to keep work orders under control. The limited Percy Pilot can review supported maintenance records, while every decision and update stays with the landlord.
          </p>
          <Link
            href="https://app.propertypeace.io/register"
            className="inline-flex items-center space-x-2 px-8 py-4 bg-white text-primary-main rounded-none font-semibold hover:bg-white/90 transition-colors"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            <span>Get Started</span>
            <FiArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
