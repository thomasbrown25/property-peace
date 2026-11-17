import type { Metadata } from 'next';
import PricingPlans from '@/components/Sections/PricingPlans';
import FAQ from '@/components/Sections/FAQ';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/pricing/', {
  title: 'Free Property Management Software | Property Peace',
  description: 'Manage unlimited units with Property Peace for free. Rent tracking, leases, maintenance, accounting, and more. No credit card required.',
  alternates: {
    canonical: '/pricing',
  },
});

export default function PricingPage() {
  return (
    <div className="pricing-route min-h-screen bg-brand-forest text-white">
      <main>
        <PricingPlans />
        <FAQ dark />
      </main>
    </div>
  );
}
