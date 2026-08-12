import type { Metadata } from 'next';
import { applyOttoSeo } from '@/lib/otto-seo';
import Hero from '@/components/Sections/Hero';
import PercyOutcomeBand from '@/components/Sections/PercyOutcomeBand';
import HowPercyHelps from '@/components/Sections/HowPercyHelps';
import PercyWorkflows from '@/components/Sections/PercyWorkflows';
import PercyTrust from '@/components/Sections/PercyTrust';
import Pricing from '@/components/Sections/Pricing';
import PercyFAQ from '@/components/Sections/PercyFAQ';
import CTA from '@/components/Sections/CTA';

export const metadata: Metadata = applyOttoSeo('/', {
  title: 'AI Property Assistant for Landlords | Property Peace',
  description: 'Property Peace combines rental property management software with Percy, a limited-pilot AI property assistant for supported portfolio briefings, source-linked context, and landlord review.',
  keywords: 'AI property assistant, property management software, landlord software, rental property management, small landlord tools, rental management software, Property Peace, limited-pilot assistant',
});

export default function Home() {
  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-white">
      <main className="w-full min-w-0">
        <Hero />
        <PercyOutcomeBand />
        <HowPercyHelps />
        <PercyWorkflows />
        <PercyTrust />
        <Pricing />
        <PercyFAQ />
        <CTA featured />
      </main>
    </div>
  );
}
