import type { Metadata } from 'next';
import NicheLandingPage, { type NicheLandingPageConfig } from '@/components/SEO/NicheLandingPage';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/rent-collection-software-for-landlords/', {
  title: 'Rent Collection Software for Landlords | Property Peace',
  description: 'Track rent, reminders, payment history, overdue balances, and tenant records in one landlord dashboard. Built for small rental owners. Start free.',
  alternates: { canonical: '/rent-collection-software-for-landlords' },
  openGraph: { title: 'Rent Collection Software for Landlords | Property Peace', description: 'Track rent, reminders, payment history, overdue balances, and tenant records in one landlord dashboard. Built for small rental owners. Start free.', type: 'website', url: '/rent-collection-software-for-landlords' },
  twitter: { card: 'summary_large_image', title: 'Rent Collection Software for Landlords | Property Peace', description: 'Track rent, reminders, payment history, overdue balances, and tenant records in one landlord dashboard. Built for small rental owners. Start free.' },
});

const config: NicheLandingPageConfig = {
  eyebrow: 'Rent collection software for landlords',
  title: 'Make rent collection easier to track, remind, and reconcile',
  description: 'Property Peace helps small landlords stay on top of rent status, payment records, overdue balances, reminders, tenants, and units from one organized dashboard.',
  proofPoints: ['Start free', 'Payment history in one place', 'Overdue rent visibility', 'Built for small portfolios'],
  painTitle: 'Rent should not live in texts, memory, and a messy spreadsheet',
  painIntro: 'When rent tracking is manual, small issues become late-night follow-ups and end-of-month cleanup. Property Peace keeps the rent workflow visible and connected to each tenant and unit.',
  painPoints: ['See who has paid and who still needs a reminder', 'Keep rent records connected to each tenant and unit', 'Reduce awkward manual follow-up with clearer workflows', 'Connect rent activity with expenses and reports'],
  featureTitle: 'Rent collection features for small landlords',
  features: [
    { title: 'Rent status dashboard', description: 'Quickly check paid, pending, and overdue rent without hunting through bank activity and messages.' },
    { title: 'Tenant payment history', description: 'Keep clear records for each tenant, property, and unit so history is easier to review.' },
    { title: 'Late-fee and reminder workflows', description: 'Use organized reminders and late-fee settings to make follow-up more consistent.' },
    { title: 'Reports for cleaner records', description: 'Connect rent activity with property-level reporting so month-end review is less painful.' },
  ],
  workflowTitle: 'A calmer monthly rent routine',
  workflowSteps: ['Add properties, units, tenants, and rent terms.', 'Track rent activity and overdue balances from your dashboard.', 'Use reminders and clear records to reduce manual chasing.', 'Review rent performance alongside expenses and reports.'],
  faq: [
    { question: 'Can tenants currently pay rent online through Property Peace?', answer: 'No. Online payment processing is not currently available. Property Peace currently helps landlords record payment history, track overdue balances, configure late fees, and organize reminders.' },
    { question: 'Is this useful if I only have a few units?', answer: 'Yes. The free plan is built for landlords with up to 2 units, and the product is designed around small-portfolio rent collection.' },
    { question: 'Does rent tracking connect to reports?', answer: 'Yes. Rent records and property financial details can be used with reporting workflows so you get a clearer view of property performance.' },
  ],
  relatedLinks: [
    { href: '/rent/accounting', label: 'Landlord accounting' },
    { href: '/rent/custom-late-fees', label: 'Custom late fees' },
    { href: '/rent/rent-reporting', label: 'Rent reporting' },
    { href: '/pricing', label: 'Pricing' },
  ],
  structuredName: 'Property Peace Rent Collection Software for Landlords',
  structuredDescription: 'Rent collection software for landlords to track rent status, payment history, overdue balances, reminders, tenants, and reports.',
};

export default function Page() {
  return <NicheLandingPage config={config} />;
}
