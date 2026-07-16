import Link from "next/link";
import { FiCamera, FiCheckCircle, FiFileText, FiLink, FiSend, FiUsers } from "react-icons/fi";

const listingFeatures = [
  {
    title: "Build polished rental listings",
    description: "Add rent, availability, photos, amenities, and unit details once inside your landlord workspace.",
    icon: FiCamera,
  },
  {
    title: "Share one clean listing link",
    description: "Send prospects a public page that keeps your property details consistent everywhere you promote it.",
    icon: FiLink,
  },
  {
    title: "Collect applications online",
    description: "Move interested renters from a listing into your application workflow without duplicate data entry.",
    icon: FiFileText,
  },
  {
    title: "Track interest from one place",
    description: "Keep listing activity, applicant details, and follow-up steps connected to the right property and unit.",
    icon: FiUsers,
  },
  {
    title: "Publish when you are ready",
    description: "Draft listings privately, review the details, then publish and unpublish as availability changes.",
    icon: FiSend,
  },
  {
    title: "Connect leasing workflows",
    description: "Turn a renter from prospect to applicant to tenant without jumping between disconnected tools.",
    icon: FiCheckCircle,
  },
];

export default function ListingsPage() {
  return (
    <div className="min-h-screen bg-white w-full min-w-0">
      <main>
        <section className="relative overflow-hidden bg-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-green-50/80 via-white to-white" />
          <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
            <div>
              <p className="mb-5 inline-flex items-center rounded-full border border-green-500/20 bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-green-600" style={{ fontFamily: '"Inter", sans-serif' }}>
                Rental listing software
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-main leading-tight mb-6" style={{ fontFamily: '"Poppins", sans-serif' }}>
                Create rental listings without creating extra work.
              </h1>
              <p className="text-lg md:text-xl text-[#737373] max-w-2xl mb-8" style={{ fontFamily: '"Inter", sans-serif' }}>
                Property Peace helps landlords turn property and unit details into shareable rental listings, then keep applications and leasing steps connected in the same workflow.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="https://app.propertypeace.io/register"
                  className="inline-flex justify-center px-7 py-3.5 rounded-none bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold hover:from-green-600 hover:to-green-700 hover:shadow-[0_10px_24px_rgba(34,197,94,0.25)] transition-colors"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  Start for free
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex justify-center px-7 py-3.5 rounded-none bg-white text-primary-main font-semibold border border-slate-200 shadow-sm hover:border-green-200 transition-colors"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  Book a demo
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-[#E5E5E5] overflow-hidden">
              <div className="h-48 bg-gradient-to-br from-green-50 via-white to-slate-50 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-white/80 shadow-sm flex items-center justify-center">
                  <FiHomePlaceholder />
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-green-600 font-semibold mb-1">Preview listing</p>
                    <h2 className="text-xl font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>
                      Sunny 2-bedroom apartment
                    </h2>
                    <p className="text-sm text-[#737373] mt-1">Photos, rent, availability, amenities, and application link in one place.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold">Ready to publish</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-xl bg-green-50 p-3"><strong className="block text-primary-main">2</strong><span className="text-[#737373]">Beds</span></div>
                  <div className="rounded-xl bg-green-50 p-3"><strong className="block text-primary-main">1</strong><span className="text-[#737373]">Bath</span></div>
                  <div className="rounded-xl bg-green-50 p-3"><strong className="block text-primary-main">$1,650</strong><span className="text-[#737373]">/mo</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-3xl mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-main mb-4" style={{ fontFamily: '"Poppins", sans-serif' }}>
                Listings that fit your leasing process
              </h2>
              <p className="text-lg text-[#737373]" style={{ fontFamily: '"Inter", sans-serif' }}>
                This marketing page does not show live rentals. Listings are a Property Peace feature landlords can use inside the app.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listingFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="rounded-2xl border border-[#E5E5E5] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="mb-4 flex items-center gap-4">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-green-50">
                        <Icon className="h-5 w-5 text-green-600" />
                      </div>
                      <h3 className="text-lg font-bold leading-snug text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>
                        {feature.title}
                      </h3>
                    </div>
                    <p className="text-sm text-[#737373] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function FiHomePlaceholder() {
  return (
    <svg className="w-12 h-12 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}
