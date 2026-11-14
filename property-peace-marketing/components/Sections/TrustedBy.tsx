'use client';

export default function TrustedBy() {
  const companies = [
    { name: 'irkle™', icon: null },
    { name: 'Lum Labs', icon: 'green' },
    { name: 'Craftgram', icon: 'blue' },
    { name: 'Pulse', icon: 'red' },
    { name: 'swift >', icon: 'blue' },
    { name: 'sparkle', icon: null }
  ];

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 bg-brand-ivory">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {companies.map((company, index) => (
            <div key={index} className="flex items-center space-x-2">
              {company.icon && (
                <div className="w-4 h-4 rounded bg-brand-teal"></div>
              )}
              <div className="text-brand-slate font-semibold text-lg">
                {company.name}
              </div>
              {index < companies.length - 1 && (
                <div className="hidden md:block w-px h-6 bg-[#E5E5E5] mx-6" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
