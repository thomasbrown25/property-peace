'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FiArrowRight, FiBookOpen, FiClock } from 'react-icons/fi';
import {
  resourceEntries,
  getResourceHref,
  resourceTopics,
  resourceTypeIcons,
  type ResourceTopic,
} from '@/lib/resource-library';

export default function ResourceLibrary() {
  const [activeTopic, setActiveTopic] = useState<ResourceTopic>('All resources');

  const visibleResources = useMemo(
    () =>
      activeTopic === 'All resources'
        ? resourceEntries
        : resourceEntries.filter((resource) => resource.topic === activeTopic),
    [activeTopic],
  );

  return (
    <section id="resource-library" className="bg-brand-forest px-4 py-16 text-white sm:px-6 lg:px-8 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 border-b border-white/15 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-brand-mint">Browse the library</p>
            <h2 className="text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>
              Practical answers for the next landlord task
            </h2>
            <p className="mt-4 text-lg leading-8 text-white/80">
              Start with the job in front of you. Every resource is organized around a real rental workflow, not a product feature list.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
            <FiBookOpen className="h-4 w-4 text-brand-mint" />
            <span aria-live="polite">{visibleResources.length} resources</span>
          </div>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2" role="group" aria-label="Filter resources by topic">
            {resourceTopics.map((topic) => {
              const selected = activeTopic === topic;
              return (
                <button
                  key={topic}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActiveTopic(topic)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-mint ${
                    selected
                      ? 'border-brand-mint bg-brand-mint text-brand-forest shadow-sm'
                      : 'border-brand-mint bg-brand-surface text-brand-slate hover:border-brand-mint hover:bg-brand-ivory hover:text-brand-teal'
                  }`}
                >
                  {topic}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visibleResources.map((resource) => {
            const TypeIcon = resourceTypeIcons[resource.type];
            return (
              <article key={resource.slug} className="group flex h-full flex-col border border-brand-mint bg-brand-surface p-6 transition duration-200 hover:-translate-y-1 hover:border-brand-teal hover:shadow-xl">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand-ivory px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">
                    <TypeIcon className="h-3.5 w-3.5" />
                    {resource.type}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-slate">
                    <FiClock className="h-3.5 w-3.5" />
                    {resource.readTime}
                  </span>
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-slate">{resource.topic}</p>
                <h3 className="text-xl font-bold leading-snug text-brand-forest transition-colors group-hover:text-brand-teal" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>
                  {resource.title}
                </h3>
                <p className="mt-3 flex-1 leading-7 text-brand-slate">{resource.description}</p>
                <Link href={getResourceHref(resource)} className="mt-6 inline-flex min-h-11 items-center gap-2 border-t border-brand-mint pt-4 font-bold text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal">
                  {resource.type === 'Download' ? 'Open downloads' : 'Read resource'}
                  <FiArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
