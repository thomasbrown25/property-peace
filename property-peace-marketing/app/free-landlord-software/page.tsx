import type { Metadata } from 'next';
import NicheLandingPage, { type NicheLandingPageConfig } from '@/components/SEO/NicheLandingPage';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/free-landlord-software/', {
  title: 'Free Rental Management Software | Property Peace',
  description: 'Free rental management software for small landlords with up to 5 units. Manage rent, tenants, leases, maintenance, and expenses with no credit card required.',
  alternates: { canonical: '/free-landlord-software' },
  openGraph: { title: 'Free Rental Management Software | Property Peace', description: 'Free rental management software for small landlords with up to 5 units. Manage rent, tenants, leases, maintenance, and expenses with no credit card required.', type: 'website', url: '/free-landlord-software' },
  twitter: { card: 'summary_large_image', title: 'Free Rental Management Software | Property Peace', description: 'Free rental management software for small landlords with up to 5 units. Manage rent, tenants, leases, maintenance, and expenses with no credit card required.' },
});

const config: NicheLandingPageConfig = {
  eyebrow: 'Free for up to 5 units',
  title: 'Free Rental Management Software for Small Landlords',
  description: 'Get free landlord software to manage rent, tenants, and expenses. Perfect for small rental owners with 1-50 units. No credit card required.',
  proofPoints: ['Free for up to 5 units', 'No credit card required', 'Built for 1–50 units', 'Upgrade only when ready'],
  painTitle: 'Stop forcing a spreadsheet to be your property manager',
  painIntro: 'Most small landlords do not need a massive property-management platform. They need one reliable place to see what is paid, what is overdue, what needs repair, and what paperwork matters next.',
  painPoints: ['Track rent status without rebuilding a spreadsheet every month', 'Keep tenants, units, leases, and documents connected', 'Capture maintenance requests before they disappear in texts', 'Start organized now and scale when you add more doors'],
  featureTitle: 'What the free landlord software helps you organize',
  features: [
    { title: 'Rent and tenant tracking', description: 'See tenant details, rent records, due dates, and balances in one landlord dashboard.' },
    { title: 'Maintenance organization', description: 'Keep requests, photos, notes, and status updates together instead of scattered across texts and emails.' },
    { title: 'Lease and document storage', description: 'Store key lease documents, renewal details, and property records where you can actually find them.' },
    { title: 'Expense visibility', description: 'Start building cleaner rental financial records before tax season turns into cleanup season.' },
  ],
  workflowTitle: 'Go from scattered notes to a calmer rental workflow',
  workflowSteps: ['Create your free Property Peace account.', 'Add your first property, unit, and tenant details.', 'Track rent, maintenance, leases, expenses, and documents from one dashboard.', 'Upgrade only when your portfolio or workflow needs more power.'],
  faq: [
    { question: 'Is Property Peace really free for landlords?', answer: 'Yes. Property Peace has a free plan for landlords managing up to 5 units, so small rental owners can start without a credit card.' },
    { question: 'Who is Property Peace best for?', answer: 'Property Peace is built for independent landlords and small rental owners managing roughly 1–50 units, especially people replacing spreadsheets and scattered messages.' },
    { question: 'Can I upgrade later?', answer: 'Yes. Start free, then review current pricing and availability when you need unlimited units or more advanced workflows. Percy Pilot access is not described as a Premium entitlement.' },
  ],
  relatedLinks: [
    { href: '/landlord-software', label: 'Landlord software' },
    { href: '/small-landlord-tools', label: 'Small landlord tools' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/features', label: 'All features' },
  ],
  assistantBridge: {
    title: 'Start with the system of record, then review supported context',
    description: 'Structured property, lease, rent, maintenance, and tenant-conversation records give Percy Pilot supported context to summarize when a landlord opens it.',
    note: 'Percy is currently read-only and landlord-opened. It does not take actions or continuously monitor records.',
  },
  structuredName: 'Property Peace Free Landlord Software',
  structuredDescription: 'Free landlord software for small rental owners to manage rent, tenants, leases, maintenance, expenses, and documents.',
};

export default function Page() {
  return <NicheLandingPage config={config} />;
}
