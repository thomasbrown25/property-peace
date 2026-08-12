const outcomes = [
  {
    title: 'Know what needs attention',
    body: 'Open a briefing to see supported lease, conversation, and maintenance signals gathered in one view.',
  },
  {
    title: 'Understand the context',
    body: 'Review concise summaries alongside links to the Property Peace workflow categories Percy checked.',
  },
  {
    title: 'Stay in control',
    body: 'Use the briefing as a starting point. Percy is read-only, so you choose the next step.',
  },
];

export default function PercyOutcomeBand() {
  return (
    <section className="border-b border-slate-200 bg-[#F4F8F5] px-4 py-10 sm:px-6 lg:px-8">
      <h2 className="sr-only">How Percy helps you stay on top of your portfolio</h2>
      <div className="mx-auto grid max-w-6xl gap-7 md:grid-cols-3 md:gap-10">
        {outcomes.map((outcome, index) => (
          <div key={outcome.title} className="grid grid-cols-[auto_1fr] gap-4">
            <span className="flex h-8 w-8 items-center justify-center border border-green-300 bg-white text-sm font-bold text-green-700">0{index + 1}</span>
            <div>
              <h3 className="text-lg font-bold text-[#061E35]" style={{ fontFamily: '"Poppins", sans-serif' }}>{outcome.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{outcome.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
