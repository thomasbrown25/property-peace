import { FiAlertCircle, FiClock, FiMessageSquare, FiTool } from 'react-icons/fi';

const attentionItems = [
  {
    icon: FiClock,
    label: 'Lease deadline',
    title: 'Lease expiration coming up',
    detail: '12 days · 18 Willow Street',
    source: 'Lease record',
  },
  {
    icon: FiMessageSquare,
    label: 'Urgent conversation',
    title: 'Tenant message needs review',
    detail: 'Water reported near the electrical panel',
    source: 'In-app conversation',
  },
  {
    icon: FiTool,
    label: 'Maintenance status',
    title: 'High-priority request is still open',
    detail: 'Open 3 days · 42 Pine Avenue',
    source: 'Maintenance request',
  },
];

export default function PercyTodayPreview() {
  return (
    <aside className="w-full border border-white/15 bg-white p-4 shadow-[0_28px_80px_rgba(0,0,0,0.24)] sm:p-6" aria-label="Representative Percy briefing">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">Representative preview</p>
          <h2 className="mt-1 text-xl font-bold text-[#061E35]" style={{ fontFamily: '"Poppins", sans-serif' }}>Percy today</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
          <FiAlertCircle aria-hidden="true" /> Limited pilot
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {attentionItems.map(({ icon: Icon, label, title, detail, source }) => (
          <div key={label} className="border border-slate-200 bg-slate-50 p-4">
            <div className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#061E35] text-green-300">
                <Icon aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-green-700">{label}</p>
                <p className="mt-1 text-sm font-bold text-[#061E35]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
                <p className="mt-2 text-[11px] font-semibold text-slate-500">Source: {source}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Illustrative content based on supported record categories. Percy chat is read-only.</p>
    </aside>
  );
}
