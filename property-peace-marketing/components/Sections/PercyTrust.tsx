import { FiCheck, FiExternalLink, FiEye, FiLock } from 'react-icons/fi';

const trustPoints = [
  { icon: FiExternalLink, title: 'Source-linked context', body: 'Percy links answers to the supported Property Peace workflow categories it checked—not external authorities or invented citations.' },
  { icon: FiEye, title: 'Read-only pilot', body: 'Current Percy chat can summarize and answer supported questions. It cannot send, sign, pay, update, or execute changes.' },
  { icon: FiLock, title: 'Permissions and scope', body: 'Percy works within supported Property Peace records and the access available to the signed-in user.' },
  { icon: FiCheck, title: 'The landlord decides', body: 'You review the context and choose the next step in the underlying property-management workflow.' },
];

export default function PercyTrust() {
  return (
    <section className="bg-[#F4F8F5] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-700">Built for review</p>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] text-[#061E35] sm:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Useful context, with honest boundaries.</h2>
          <p className="mt-5 text-base leading-7 text-slate-600">Provider-dependent sending, signing, payment, screening, and external-listing actions are not Percy capabilities today.</p>
          <div className="mt-6 border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <strong>Provider readiness:</strong> availability in Property Peace varies by workflow and configuration. Percy Pilot access is limited and is not promised as a plan entitlement.
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {trustPoints.map(({ icon: Icon, title, body }) => (
            <div key={title} className="border border-slate-200 bg-white p-5 sm:p-6">
              <Icon className="h-5 w-5 text-green-700" aria-hidden="true" />
              <h3 className="mt-4 font-bold text-[#061E35]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
