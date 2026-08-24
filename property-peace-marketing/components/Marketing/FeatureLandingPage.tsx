import Link from "next/link";
import type { IconType } from "react-icons";
import { FiArrowRight, FiCheck, FiChevronRight, FiHelpCircle, FiZap } from "react-icons/fi";
import StructuredData from "@/components/SEO/StructuredData";
import { webPageSchema } from "@/lib/structured-data";

export type FeatureLandingLink = {
  label: string;
  href: string;
  description?: string;
};

export type FeatureLandingFAQ = {
  question: string;
  answer: string;
};

export type FeatureLandingStep = {
  title: string;
  body: string;
};

export type FeatureLandingProps = {
  icon: IconType;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta?: string;
  canonicalPath: string;
  categoryLabel: string;
  categoryHref: string;
  trustItems: string[];
  problemTitle: string;
  problemPoints: string[];
  solutionTitle: string;
  solutionPoints: string[];
  steps: FeatureLandingStep[];
  featureTitle: string;
  features: string[];
  outcomeTitle: string;
  outcomes: string[];
  related: FeatureLandingLink[];
  faqs: FeatureLandingFAQ[];
  disclaimer?: string;
};

const siteUrl = "https://propertypeace.io";

export default function FeatureLandingPage({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta = "View pricing",
  canonicalPath,
  categoryLabel,
  categoryHref,
  trustItems,
  problemTitle,
  problemPoints,
  solutionTitle,
  solutionPoints,
  steps,
  featureTitle,
  features,
  outcomeTitle,
  outcomes,
  related,
  faqs,
  disclaimer,
}: FeatureLandingProps) {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Features", item: `${siteUrl}/features` },
      { "@type": "ListItem", position: 3, name: categoryLabel, item: `${siteUrl}${categoryHref}` },
      { "@type": "ListItem", position: 4, name: title, item: `${siteUrl}${canonicalPath}` },
    ],
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `Property Peace ${title}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${siteUrl}${canonicalPath}`,
    description: subtitle,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Built for hands-on landlords with 1–50 units. Start free; premium plans available.",
    },
    featureList: features,
  };

  const pageSchema = webPageSchema({
    path: canonicalPath,
    name: `Property Peace ${title}`,
    description: subtitle,
  });

  const faqSchema = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }
    : null;

  const faqHeading = canonicalPath === '/rent/rent-reporting'
    ? 'Frequently Asked Questions About Rent Reporting'
    : 'Feature FAQs';

  return (
    <div className="min-h-screen bg-white">
      <StructuredData data={pageSchema} />
      <StructuredData data={breadcrumbSchema} />
      <StructuredData data={softwareSchema} />
      {faqSchema && <StructuredData data={faqSchema} />}

      <section
        data-marketing-hero-theme="light"
        className="relative overflow-hidden bg-white px-4 pb-16 pt-32 sm:px-6 sm:pb-20 sm:pt-36 lg:px-8"
      >
        <div className="absolute left-1/2 top-0 h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-green-200/50 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <Link href={categoryHref} className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-[#637083] transition-colors hover:text-[#16A34A]" style={{ fontFamily: '"Inter", sans-serif' }}>
            Features <FiChevronRight className="h-4 w-4" /> {categoryLabel}
          </Link>

          <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-[#DCE6ED] bg-green-50 px-3.5 py-2 text-[13px] font-bold leading-snug text-[#16A34A] shadow-sm shadow-slate-950/20 backdrop-blur-sm sm:px-4 sm:text-sm" style={{ fontFamily: '"Inter", sans-serif' }}>
                <Icon className="h-4 w-4 text-[#16A34A]" /> {eyebrow}
              </div>
              <h1 className="mb-5 max-w-3xl text-[2.35rem] font-bold leading-[1.08] text-[#061E35] sm:text-5xl md:text-6xl" style={{ fontFamily: '"Poppins", sans-serif' }}>{title}</h1>
              <p className="mb-7 max-w-2xl text-[17px] leading-relaxed text-[#405A70] md:text-xl" style={{ fontFamily: '"Inter", sans-serif' }}>{subtitle}</p>
              <div className="grid max-w-[22rem] grid-cols-2 gap-2.5 sm:flex sm:max-w-none sm:gap-3">
                <Link href="https://app.propertypeace.io/register" className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700 sm:min-h-[56px] rounded-none sm:px-8 sm:text-base" style={{ fontFamily: '"Inter", sans-serif' }}>
                  {primaryCta} <FiArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/pricing" className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-none border border-[#DCE6ED] bg-white px-4 py-3 text-sm font-semibold text-[#061E35] shadow-sm shadow-slate-950/20 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#16A34A] sm:min-h-[56px] rounded-none sm:px-8 sm:text-base" style={{ fontFamily: '"Inter", sans-serif' }}>
                  {secondaryCta}
                </Link>
              </div>
              <div className="mt-7 grid max-w-[23rem] grid-cols-2 gap-2.5 text-[13px] font-medium text-[#405A70] sm:flex sm:max-w-none sm:flex-wrap sm:gap-3 sm:text-sm" style={{ fontFamily: '"Inter", sans-serif' }}>
                {trustItems.map((item) => (
                  <span key={item} className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-[#DCE6ED] bg-white px-3 py-2 leading-snug shadow-sm shadow-slate-950/20 backdrop-blur-sm sm:min-h-0 sm:rounded-full sm:py-1.5">
                    <FiCheck className="h-4 w-4 text-[#16A34A]" /> {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-2xl backdrop-blur">
              <div className="overflow-hidden rounded-[1.4rem] bg-white shadow-xl">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                  <span className="ml-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Property Peace</span>
                </div>
                <div className="p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-green-600">Feature workflow</p>
                      <h2 className="text-xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>{featureTitle}</h2>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#061e35]">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {steps.map((step, index) => (
                      <div key={step.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="mb-1 flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">{index + 1}</span>
                          <h3 className="font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>{step.title}</h3>
                        </div>
                        <p className="pl-10 text-sm leading-relaxed text-slate-600" style={{ fontFamily: '"Inter", sans-serif' }}>{step.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-16">
          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-red-100 bg-red-50/60 p-8">
              <h2 className="mb-5 text-2xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>{problemTitle}</h2>
              <ul className="space-y-4">
                {problemPoints.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-700" style={{ fontFamily: '"Inter", sans-serif' }}>
                    <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-400" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-green-100 bg-green-50/60 p-8">
              <h2 className="mb-5 text-2xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>{solutionTitle}</h2>
              <ul className="space-y-4">
                {solutionPoints.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-700" style={{ fontFamily: '"Inter", sans-serif' }}>
                    <FiCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <div className="mb-10 text-center">
              <p className="mb-2 text-sm font-bold uppercase tracking-widest text-green-600" style={{ fontFamily: '"Inter", sans-serif' }}>Everything included</p>
              <h2 className="text-3xl font-bold text-primary-main md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>{featureTitle}</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature} className="rounded-2xl border border-slate-100 bg-[#f8fafc] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-green-200 hover:bg-white hover:shadow-lg">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-green-100">
                    <FiCheck className="h-4 w-4 text-green-700" />
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-slate-700" style={{ fontFamily: '"Inter", sans-serif' }}>{feature}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-green-50/40 p-8 md:p-12">
            <div className="grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="mb-2 text-sm font-bold uppercase tracking-widest text-green-600" style={{ fontFamily: '"Inter", sans-serif' }}>Why it matters</p>
                <h2 className="text-3xl font-bold text-primary-main md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>{outcomeTitle}</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {outcomes.map((outcome) => (
                  <div key={outcome} className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                    <p className="text-sm leading-relaxed text-slate-600" style={{ fontFamily: '"Inter", sans-serif' }}>{outcome}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-8 text-center">
              <p className="mb-2 text-sm font-bold uppercase tracking-widest text-green-600" style={{ fontFamily: '"Inter", sans-serif' }}>Related landlord tools</p>
              <h2 className="text-3xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>Keep building your workflow</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {related.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-none border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-green-200 hover:shadow-lg">
                  <h3 className="mb-2 flex items-center justify-between gap-3 font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>
                    <span>{item.label}</span>
                    <FiArrowRight className="h-4 w-4 text-green-600" />
                  </h3>
                  {item.description && <p className="text-sm leading-relaxed text-slate-500" style={{ fontFamily: '"Inter", sans-serif' }}>{item.description}</p>}
                </Link>
              ))}
            </div>
          </section>

          {faqs.length > 0 && (
            <section className="mx-auto max-w-4xl">
              <div className="mb-8 text-center">
                <FiHelpCircle className="mx-auto mb-3 h-8 w-8 text-green-600" />
                <h2 className="text-3xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>{faqHeading}</h2>
              </div>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                {faqs.map((faq) => (
                  <div key={faq.question} className="p-6">
                    <h3 className="mb-2 font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>{faq.question}</h3>
                    <p className="text-sm leading-relaxed text-slate-600" style={{ fontFamily: '"Inter", sans-serif' }}>{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-3xl bg-[#061e35] p-10 text-center shadow-2xl md:p-14">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <FiZap className="h-7 w-7 text-white" />
            </div>
            <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Ready to make this easier?</h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-white/70" style={{ fontFamily: '"Inter", sans-serif' }}>Start free with Property Peace. No credit card required, and built for independent landlords with 1–50 units.</p>
            <Link href="https://app.propertypeace.io/register" className="inline-flex items-center justify-center gap-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-9 py-4 font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700" style={{ fontFamily: '"Inter", sans-serif' }}>
              {primaryCta} <FiArrowRight className="h-4 w-4" />
            </Link>
            {disclaimer && <p className="mx-auto mt-5 max-w-2xl text-xs leading-relaxed text-white/60" style={{ fontFamily: '"Inter", sans-serif' }}>{disclaimer}</p>}
          </section>
        </div>
      </main>
    </div>
  );
}
