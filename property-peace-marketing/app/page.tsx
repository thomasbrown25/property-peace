import type { Metadata } from 'next';
import { applyOttoSeo } from '@/lib/otto-seo';
import Hero from '@/components/Sections/Hero';
import OnboardingWorkflow from '@/components/Sections/OnboardingWorkflow';
import PainPoints from '@/components/Sections/PainPoints';
import CTA from '@/components/Sections/CTA';
// import Features from '@/components/Sections/Features'; // Hidden for now
import TrustClarity from '@/components/Sections/TrustClarity';
import AiSummaries from '@/components/Sections/AiSummaries';
import MaintenanceAgent from '@/components/Sections/MaintenanceAgent';
import RentalAccounting from '@/components/Sections/RentalAccounting';
import FAQ from '@/components/Sections/FAQ';
import RentEstimates from '@/components/Sections/RentEstimates';
// Testimonials/SocialProof section is temporarily hidden; keep the component for later re-enable.
// import SocialProof from '@/components/Sections/SocialProof';
import ProofBand from '@/components/Sections/ProofBand';
import SeoPathways from '@/components/Sections/SeoPathways';
import Pricing from '@/components/Sections/Pricing';

export const metadata: Metadata = applyOttoSeo('/', {
  title: 'Landlord Software for 1–50 Units — Start Free | Property Peace',
  description: 'Manage rent, tenants, leases, maintenance, and expenses in one calm dashboard. Built for small landlords with 1–50 units. Start free — no credit card required.',
});

export default function Home() {
  return (
    <div className="min-h-screen bg-white w-full min-w-0 overflow-x-hidden">
      <main className="w-full min-w-0">

        {/* Zone 1: Hero + PainPoints + setup workflow — clean white background */}
        <div className="relative overflow-hidden bg-white">
          <div className="relative z-10">
            <Hero />
            <OnboardingWorkflow />
            <PainPoints />
            <CTA />
          </div>
        </div>

        {/* Proof band replaces hidden testimonials with factual product proof */}
        <ProofBand />
        <SeoPathways />

        {/* Zone 2: Feature sections — light */}
        <TrustClarity />

        {/* Find your peace CTA — desktop/tablet only; hidden on mobile to keep the homepage shorter. */}
        <div className="hidden md:block">
          <Pricing />
        </div>

        {/* Detailed feature demos — desktop/tablet only; hidden on mobile per mobile audit. */}
        <div className="hidden md:block">
          <AiSummaries />
          <MaintenanceAgent />
          <RentEstimates />
          <RentalAccounting />
        </div>
        <FAQ />
        <CTA featured />

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
