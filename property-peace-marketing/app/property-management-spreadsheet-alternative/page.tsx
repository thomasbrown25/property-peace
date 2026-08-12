import type { Metadata } from 'next';
import NicheLandingPage, { type NicheLandingPageConfig } from '@/components/SEO/NicheLandingPage';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/property-management-spreadsheet-alternative/', {
  title: 'Property Management Spreadsheet Alternative | Property Peace',
  description: 'Replace rental spreadsheets with structured rent, tenant, lease, maintenance, expense, and document records, plus limited read-only Percy Pilot review. Start free.',
  alternates: { canonical: '/property-management-spreadsheet-alternative' },
  openGraph: { title: 'Property Management Spreadsheet Alternative | Property Peace', description: 'Replace rental spreadsheets with one dashboard for rent, tenants, leases, maintenance, expenses, documents, and Percy Pilot summaries. Built for small landlords. Start free.', type: 'website', url: '/property-management-spreadsheet-alternative' },
  twitter: { card: 'summary_large_image', title: 'Property Management Spreadsheet Alternative | Property Peace', description: 'Replace rental spreadsheets with one dashboard for rent, tenants, leases, maintenance, expenses, documents, and Percy Pilot summaries. Built for small landlords. Start free.' },
});

const config: NicheLandingPageConfig = {
  eyebrow: 'Property management spreadsheet alternative',
  title: 'Replace your rental spreadsheet with one calm landlord dashboard',
  description: 'Property Peace gives small landlords a structured place for rent, tenants, leases, maintenance, expenses, documents, reminders, and Percy Pilot summaries — without spreadsheet chaos.',
  proofPoints: ['Stop spreadsheet cleanup', 'Keep records connected', 'Built for small landlords', 'Start free'],
  painTitle: 'Spreadsheets are flexible until they become the problem',
  painIntro: 'A spreadsheet can track a few things. But rent, tenants, leases, documents, maintenance photos, reminders, and messages need relationships — not more columns.',
  painPoints: ['Connect tenants to units, leases, rent, and maintenance', 'Avoid duplicate tabs and stale formulas', 'Keep important documents and requests out of random folders', 'See portfolio status without rebuilding reports manually'],
  featureTitle: 'What you get instead of another spreadsheet tab',
  features: [
    { title: 'Connected rental records', description: 'Properties, units, tenants, leases, maintenance, expenses, and documents live in a connected system.' },
    { title: 'Real landlord workflows', description: 'Track rent, reminders, repairs, renewals, and reports the way rental work actually happens.' },
    { title: 'Cleaner visibility', description: 'See what needs attention without scanning rows, filters, formulas, and old notes.' },
    { title: 'Percy Pilot review', description: 'Open a plain-English summary of supported current rent-payment, maintenance, lease, and urgent tenant-conversation records.' },
  ],
  workflowTitle: 'Move from spreadsheet to system',
  workflowSteps: ['Create your free account.', 'Add properties, units, tenants, rent terms, leases, and documents.', 'Use Property Peace as the daily source of truth instead of a spreadsheet.', 'Open Percy Pilot when you want a read-only review of supported current records.'],
  faq: [
    { question: 'Why replace a rental spreadsheet?', answer: 'Spreadsheets are easy to start, but they do not naturally connect tenants, leases, rent, maintenance requests, photos, documents, and reminders. Property Peace gives those records a structured home.' },
    { question: 'Can I start with just one property?', answer: 'Yes. Property Peace is free for up to 5 units and works well for landlords starting with one or two rentals.' },
    { question: 'Will this still work as I add units?', answer: 'Yes. Property Peace is designed for the 1–50 unit range, so it can support a small portfolio as it grows.' },
  ],
  relatedLinks: [
    { href: '/landlord-software', label: 'Landlord software' },
    { href: '/small-landlord-tools', label: 'Small landlord tools' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/features', label: 'All features' },
  ],
  assistantBridge: {
    title: 'Connected records give Percy supported source context',
    description: 'Unlike disconnected spreadsheet tabs, structured records let a landlord open Percy Pilot and review supported current context with source-aware boundaries.',
    note: 'Percy is read-only: it does not edit records, take actions, or continuously monitor the portfolio.',
  },
  structuredName: 'Property Peace Property Management Spreadsheet Alternative',
  structuredDescription: 'Property management spreadsheet alternative for small landlords to organize connected rental records and open limited read-only Percy Pilot review of supported current context.',
};

export default function Page() {
  return <NicheLandingPage config={config} />;
}
