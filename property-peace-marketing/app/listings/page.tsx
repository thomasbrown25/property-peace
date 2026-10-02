import Link from "next/link";
import Image from "next/image";
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
    <div className="min-h-screen bg-[#061E35] w-full min-w-0 text-white">
      <main>
        <section className="relative overflow-hidden bg-[#061E35] pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat lg:bg-[position:center_55%]"
            style={{ backgroundImage: 'url(/images/listings/hero.png)' }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(to_top,#061E35_0%,rgba(6,30,53,0.98)_20%,rgba(6,30,53,0.82)_58%,rgba(6,30,53,0.72)_100%)] sm:bg-[linear-gradient(to_top,#061E35_0%,rgba(6,30,53,0.98)_18%,rgba(6,30,53,0.72)_60%,rgba(6,30,53,0.62)_100%)]"
            aria-hidden="true"
          />
          <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6" style={{ fontFamily: '"Poppins", sans-serif' }}>
                Create rental listings without creating extra work.
              </h1>
              <p className="text-lg md:text-xl text-white/75 max-w-2xl mb-8" style={{ fontFamily: '"Inter", sans-serif' }}>
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

            <Image
              src="/images/listings/hero-right.png"
              alt="Property Peace listing and leasing dashboard preview"
              width={1598}
              height={1245}
              priority
              sizes="(max-width: 1023px) 100vw, 45vw"
              className="block h-auto w-full border border-white/20 shadow-[0_22px_70px_rgba(0,0,0,0.35)]"
            />
          </div>
        </section>

        <section className="bg-[#061E35] py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-3xl mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: '"Poppins", sans-serif' }}>
                Listings that fit your leasing process
              </h2>
              <p className="text-lg text-white/75" style={{ fontFamily: '"Inter", sans-serif' }}>
                This marketing page does not show live rentals. Property Peace creates shareable listing pages, but it does not currently syndicate listings to Zillow, Apartments.com, Realtor.com, or other listing networks.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listingFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="rounded-2xl border border-white/5 bg-[#263e52] p-6 shadow-sm transition-colors hover:bg-[#304b60]">
                    <div className="mb-4 flex items-center gap-4">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#061E35]">
                        <Icon className="h-5 w-5 text-green-400" />
                      </div>
                      <h3 className="text-lg font-bold leading-snug text-white" style={{ fontFamily: '"Poppins", sans-serif' }}>
                        {feature.title}
                      </h3>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
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
