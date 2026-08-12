import type { Metadata } from "next";
import FeatureLandingPage from "@/components/Marketing/FeatureLandingPage";
import { FiFileText } from "react-icons/fi";
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/lease/ai-lease-creation/', {
  title: "AI Lease Creation: Landlord-Run Workflow | Property Peace",
  description: "Explore AI lease creation with Property Peace's current landlord-run structured lease workflow. Percy does not currently draft, create, sign, or renew leases.",
  keywords: "AI lease creation, rental lease generator, lease agreement software, landlord lease generator, structured lease workflow",
  alternates: { canonical: "/lease/ai-lease-creation" },
  openGraph: {
    title: "AI Lease Creation: Landlord-Run Workflow | Property Peace",
    description: "A landlord-run workflow for lease terms, document export, external signing, and storage, with supported lease deadlines surfaced in the limited Percy Pilot.",
    type: "website",
    url: "/lease/ai-lease-creation",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Lease Creation: Landlord-Run Workflow | Property Peace",
    description: "Organize lease terms, export documents, use external signing, and review supported lease deadlines in the limited Percy Pilot.",
  },
});

export default function Page() {
  return <FeatureLandingPage icon={FiFileText} {...page} />;
}

const page = {
  canonicalPath: '/lease/ai-lease-creation',
  categoryLabel: 'Lease Management',
  categoryHref: '/features/lease-management',
  eyebrow: 'Lease feature',
  title: 'AI Lease Creation with a Landlord-Run Structured Workflow',
  subtitle: 'Property Peace currently provides a landlord-run structured lease workflow for terms, export, external signing, and storage. Percy can surface supported lease deadlines from current records in the limited pilot, but does not currently draft, create, sign, or renew leases.',
  primaryCta: 'Start a Lease Workflow',
  trustItems: ['No credit card required', 'Free for up to 5 units', 'Built for 1–50 units'],
  problemTitle: 'Lease preparation should not start from a blank document',
  problemPoints: [
    'Old templates get copied, edited, and reused without a clear process.',
    'Important terms like fees, utilities, pets, and maintenance responsibilities can be missed.',
    'Documents, signatures, and stored lease records often live in separate tools.',
  ],
  solutionTitle: 'A landlord-run lease workflow keeps each step organized',
  solutionPoints: [
    'Landlords enter rent, deposit, fee, utility, and policy details in a structured workflow.',
    'Keep property-specific terms visible while reviewing the document before export.',
    'Use an external signing process and store the completed document in Property Peace.',
  ],
  steps: [
    { title: 'Enter property terms', body: 'Add rent, deposit, dates, utilities, pet rules, and lease basics in the structured workflow.' },
    { title: 'Review the document', body: 'The landlord checks every term and confirms the document is ready to export.' },
    { title: 'Sign externally and store', body: 'Export the document, use an external signing provider, then store the completed lease record.' },
  ],
  featureTitle: 'Lease workflow features',
  features: [
    'Structured landlord-entered lease terms',
    'Rent, deposit, fee, utility, and pet policy inputs',
    'Landlord document review',
    'PDF export workflow',
    'External signing handoff',
    'Cloud lease storage after signing',
  ],
  outcomeTitle: 'Keep the path from terms to stored lease clear',
  outcomes: [
    'Reduce repetitive copy-and-paste lease work.',
    'Keep lease details connected to the property and tenant.',
    'Maintain a clear landlord-run review and export process.',
    'Surface supported lease starts, expirations, and signature-status tasks in a Percy Pilot briefing.',
  ],
  related: [
    { label: 'Lease management', href: '/features/lease-management', description: 'Create, organize, and track lease records in Property Peace.' },
    { label: 'E-signature roadmap', href: '/lease/e-sign-docusign', description: 'Review the roadmap and current external-signing workflow.' },
    { label: 'LeaseShield', href: '/features/lease-shield', description: 'Ask state-specific lease questions with official source citations.' },
  ],
  faqs: [
    {
      question: 'Does Percy create or sign a lease?',
      answer: 'No. Lease creation, review, export, signing, and renewal remain landlord-run. Percy is read-only and does not create documents, sign leases, send notices, or renew leases.',
    },
    {
      question: 'What lease information can Percy surface?',
      answer: 'In the limited Percy Pilot, Percy can surface upcoming lease starts, expirations, and supported signature-status tasks from current Property Peace records. It does not guarantee legal notice deadlines or track every jurisdictional requirement.',
    },
    {
      question: 'Can I customize rent, deposits, and fees?',
      answer: 'Yes. The landlord-run workflow supports editable lease terms such as rent, deposits, fees, utilities, pets, and maintenance responsibilities.',
    },
    {
      question: 'Can I send the lease for e-signature?',
      answer: 'No. Integrated e-signature is not currently available. Export the document, use your preferred external signing process, and store the completed lease in Property Peace.',
    },
  ],
  disclaimer: 'Property Peace lease tools support a landlord-run document workflow and do not provide legal advice. Percy is a limited-pilot, read-only assistant for supported records. Consult a qualified attorney for your specific situation.',
};
