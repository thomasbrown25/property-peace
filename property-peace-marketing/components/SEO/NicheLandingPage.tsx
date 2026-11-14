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
    <div className="min-h-screen bg-brand-forest text-white">
      {pageStructuredData && <StructuredData data={pageStructuredData} />}
      <main>
        <section
          data-marketing-hero-theme="light"
          className="relative overflow-hidden bg-brand-forest px-4 pb-20 pt-32 text-white sm:px-6 sm:pb-24 sm:pt-36 lg:px-8"
        >
          <div
            data-marketing-hero-layout="split"
            className="relative z-10 mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14"
          >
            <div className="text-center lg:text-left">
              <p data-marketing-hero-eyebrow="true" className="mb-5 inline-flex max-w-full items-center justify-center rounded-full border border-[var(--brand-border)] bg-brand-surface px-3.5 py-2 text-center text-[13px] font-semibold leading-snug text-brand-teal shadow-sm shadow-[color:color-mix(in_srgb,var(--brand-forest)_20%,transparent)] sm:px-4 sm:text-sm">
                {config.eyebrow}
              </p>
              <h1 className="mx-auto max-w-4xl text-[2.35rem] font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl lg:mx-0" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>
                {config.title}
              </h1>
              <p className="mx-auto mt-5 max-w-3xl text-[17px] font-medium leading-8 text-brand-ivory md:text-xl lg:mx-0" style={{ fontFamily: '"Inter", sans-serif' }}>
                {config.description}
              </p>
              <div className="mx-auto mt-7 grid max-w-[22rem] grid-cols-2 gap-2.5 sm:flex sm:max-w-none sm:items-center sm:justify-center sm:gap-3 lg:mx-0 lg:justify-start">
                <Link href="https://app.propertypeace.io/register" className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-none bg-gradient-to-r from-brand-teal to-brand-teal px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[color:color-mix(in_srgb,var(--brand-forest)_25%,transparent)] transition hover:-translate-y-0.5 hover:from-brand-teal hover:to-brand-teal-hover hover:shadow-[0_10px_24px_rgba(36,117,104,0.25)] sm:min-h-[56px] sm:px-7 sm:text-base">
                  {config.primaryCta ?? 'Start free'}
                  <FiArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </Link>
                <Link href="/pricing" className="inline-flex min-h-[50px] items-center justify-center rounded-none border border-[var(--brand-border)] bg-brand-surface px-4 py-3 text-sm font-bold text-brand-forest shadow-sm shadow-[color:color-mix(in_srgb,var(--brand-forest)_20%,transparent)] transition hover:bg-brand-ivory sm:min-h-[56px] sm:px-7 sm:text-base">
                  {config.secondaryCta ?? 'View pricing'}
                </Link>
              </div>
            </div>
            <div
              data-marketing-hero-proof="artifact"
              className="border border-[var(--brand-border)] bg-brand-surface p-6 shadow-[0_24px_60px_rgba(16,44,41,0.10)] sm:p-8"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {config.proofPoints.map((point) => (
                <span key={point} className="inline-flex min-h-[52px] items-center gap-3 border border-[var(--brand-border)] bg-brand-ivory px-4 py-3 text-left text-sm font-semibold leading-snug text-brand-slate">
                  <FiCheck className="h-4 w-4 flex-shrink-0 text-brand-teal" />
                  {point}
                </span>
              ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-brand-mint">Built for your niche</p>
              <h2 className="text-3xl font-extrabold text-white md:text-4xl" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>
                {config.painTitle}
              </h2>
              <p className="mt-4 text-lg leading-8 text-brand-ivory" style={{ fontFamily: '"Inter", sans-serif' }}>
                {config.painIntro}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {config.painPoints.map((point) => (
                <div key={point} className="rounded-2xl border border-[var(--brand-border)] bg-brand-ivory p-5">
                  <FiCheck className="mb-3 h-5 w-5 text-brand-teal" />
                  <p className="font-semibold leading-7 text-primary-main">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-brand-forest px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-extrabold text-white md:text-4xl" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>
                {config.featureTitle}
              </h2>
              <p className="mt-4 text-lg text-brand-ivory">Everything is organized around rent, tenants, maintenance, leases, expenses, and decisions small landlords make every week.</p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {config.features.map((feature, index) => {
                const Icon = icons[index % icons.length];
                return (
                  <article key={feature.title} className="rounded-3xl border border-[var(--brand-border)] bg-brand-surface p-6 shadow-sm">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-mint text-brand-teal">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-extrabold text-primary-main">{feature.title}</h3>
                    <p className="mt-3 leading-7 text-brand-slate">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-[2rem] bg-brand-forest p-8 text-white md:p-12">
            <div className="grid gap-8 md:grid-cols-[0.85fr_1.15fr] md:items-center">
              <div>
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-brand-mint">How it works</p>
                <h2 className="text-3xl font-extrabold md:text-4xl" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>{config.workflowTitle}</h2>
              </div>
              <ol className="space-y-4">
                {config.workflowSteps.map((step, index) => (
                  <li key={step} className="flex gap-4 rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/10">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-teal text-sm font-bold">{index + 1}</span>
                    <span className="leading-7 text-white/[0.90]">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="bg-brand-forest px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-3xl font-extrabold text-white md:text-4xl" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>
              Questions landlords ask before switching
            </h2>
            <div className="mt-10 space-y-4">
              {config.faq.map((item) => (
                <details key={item.question} className="group rounded-2xl border border-[var(--brand-border)] bg-brand-surface p-6 shadow-sm">
                  <summary className="cursor-pointer list-none text-lg font-bold text-primary-main">
                    {item.question}
                  </summary>
                  <p className="mt-3 leading-7 text-brand-slate">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl text-center">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-brand-ivory">Related landlord software pages</p>
            <div className="flex flex-wrap justify-center gap-3">
              {config.relatedLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-none border border-white/30 px-4 py-2 font-semibold text-white transition hover:border-brand-mint hover:bg-white/10">
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
