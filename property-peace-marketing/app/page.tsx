import type { Metadata } from 'next';
import { applyOttoSeo } from '@/lib/otto-seo';
import Hero from '@/components/Sections/Hero';
import PainPoints from '@/components/Sections/PainPoints';
import CTA from '@/components/Sections/CTA';
// import Features from '@/components/Sections/Features'; // Hidden for now
import TrustClarity from '@/components/Sections/TrustClarity';
import FAQ from '@/components/Sections/FAQ';
// Testimonials/SocialProof section is temporarily hidden; keep the component for later re-enable.
// import SocialProof from '@/components/Sections/SocialProof';
import SeoPathways from '@/components/Sections/SeoPathways';
import ResourceHighlights from '@/components/Sections/ResourceHighlights';

export const metadata: Metadata = applyOttoSeo('/', {
  title: 'Free Rental Management Software | Property Peace',
  description: 'Free rental management software for independent landlords with up to 5 units. Manage rent, tenants, leases, maintenance, and expenses in one calm dashboard. No credit card required.',
});

export default function Home() {
  return (
    <div className="min-h-screen bg-white w-full min-w-0 overflow-x-hidden">
      <main className="w-full min-w-0">

        {/* Zone 1: Hero + landlord benefits — clean white background */}
        <div className="relative overflow-hidden bg-white">
          <div className="relative z-10">
            <Hero />
            <PainPoints />
            <CTA />
          </div>
        </div>

        <SeoPathways />
        <ResourceHighlights />

        {/* Zone 2: Feature sections — light */}
        <TrustClarity />
        <FAQ />

        {/* Zone 3: Social proof + Compare — hidden for now */}
        {/* <div
          className="relative overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #061e35 0%, #0a2d52 55%, #0d2040 100%)' }}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)' }} />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)' }} />
          <SocialProof />
          <Compare />
        </div> */}


      </main>
    </div>
  );
}
