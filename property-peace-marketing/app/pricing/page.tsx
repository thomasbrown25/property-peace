import type { Metadata } from 'next';
import PricingPlans from '@/components/Sections/PricingPlans';
import FAQ from '@/components/Sections/FAQ';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/pricing/', {
  title: 'Landlord Software Pricing & Plans | Property Peace',
  description: 'Start free with landlord software for up to 5 units. Compare simple Property Peace pricing for rent, tenants, leases, maintenance, and Percy Pilot tools.',
  alternates: {
    canonical: '/pricing',
  },
});

export default function PricingPage() {
  return (
    <div className="pricing-route min-h-screen bg-[#061E35] text-white">
      <style>{`
        .pricing-route > main > section:first-child { background: #061E35; }
        .pricing-route > main > section:first-child h1 + p { color: rgba(255,255,255,.8); }
      `}</style>
      <main>
        <PricingPlans />
        <FAQ dark />
      </main>
    </div>
  );
}
