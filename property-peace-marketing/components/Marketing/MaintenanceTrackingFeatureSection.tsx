'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import FeatureHeroMock from '@/components/Marketing/FeatureHeroMock';

type MaintenanceTrackingFeatureSectionProps = {
  heading: string;
  description: string;
  benefits: string[];
};

const stepHeadings = [
  'Tenants submit repair requests with details and photos.',
  'Track vendor, priority, schedule, and cost from one place.',
  'Keep a complete maintenance history for every property.',
];

export default function MaintenanceTrackingFeatureSection({ heading, description, benefits }: MaintenanceTrackingFeatureSectionProps) {
  const [activeStep, setActiveStep] = useState(0);
  const activeHeading = stepHeadings[activeStep] ?? stepHeadings[0];

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
      <div className="flex flex-col items-center lg:items-start">
        <h2 className="mb-7 max-w-xl text-center text-3xl font-bold leading-tight text-primary-main md:text-4xl lg:text-left" style={{ fontFamily: '"Poppins", sans-serif' }}>
          {heading}
        </h2>
        <FeatureHeroMock
          slug="maintenance-tracking"
          title="Maintenance Tracking for Landlords"
          benefits={benefits.slice(0, 2)}
          showWhyItMatters={false}
          captionPlacement="none"
          onActiveStepChange={setActiveStep}
        />
      </div>

      <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
        <AnimatePresence mode="wait">
          <motion.h3
            key={activeHeading}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mb-4 text-2xl font-bold leading-snug text-primary-main md:text-3xl"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            {activeHeading}
          </motion.h3>
        </AnimatePresence>
        <p className="text-lg leading-relaxed text-[#516A80] md:text-xl" style={{ fontFamily: '"Inter", sans-serif' }}>
          {description}
        </p>
      </div>
    </div>
  );
}
