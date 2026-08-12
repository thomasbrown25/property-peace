import Link from 'next/link';
import { FiArrowUpRight, FiClock, FiMessageSquare, FiTool } from 'react-icons/fi';

const workflows = [
  {
    icon: FiMessageSquare,
    title: 'Tenant conversation attention',
    body: 'Surface urgent signals from supported in-app conversation records so you can review the conversation.',
    evidence: 'Evidence: in-app conversation category',
    href: '/features/tenant-communication',
    link: 'Explore tenant communication',
  },
  {
    icon: FiTool,
    title: 'Maintenance triage',
    body: 'Review current requests by recorded status, priority, and age. Percy does not diagnose repairs or dispatch vendors.',
    evidence: 'Evidence: maintenance request category',
    href: '/features/maintenance-tracking',
    link: 'Explore maintenance tracking',
  },
  {
    icon: FiClock,
    title: 'Lease and deadline visibility',
    body: 'Surface upcoming lease starts, expirations, and supported signature-status tasks in a portfolio briefing.',
    evidence: 'Evidence: lease workflow category',
    href: '/features/lease-management',
    link: 'Explore lease management',
  },
];

export default function PercyWorkflows() {
  return (
    <section className="bg-[#061E35] px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-300">Representative pilot workflows</p>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>A clearer view across three everyday pressure points.</h2>
          <p className="mt-4 leading-7 text-slate-300">These examples describe limited-pilot visibility, not automated actions.</p>
        </div>
        <div className="mt-10 grid gap-px bg-white/15 lg:grid-cols-3">
          {workflows.map(({ icon: Icon, title, body, evidence, href, link }) => (
            <article key={title} className="flex flex-col bg-[#0A2945] p-6 sm:p-8">
              <Icon className="h-7 w-7 text-green-300" aria-hidden="true" />
              <h3 className="mt-7 text-xl font-bold">{title}</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-300">{body}</p>
              <p className="mt-6 border-l-2 border-green-400 pl-3 text-xs font-semibold text-green-100">{evidence}</p>
              <Link href={href} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white underline decoration-green-400 underline-offset-4">
                {link} <FiArrowUpRight aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
