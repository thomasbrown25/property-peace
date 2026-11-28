import Image from 'next/image';

type MaintenanceTrackingFeatureSectionProps = {
  description: string;
};

export default function MaintenanceTrackingFeatureSection({ description }: MaintenanceTrackingFeatureSectionProps) {
  return (
    <section className="grid items-center gap-10 pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:pt-32">
      <Image
        src="/images/landing/maintenance-landlord-review-wide.webp"
        alt="A landlord reviews a tenant's leaky faucet request and its photo on a tablet."
        width={1440}
        height={720}
        className="h-auto w-full max-w-[620px] justify-self-center rounded-2xl"
      />

      <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
        <h2 className="mb-4 text-3xl font-extrabold leading-tight text-white md:text-4xl" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>
          Percy guides tenants through the request
        </h2>
        <div className="space-y-4 text-lg leading-relaxed md:text-xl" style={{ fontFamily: '"Inter", sans-serif' }}>
          <p className="text-brand-ivory">{description}</p>
          <p className="text-brand-ivory">
            Percy automatically categorizes the request and assigns a priority. You can see what needs attention first and share the details with your vendor when you assign the repair.
          </p>
        </div>
      </div>
    </section>
  );
}
