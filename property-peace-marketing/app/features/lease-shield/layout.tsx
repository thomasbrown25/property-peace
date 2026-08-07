import type { Metadata } from 'next';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/features/lease-shield/', {
  title: 'LeaseShield Percy Pilot Legal Answers for Landlords | Property Peace',
  description: 'LeaseShield answers lease and landlord-tenant questions with official government and state-law sources, citations, and state-specific context.',
  alternates: { canonical: 'https://propertypeace.io/features/lease-shield/' },
  openGraph: {
    title: 'LeaseShield Percy Pilot Legal Answers for Landlords | Property Peace',
    description: 'LeaseShield answers lease and landlord-tenant questions with official government and state-law sources, citations, and state-specific context.',
    type: 'website',
    url: 'https://propertypeace.io/features/lease-shield/',
  },
});

export default function LeaseShieldFeatureLayout({ children }: { children: React.ReactNode }) {
  return children;
}
