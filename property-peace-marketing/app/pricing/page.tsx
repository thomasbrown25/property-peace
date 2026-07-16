import type { Metadata } from 'next';
import PricingPlans from '@/components/Sections/PricingPlans';
import FAQ from '@/components/Sections/FAQ';
import CTA from '@/components/Sections/CTA';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/pricing/', {
  title: 'Landlord Software Pricing & Plans | Property Peace',
  description: 'Start free with landlord software for up to 2 units. Compare simple Property Peace pricing for rent, tenants, leases, maintenance, and Percy AI tools.',
  alternates: {
    canonical: '/pricing',
  },
});

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <main>
        <PricingPlans />
        <FAQ />
        <CTA />
      </main>
    </div>
  );
}
