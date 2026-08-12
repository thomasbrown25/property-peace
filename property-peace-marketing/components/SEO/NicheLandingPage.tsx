import Link from 'next/link';
import { FiArrowRight, FiCheck, FiFileText, FiMessageSquare, FiTool, FiTrendingUp } from 'react-icons/fi';
import StructuredData from '@/components/SEO/StructuredData';
import { webPageSchema } from '@/lib/structured-data';

export type LandingFaq = {
  question: string;
  answer: string;
};

export type RelatedLandingLink = {
  href: string;
  label: string;
};

export type NicheLandingPageConfig = {
  eyebrow: string;
  title: string;
  description: string;
  proofPoints: string[];
  primaryCta?: string;
  secondaryCta?: string;
  painTitle: string;
  painIntro: string;
  painPoints: string[];
  featureTitle: string;
  features: Array<{ title: string; description: string }>;
  workflowTitle: string;
  workflowSteps: string[];
  faq: LandingFaq[];
  relatedLinks: RelatedLandingLink[];
  canonicalPath?: string;
  structuredName: string;
  structuredDescription: string;
  assistantBridge?: {
    title: string;
    description: string;
    note?: string;
  };
};

const icons = [FiFileText, FiTool, FiMessageSquare, FiTrendingUp];

export default function NicheLandingPage({ config }: { config: NicheLandingPageConfig }) {
  const softwareStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: config.structuredName,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: config.structuredDescription,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free for up to 5 units. Premium plan available for unlimited units and advanced tools.',
    },
    audience: {
      '@type': 'Audience',
      audienceType: 'Small landlords and independent rental owners with 1–50 units',
    },
    featureList: config.features.map((feature) => feature.title),
  };

  const pageStructuredData = config.canonicalPath
    ? webPageSchema({
        path: config.canonicalPath,
        name: config.structuredName,
        description: config.structuredDescription,
      })
    : null;

  const faqStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: config.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-white">
      {pageStructuredData && <StructuredData data={pageStructuredData} />}
      <main>
        <section className="relative overflow-hidden bg-[#061e35] px-4 py-16 text-white sm:px-6 sm:py-24 lg:px-8">
          <div className="relative z-10 mx-auto max-w-5xl text-center">
            <p className="mb-5 inline-flex max-w-full items-center justify-center rounded-full border border-white/20 bg-white/[0.12] px-3.5 py-2 text-center text-[13px] font-semibold leading-snug text-blue-100 shadow-sm shadow-blue-950/20 backdrop-blur-sm sm:px-4 sm:text-sm">
              {config.eyebrow}
            </p>
            <h1 className="mx-auto max-w-4xl text-[2.35rem] font-bold leading-[1.08] tracking-tight text-white drop-shadow-sm sm:text-5xl md:text-6xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
              {config.title}
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-[17px] font-medium leading-8 text-white/[0.86] md:text-xl" style={{ fontFamily: '"Inter", sans-serif' }}>
              {config.description}
            </p>
            <div className="mx-auto mt-7 grid max-w-[22rem] grid-cols-2 gap-2.5 sm:flex sm:max-w-none sm:items-center sm:justify-center sm:gap-3">
              <Link href="https://app.propertypeace.io/register" className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/25 transition hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700 hover:shadow-[0_10px_24px_rgba(34,197,94,0.25)] sm:min-h-[56px] rounded-none sm:px-7 sm:text-base">
                {config.primaryCta ?? 'Start free'}
                <FiArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <Link href="/pricing" className="inline-flex min-h-[50px] items-center justify-center rounded-none border border-white/25 bg-white/[0.12] px-4 py-3 text-sm font-bold text-white shadow-sm shadow-blue-950/20 backdrop-blur-sm transition hover:bg-white/[0.16] sm:min-h-[56px] rounded-none sm:px-7 sm:text-base">
                {config.secondaryCta ?? 'View pricing'}
              </Link>
            </div>
            <div className="mx-auto mt-7 grid max-w-[23rem] grid-cols-2 gap-2.5 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-3">
              {config.proofPoints.map((point) => (
                <span key={point} className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.105] px-3 py-2 text-left text-[13px] font-semibold leading-snug text-white/[0.90] shadow-sm shadow-blue-950/20 backdrop-blur-sm sm:min-h-0 sm:rounded-full sm:px-4 sm:text-sm">
                  <FiCheck className="h-4 w-4 flex-shrink-0 text-blue-200" />
                  {point}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Built for your niche</p>
              <h2 className="text-3xl font-bold text-primary-main md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
                {config.painTitle}
              </h2>
              <p className="mt-4 text-lg leading-8 text-[#5f6b77]" style={{ fontFamily: '"Inter", sans-serif' }}>
                {config.painIntro}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {config.painPoints.map((point) => (
                <div key={point} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <FiCheck className="mb-3 h-5 w-5 text-blue-600" />
                  <p className="font-semibold leading-7 text-primary-main">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f7f9fc] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold text-primary-main md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
                {config.featureTitle}
              </h2>
              <p className="mt-4 text-lg text-[#5f6b77]">Everything is organized around rent, tenants, maintenance, leases, expenses, and decisions small landlords make every week.</p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {config.features.map((feature, index) => {
                const Icon = icons[index % icons.length];
                return (
                  <article key={feature.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold text-primary-main">{feature.title}</h3>
                    <p className="mt-3 leading-7 text-[#637083]">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-[2rem] bg-[#061e35] p-8 text-white md:p-12">
            <div className="grid gap-8 md:grid-cols-[0.85fr_1.15fr] md:items-center">
              <div>
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-blue-200">How it works</p>
                <h2 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>{config.workflowTitle}</h2>
              </div>
              <ol className="space-y-4">
                {config.workflowSteps.map((step, index) => (
                  <li key={step} className="flex gap-4 rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/10">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold">{index + 1}</span>
                    <span className="leading-7 text-white/[0.90]">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {config.assistantBridge && (
          <section className="border-y border-slate-200 bg-white px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl border-l-4 border-blue-600 bg-blue-50/60 p-6 md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Percy Pilot</p>
              <h2 className="mt-3 text-2xl font-bold text-primary-main md:text-3xl">{config.assistantBridge.title}</h2>
              <p className="mt-3 leading-7 text-[#405a70]">{config.assistantBridge.description}</p>
              {config.assistantBridge.note && <p className="mt-3 text-sm leading-6 text-[#637083]">{config.assistantBridge.note}</p>}
            </div>
          </section>
        )}

        <section className="bg-[#f7f9fc] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-3xl font-bold text-primary-main md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
              Questions landlords ask before switching
            </h2>
            <div className="mt-10 space-y-4">
              {config.faq.map((item) => (
                <details key={item.question} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <summary className="cursor-pointer list-none text-lg font-bold text-primary-main">
                    {item.question}
                  </summary>
                  <p className="mt-3 leading-7 text-[#637083]">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl text-center">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#637083]">Related landlord software pages</p>
            <div className="flex flex-wrap justify-center gap-3">
              {config.relatedLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-none border border-slate-200 px-4 py-2 font-semibold text-blue-600 transition hover:border-blue-200 hover:bg-blue-50">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <StructuredData data={softwareStructuredData} />
      <StructuredData data={faqStructuredData} />
    </div>
  );
}
