import type { Metadata } from 'next';
import NicheLandingPage, { type NicheLandingPageConfig } from '@/components/SEO/NicheLandingPage';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/maintenance-request-software-for-landlords/', {
  title: 'Maintenance Request Software for Landlords | Property Peace',
  description: 'Organize tenant maintenance requests, photos, messages, vendors, and repair history in one landlord dashboard. Built for small rental owners. Start free.',
  alternates: { canonical: '/maintenance-request-software-for-landlords' },
  openGraph: { title: 'Maintenance Request Software for Landlords | Property Peace', description: 'Organize tenant maintenance requests, photos, messages, vendors, and repair history in one landlord dashboard. Built for small rental owners. Start free.', type: 'website', url: '/maintenance-request-software-for-landlords' },
  twitter: { card: 'summary_large_image', title: 'Maintenance Request Software for Landlords | Property Peace', description: 'Organize tenant maintenance requests, photos, messages, vendors, and repair history in one landlord dashboard. Built for small rental owners. Start free.' },
});

const config: NicheLandingPageConfig = {
  eyebrow: 'Maintenance request software for landlords',
  title: 'Stop losing maintenance requests in texts and emails',
  description: 'Property Peace gives small landlords one organized place to track maintenance requests, photos, tenant messages, work status, vendors, and property repair history.',
  proofPoints: ['Request history', 'Photo-friendly workflow', 'Tenant communication', 'Free start'],
  painTitle: 'Every repair needs a clear trail',
  painIntro: 'Maintenance gets expensive when details are scattered. Property Peace keeps the request, tenant, property, photos, notes, and status together so repairs are easier to manage.',
  painPoints: ['Capture requests before they disappear in text threads', 'Keep repair photos and notes attached to the right property', 'Track status from submitted to resolved', 'Build maintenance history for every unit'],
  featureTitle: 'Maintenance tools for small rental owners',
  features: [
    { title: 'Request tracking', description: 'Organize every maintenance issue with status, priority, tenant, and property details.' },
    { title: 'Photo and note records', description: 'Keep photos, notes, and context attached to the repair instead of scattered in your phone.' },
    { title: 'Tenant messaging', description: 'Keep communication connected to the maintenance item so everyone knows what is happening.' },
    { title: 'Repair history', description: 'See what has happened at each unit over time for better decisions and cleaner records.' },
  ],
  workflowTitle: 'Turn repair chaos into a trackable workflow',
  workflowSteps: ['Create or receive a maintenance request.', 'Add photos, notes, priority, and property details.', 'Track the issue through updates, messages, and vendor work.', 'Close the request with a clean repair history for the unit.'],
  faq: [
    { question: 'Can tenants submit maintenance requests?', answer: 'Property Peace is designed around organized tenant maintenance workflows, including request details, messages, photos, and status tracking.' },
    { question: 'Can I keep repair history by property?', answer: 'Yes. Maintenance records are connected to properties and units so landlords can review past repairs instead of searching old texts.' },
    { question: 'Is this only for large property managers?', answer: 'No. Property Peace is intentionally built for small landlords and independent rental owners who need maintenance organization without enterprise complexity.' },
  ],
  relatedLinks: [
    { href: '/maintenance/ai-maintenance', label: 'Percy Pilot maintenance management' },
    { href: '/maintenance/in-app-messaging', label: 'Maintenance messaging' },
    { href: '/features/maintenance-tracking', label: 'Maintenance tracking feature' },
    { href: '/pricing', label: 'Pricing' },
  ],
  structuredName: 'Property Peace Maintenance Request Software for Landlords',
  structuredDescription: 'Maintenance request software for landlords to organize tenant requests, photos, messages, vendors, repair status, and property history.',
};

export default function Page() {
  return <NicheLandingPage config={config} />;
}
