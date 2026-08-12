import { FiArrowRight, FiDatabase, FiEye, FiFileText } from 'react-icons/fi';

const steps = [
  {
    icon: FiDatabase,
    number: '01',
    title: 'Organize your records',
    body: 'Keep rent records, leases, maintenance requests, applications, and in-app conversations in Property Peace.',
  },
  {
    icon: FiFileText,
    number: '02',
    title: 'Percy summarizes supported records',
    body: 'In the limited pilot, Percy answers supported questions and links its context to the workflow categories it checked.',
  },
  {
    icon: FiEye,
    number: '03',
    title: 'You review and choose the next step',
    body: 'Check the underlying workflow, apply your judgment, and continue the work in Property Peace yourself.',
  },
];

export default function HowPercyHelps() {
  return (
    <section id="how-percy-helps" className="scroll-mt-24 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-700">How Percy helps</p>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] text-[#061E35] sm:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>An attention layer for the records you already manage.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">Percy keeps you in control: you review the context and decide what happens next.</p>
        </div>
        <div className="mt-10 grid border border-slate-200 lg:grid-cols-3">
          {steps.map(({ icon: Icon, number, title, body }, index) => (
            <div key={title} className="relative border-b border-slate-200 p-6 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0 sm:p-8">
              <div className="flex items-center justify-between">
                <Icon className="h-6 w-6 text-green-700" aria-hidden="true" />
                <span className="text-xs font-bold tracking-[0.16em] text-slate-400">{number}</span>
              </div>
              <h3 className="mt-8 text-xl font-bold text-[#061E35]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
              {index < steps.length - 1 && <FiArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 bg-white text-green-700 lg:block" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
