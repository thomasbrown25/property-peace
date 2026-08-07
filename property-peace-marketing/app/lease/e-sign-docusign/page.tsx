import type { Metadata } from "next";
import FeatureLandingPage from "@/components/Marketing/FeatureLandingPage";
import { FiFile } from "react-icons/fi";
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/lease/e-sign-docusign/', {
  title: "E-Signature Integration Roadmap | Property Peace",
  description: "Integrated DocuSign and in-product e-signature workflows are not currently available. Use Property Peace to organize lease records and completed documents.",
  keywords: "lease document management, e-signature roadmap, lease records, landlord lease software",
  alternates: { canonical: "/lease/e-sign-docusign" },
  openGraph: {
    title: "E-Signature Integration Roadmap | Property Peace",
    description: "Integrated e-signature is not currently available. Organize lease records and completed documents today.",
    type: "website",
    url: "/lease/e-sign-docusign",
  },
  twitter: {
    card: "summary_large_image",
    title: "E-Signature Integration Roadmap | Property Peace",
    description: "Integrated e-signature is not currently available. Organize lease records and completed documents today.",
  },
  robots: { index: false, follow: true },
});

export default function Page() {
  return <FeatureLandingPage icon={FiFile} {...page} />;
}

const page = {
  canonicalPath: '/lease/e-sign-docusign',
  categoryLabel: 'Lease Management',
  categoryHref: '/features/lease-management',
  eyebrow: 'Integration roadmap',
  title: 'E-Signature Integration Is Not Currently Available',
  subtitle: 'Property Peace can organize lease records and completed documents today. Integrated DocuSign and in-product e-signature workflows remain on the roadmap.',
  primaryCta: 'Manage Lease Records',
  trustItems: ['Availability stated clearly', 'Free for up to 2 units', 'Built for 1–50 units'],
  problemTitle: 'Signing and recordkeeping are separate today',
  problemPoints: [
    'Property Peace does not currently send documents to DocuSign.',
    'Property Peace does not currently provide an in-product electronic signature workflow.',
    'Landlords still need a clear place for lease dates, renewals, and completed documents.',
  ],
  solutionTitle: 'Use the live lease-management tools now',
  solutionPoints: [
    'Create and organize lease records in Property Peace.',
    'Use your preferred signing provider outside Property Peace.',
    'Store the completed document with the relevant property and tenant records.',
  ],
  steps: [
    { title: 'Prepare the lease', body: 'Create or upload the lease document and keep its dates organized.' },
    { title: 'Sign separately', body: 'Use your preferred external signing process; no integrated signing is currently available.' },
    { title: 'Store the result', body: 'Keep the completed lease connected to your Property Peace records.' },
  ],
  featureTitle: 'Available lease-management tools',
  features: [
    'Lease record organization',
    'Document storage',
    'Lease date tracking',
    'Expiration and renewal workflows',
    'Property and tenant associations',
    'E-signature integration roadmap',
  ],
  outcomeTitle: 'Clear records without a false integration promise',
  outcomes: [
    'Keep lease information in one place.',
    'Track important dates and renewals.',
    'Store completed copies with the correct records.',
    'Know that integrated e-signature is not currently available.',
  ],
  faqs: [
    {
      question: 'Can Property Peace send leases through DocuSign today?',
      answer: 'No. Integrated DocuSign and in-product electronic signature workflows are not currently available.'
    },
    {
      question: 'What lease tools are available now?',
      answer: 'You can organize lease records, track important dates, and store completed documents with the relevant property and tenant records.'
    },
    {
      question: 'How should I collect signatures?',
      answer: 'Use your preferred external signing process, then store the completed document in Property Peace.'
    }
  ],
  related: [
    { label: 'Lease management', href: '/features/lease-management', description: 'Explore currently available lease-record tools.' },
    { label: 'Document management', href: '/features/document-management', description: 'Keep property documents organized.' },
  ],
};
