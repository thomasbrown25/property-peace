import type { Metadata } from 'next';
import NicheLandingPage, { type NicheLandingPageConfig } from '@/components/SEO/NicheLandingPage';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/landlord-accounting-software/', {
  title: 'Landlord Accounting Software for Rentals | Property Peace',
  description: 'Keep landlord rent and expense records organized by property with reports and exports for review and professional handoff. Property Peace does not provide tax advice.',
  alternates: { canonical: '/landlord-accounting-software' },
  openGraph: { title: 'Landlord Accounting Software for Rentals | Property Peace', description: 'Keep landlord rent and expense records organized by property for review, reports, exports, and professional handoff.', type: 'website', url: '/landlord-accounting-software' },
  twitter: { card: 'summary_large_image', title: 'Landlord Accounting Software for Rentals | Property Peace', description: 'Keep landlord rent and expense records organized by property for review, reports, exports, and professional handoff.' },
});

const config: NicheLandingPageConfig = {
  eyebrow: 'Landlord accounting software',
  title: 'Keep rental income and expenses organized before tax season',
  description: 'Property Peace helps small landlords track rent, expenses, property-level performance, receipts, reports, and records without rebuilding financial spreadsheets every month.',
  proofPoints: ['Income and expenses', 'Property-level records', 'Tax-ready exports', 'Start free'],
  painTitle: 'Rental accounting should not be a once-a-year cleanup project',
  painIntro: 'When income, expenses, receipts, and property notes are scattered, every tax season becomes a scramble. Property Peace keeps financial records connected to the rental workflow all year.',
  painPoints: ['Track income and expenses by property', 'Keep cleaner records for repairs, maintenance, and operating costs', 'Review property profitability with less spreadsheet cleanup', 'Prepare reports and exports when you need them'],
  featureTitle: 'Accounting tools for independent landlords',
  features: [
    { title: 'Expense tracking', description: 'Log expenses by property, category, repair, and receipt so records stay usable.' },
    { title: 'Rent income visibility', description: 'Connect rent activity with property financial history for a clearer monthly picture.' },
    { title: 'Property reports', description: 'Review income, expenses, and performance by property instead of one messy master sheet.' },
    { title: 'Tax-ready organization', description: 'Keep records cleaner through the year so tax-time prep is less painful.' },
  ],
  workflowTitle: 'Build clean rental books as you manage the property',
  workflowSteps: ['Track rent activity as it happens.', 'Log expenses with categories, receipts, and property links.', 'Review reports by property or portfolio.', 'Export records when it is time to share with your accountant or prepare taxes.'],
  faq: [
    { question: 'Is Property Peace a full accounting replacement?', answer: 'Property Peace is landlord-focused financial organization: rent, expenses, reports, records, and exports. It helps small landlords keep cleaner books and can complement an accountant or tax tool.' },
    { question: 'Can I track expenses by property?', answer: 'Yes. Property Peace is designed to connect expenses to the right property, category, receipt, and repair context.' },
    { question: 'Does this help at tax time?', answer: 'Yes. Cleaner income and expense records throughout the year make tax-time reporting and accountant handoff easier.' },
  ],
  relatedLinks: [
    { href: '/rent/accounting', label: 'Accounting feature' },
    { href: '/rent/expense-tracking', label: 'Expense tracking' },
    { href: '/rent/rent-reporting', label: 'Rent reporting' },
    { href: '/pricing', label: 'Pricing' },
  ],
  assistantBridge: {
    title: 'The system keeps financial records organized',
    description: 'Property Peace connects recorded rent activity and expenses to the right properties so landlords have a cleaner system of record to review and share with qualified professionals.',
    note: 'Percy does not provide accounting or tax advice, explain financial results, or move money. Online payment processing is not currently available.',
  },
  structuredName: 'Property Peace Landlord Accounting Software',
  structuredDescription: 'Landlord accounting software for small rental owners to track rent, expenses, property performance, reports, and tax-ready records.',
};

export default function Page() {
  return <NicheLandingPage config={config} />;
}
