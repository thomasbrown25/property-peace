import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { FiArrowRight } from 'react-icons/fi';
import ResourceLibrary from './ResourceLibrary';
import { getResourceHref, resourceEntries } from '@/lib/resource-library';
import { getAllBlogPosts } from '@/lib/blog-posts';
import { getArticleEditorial } from '@/lib/article-editorial';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/resources/', {
  title: 'Landlord Guides & Checklists | Property Peace',
  description: 'Practical landlord guides and checklists for tenant screening, leases, rent tracking, accounting, maintenance, and move-in workflows.',
  keywords: 'landlord resources, landlord guides, rental property checklist, property management education, small landlord tools',
  alternates: { canonical: '/resources' },
  openGraph: {
    title: 'Landlord Resource Center | Property Peace',
    description: 'Practical guides and checklists organized around the rental jobs independent landlords handle every day.',
    type: 'website',
  },
});

const articleImages: Record<string, string> = {
  'landlord-move-in-move-out-checklist': '/images/resources/landlord-move.png',
  'rental-property-cash-flow-template-landlords': '/images/resources/what-landlords-track.png',
  'landlord-maintenance-checklist-prevent-costly-repairs': '/images/landing/maintenance-tracking-hero.jpg',
};

const collectionSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Property Peace Landlord Resource Center',
  description: 'Practical landlord guides and checklists organized by rental workflow.',
  url: 'https://propertypeace.io/resources/',
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: resourceEntries.map((resource, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `https://propertypeace.io${getResourceHref(resource)}/`,
      name: resource.title,
    })),
  },
};

export default function ResourcesPage() {
  const articles = getAllBlogPosts()
    .filter((post) => getArticleEditorial(post.slug))
    .slice(0, 3);

  return (
    <main className="min-h-screen bg-[#061E35] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />

      <section data-marketing-hero-theme="dark" className="relative flex min-h-[440px] items-center overflow-hidden bg-[#061E35] px-4 pb-20 pt-36 text-center text-white sm:px-6 md:min-h-[480px] md:pb-24 md:pt-40 lg:px-8">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/resources/hero.png)' }} aria-hidden="true" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,#061E35_0%,rgba(6,30,53,0.92)_24%,rgba(6,30,53,0.73)_64%,rgba(6,30,53,0.74)_100%)]" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold leading-tight text-green-400 sm:text-5xl md:text-6xl" style={{ fontFamily: '"Poppins", sans-serif' }}>Resources</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/90 md:text-xl" style={{ fontFamily: '"Inter", sans-serif' }}>
            Practical guides and thoughtful advice for managing your properties, staying organized, and making the everyday work a little easier.
          </p>
        </div>
      </section>

      <section className="bg-[#061E35] px-4 pb-20 pt-8 text-white sm:px-6 md:pb-28 md:pt-12 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-4xl text-3xl font-bold leading-tight text-white md:text-4xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
            Resources to help you run your properties
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/80 md:text-lg">Start with a practical article, then explore guides and checklists for the work ahead.</p>
          <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-5">
            {articles.map((article) => (
              <article key={article.slug} className="group min-w-0">
                <Link href={`/blog/${article.slug}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-400">
                  <div className="relative aspect-[16/9] overflow-hidden bg-[#263e52]">
                    <Image
                      src={articleImages[article.slug]}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <h3 className="mt-4 text-lg font-bold leading-snug text-white transition-colors group-hover:text-green-300" style={{ fontFamily: '"Poppins", sans-serif' }}>
                    {article.title}
                  </h3>
                </Link>
              </article>
            ))}
          </div>
          <Link href="/blog" className="mt-8 inline-flex min-h-11 items-center gap-2 font-bold text-green-300 transition hover:text-green-200">
            Browse all articles <FiArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <ResourceLibrary />

      <section className="relative flex min-h-[480px] items-center overflow-hidden bg-[#061E35] px-4 py-24 text-center text-white sm:px-6 md:min-h-[520px] lg:px-8">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/cta/cta.png)' }} aria-hidden="true" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,#061E35_0%,rgba(6,30,53,0.85)_25%,rgba(6,30,53,0.70)_70%,rgba(6,30,53,0.78)_100%)]" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
            Ready to spend less time <span className="text-green-400">juggling the details</span> and more time on your properties?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/90 md:text-lg">See how Property Peace brings everyday rental work into one calm place.</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link href="/demo" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-bold uppercase tracking-wide text-[#061E35] transition hover:bg-white/90 sm:w-auto">Book a demo</Link>
            <Link href="https://app.propertypeace.io/register" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-green-600 px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-green-500 sm:w-auto">Start free</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
