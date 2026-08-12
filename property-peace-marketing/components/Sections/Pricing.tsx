import Link from 'next/link';
import { FiArrowRight, FiCheck } from 'react-icons/fi';

const plans = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    description: 'A calm home for a small rental portfolio.',
    features: ['Up to 5 units', 'Core lease, maintenance, rent, expense, and document records', 'No credit card required'],
  },
  {
    name: 'Premium',
    price: '$14.99',
    cadence: 'per month',
    description: 'More room and advanced property-management workflows.',
    features: ['Unlimited units', 'Advanced accounting, rent workflows, and LeaseShield', 'Limited Percy Pilot access may be available; not a plan entitlement'],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-700">Simple pricing</p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] text-[#061E35] sm:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Start with five units, free.</h2>
            <p className="mt-4 leading-7 text-slate-600">Property Peace remains useful with or without Percy. Upgrade when your portfolio or workflow needs more.</p>
          </div>
          <Link href="/pricing" className="inline-flex min-h-11 items-center gap-2 font-bold text-green-700 underline underline-offset-4">See full plan details <FiArrowRight aria-hidden="true" /></Link>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {plans.map((plan, index) => (
            <article key={plan.name} className={`border p-6 sm:p-8 ${index === 1 ? 'border-[#061E35] bg-[#061E35] text-white' : 'border-slate-200 bg-[#F8FAF9] text-[#061E35]'}`}>
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <div className="mt-5 flex items-end gap-2"><span className="text-4xl font-bold">{plan.price}</span><span className={`pb-1 text-sm ${index === 1 ? 'text-slate-300' : 'text-slate-500'}`}>{plan.cadence}</span></div>
              <p className={`mt-4 text-sm leading-6 ${index === 1 ? 'text-slate-300' : 'text-slate-600'}`}>{plan.description}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => <li key={feature} className="flex gap-3 text-sm leading-6"><FiCheck className="mt-1 shrink-0 text-green-500" aria-hidden="true" />{feature}</li>)}
              </ul>
              <Link href="https://app.propertypeace.io/register" className="mt-7 inline-flex min-h-12 w-full items-center justify-center bg-green-600 px-6 font-bold text-white transition hover:bg-green-500">{index === 1 ? 'Get started' : 'Start free'}</Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
