import type { Metadata } from 'next';
import FAQ from '@/components/Sections/FAQ';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/faq/', {
  title: 'FAQ | Property Peace',
  description: 'Frequently asked questions about Property Peace landlord software, pricing, setup, rental workflows, and the limited Percy Pilot.',
  alternates: { canonical: '/faq' },
});

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white">
      <FAQ />
    </div>
  );
}
