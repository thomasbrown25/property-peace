import type { Metadata } from 'next';
import NicheLandingPage, { type NicheLandingPageConfig } from '@/components/SEO/NicheLandingPage';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/property-management-software-for-small-landlords/', {
  title: 'Small Landlord Property Management | Property Peace',
  description: 'Property management software for small landlords with 1–50 units. Organize rent, tenants, leases, maintenance, and expenses. Start free with no credit card.',
  alternates: { canonical: '/property-management-software-for-small-landlords' },
  openGraph: { title: 'Small Landlord Property Management | Property Peace', description: 'Property management software for small landlords with 1–50 units. Organize rent, tenants, leases, maintenance, and expenses. Start free with no credit card.', type: 'website', url: '/property-management-software-for-small-landlords' },
  twitter: { card: 'summary_large_image', title: 'Small Landlord Property Management | Property Peace', description: 'Property management software for small landlords with 1–50 units. Organize rent, tenants, leases, maintenance, and expenses. Start free with no credit card.' },
});

const config: NicheLandingPageConfig = {
  eyebrow: 'Property management software for small landlords',
  title: 'A property management system sized for small landlords',
  description: 'Property Peace is for landlords who want their rental business organized without adopting a complicated enterprise platform built for big management companies.',
  proofPoints: ['1–50 unit focus', 'Free start', 'No per-unit surprise fees', 'Simple landlord workflows'],
  painTitle: 'Built around the jobs small landlords actually do',
  painIntro: 'You need rent clarity, lease organization, tenant communication, maintenance tracking, and financial visibility — not layers of tools built for a large office staff.',
  painPoints: ['Replace scattered spreadsheets, texts, folders, and reminders', 'Use one dashboard for properties, tenants, leases, and payments', 'Know what needs attention without digging through multiple apps', 'Scale from a few units to a growing portfolio with less chaos'],
  featureTitle: 'Small-landlord software features that matter',
  features: [
    { title: 'All-in-one dashboard', description: 'View properties, tenants, rent status, maintenance, and key tasks from one clean dashboard.' },
    { title: 'Online rent workflows', description: 'Organize rent collection, payment history, overdue balances, and reminders without awkward manual chasing.' },
    { title: 'Maintenance tracking', description: 'Give every request a place to live with photos, notes, messages, status, and repair history.' },
    { title: 'Lease and financial tools', description: 'Keep leases, documents, expenses, and reports connected to the right property and tenant.' },
  ],
  workflowTitle: 'A simpler operating system for rentals',
  workflowSteps: ['Add properties and units.', 'Connect tenants, leases, rent details, and documents.', 'Track daily landlord work from the dashboard.', 'Use reports and Percy Pilot summaries to understand what is happening across the portfolio.'],
  faq: [
    { question: 'Is Property Peace for property managers or landlords?', answer: 'Property Peace is focused on independent landlords and small rental owners. It can support growing portfolios, but the product language and workflows are intentionally landlord-first.' },
    { question: 'What unit count is Property Peace best for?', answer: 'The sweet spot is about 1–50 units: enough complexity to need software, but not so much that you need enterprise property-management tools.' },
    { question: 'Does Property Peace replace a spreadsheet?', answer: 'Yes. It gives you structured places for rent, tenants, maintenance, leases, documents, expenses, and reports so your spreadsheet stops being the source of truth.' },
  ],
  relatedLinks: [
    { href: '/landlord-software', label: 'Landlord software' },
    { href: '/small-landlord-tools', label: 'Small landlord tools' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/features', label: 'All features' },
  ],
  structuredName: 'Property Peace Small Landlord Property Management Software',
  structuredDescription: 'Property management software for small landlords to organize rent, tenants, maintenance, leases, documents, and expenses.',
};

export default function Page() {
  return <NicheLandingPage config={config} />;
}
