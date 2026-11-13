import { FiArrowRight, FiHome, FiTrendingUp, FiUserPlus, FiZap } from 'react-icons/fi';

const steps = [
  {
    icon: FiHome,
    title: 'Add Your Properties',
    description:
      'Import your portfolio in seconds. Add addresses, unit details, photos, and lease basics to build your centralized property hub.',
    blob: 'bg-brand-mint',
    accent: 'bg-brand-teal',
  },
  {
    icon: FiUserPlus,
    title: 'Invite Your Tenants',
    description:
      'Send a simple invite link. Tenants set up their profile, connect payments, and start submitting requests in the right place.',
    blob: 'bg-brand-mint',
    accent: 'bg-brand-teal',
  },
  {
    icon: FiZap,
    title: 'Automate Operations',
    description:
      'Configure rent schedules, maintenance workflows, reminders, and reporting preferences. Property Peace handles the routine.',
    blob: 'bg-brand-mint',
    accent: 'bg-brand-teal',
  },
  {
    icon: FiTrendingUp,
    title: 'Grow with Confidence',
    description:
      'Track performance, reduce vacancies, and scale your portfolio with calm, data-backed insights guiding every decision.',
    blob: 'bg-brand-mint',
    accent: 'bg-brand-teal',
  },
];

export default function OnboardingWorkflow() {
  return (
    <section className="relative overflow-hidden bg-white px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <span
            className="mb-4 inline-flex rounded-full border border-[var(--brand-border)] bg-brand-ivory px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand-teal"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Simple setup
          </span>
          <h2
            className="text-3xl font-bold text-primary-main sm:text-4xl lg:text-5xl"
            style={{ fontFamily: '"Host Grotesk", sans-serif', lineHeight: '1.12' }}
          >
            Up and running in minutes.
          </h2>
          <p
            className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            No lengthy onboarding. No IT setup. Just connect your properties and start managing smarter — today.
          </p>
        </div>

        <div className="mt-10 grid gap-8 sm:mt-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="relative text-center">
                {index < steps.length - 1 && (
                  <div className="pointer-events-none absolute left-[60%] top-12 z-0 hidden w-[82%] items-center justify-center text-brand-mint lg:flex">
                    <svg viewBox="0 0 160 48" className="h-12 w-full" fill="none" aria-hidden="true">
                      <path
                        d="M8 30C42 4 96 4 140 25"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="6 8"
                      />
                    </svg>
                    <FiArrowRight className="-ml-8 mt-3 h-5 w-5 flex-shrink-0" />
                  </div>
                )}

                <div className="relative z-10 mx-auto mb-4 flex h-24 w-24 items-center justify-center sm:mb-6 sm:h-28 sm:w-28">
                  <div className={`absolute inset-2 rounded-[2rem] ${step.blob} rotate-6`} />
                  <div className="absolute -right-1 top-3 h-5 w-5 rounded-full bg-brand-mint shadow-sm" />
                  <div className={`absolute bottom-4 left-2 h-4 w-4 rounded-full ${step.accent} shadow-sm`} />
                  <div className="absolute bottom-2 right-4 h-3 w-3 rounded-full bg-brand-mint shadow-sm" />
                  <div
                    className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-forest text-brand-mint shadow-xl shadow-[color-mix(in_srgb,var(--brand-forest)_20%,transparent)]"
                  >
                    <Icon className="h-9 w-9" strokeWidth={2.4} />
                  </div>
                </div>

                <h3
                  className="text-lg font-bold text-primary-main"
                  style={{ fontFamily: '"Host Grotesk", sans-serif' }}
                >
                  {step.title}
                </h3>
                <p
                  className="mx-auto mt-3 max-w-[255px] text-sm leading-6 text-slate-500"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
