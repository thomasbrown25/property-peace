"use client";

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiCalendar, FiRss, FiBookOpen, FiZap, FiCheckCircle } from 'react-icons/fi';

const CATEGORY_COLORS: Record<string, string> = {
  'How-To':        'var(--brand-teal)',
  'Guides':        'var(--brand-teal)',
  'Updates':       'var(--brand-teal)',
  'Trends':        'var(--brand-teal)',
  'Location-Based':'var(--brand-teal)',
  'Reviews':       'var(--brand-teal)',
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? 'var(--brand-teal)';
}

interface PublishedBlogSummary {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  category: string;
}

export default function BlogPageClient({ posts }: { posts: PublishedBlogSummary[] }) {
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(posts.map((p) => p.category)))],
    [posts]
  );

  const filtered = useMemo(
    () => (activeCategory === 'All' ? posts : posts.filter((p) => p.category === activeCategory)),
    [posts, activeCategory]
  );

  const countFor = (cat: string) =>
    cat === 'All' ? posts.length : posts.filter((p) => p.category === cat).length;

  const [featured, ...rest] = filtered;

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-brand-forest text-white">

        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[color-mix(in_srgb,var(--brand-teal-hover)_20%,transparent)] via-brand-forest to-brand-forest" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 md:pt-32 pb-14 text-center">
          <div
            className="inline-flex items-center gap-2 bg-brand-mint border border-[color:color-mix(in_srgb,var(--brand-teal)_20%,transparent)] text-brand-teal text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full mb-6 shadow-sm"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            <FiBookOpen className="w-3.5 h-3.5" />
            Resources &amp; Guides
          </div>

          <h1
            className="text-4xl md:text-6xl font-extrabold text-white mb-5 leading-tight"
            style={{ fontFamily: '"Host Grotesk", sans-serif' }}
          >
            Property Management <span className="text-brand-mint">Blog</span>
          </h1>

          <p
            className="text-lg text-white/80 max-w-2xl mx-auto mb-8 leading-relaxed"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Expert guides, tips, and insights for landlords managing 1–50 rental units.
          </p>

          <div
            className="flex items-center justify-center gap-5 text-sm text-white/80"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            <span className="text-white/80">{posts.length} articles</span>
            <span className="text-[#B5B5B5]">·</span>
            <Link
              href="/rss.xml"
              className="flex items-center gap-1.5 text-brand-mint hover:text-brand-mint transition-colors font-medium"
            >
              <FiRss className="w-3.5 h-3.5" />
              RSS Feed
            </Link>
          </div>
        </div>

        {/* Category filter bar */}
        <div
          style={{
            background: 'var(--brand-forest)',
            borderTop: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex gap-2 flex-wrap justify-center">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-sm font-medium px-4 py-1.5 rounded-full transition-all duration-200 ${
                    activeCategory === cat
                      ? 'bg-brand-teal text-white shadow-sm'
                      : 'text-white/80 hover:text-brand-mint hover:bg-white/10'
                  }`}
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  {cat}
                  <span
                    className={`ml-1.5 text-xs ${
                      activeCategory === cat ? 'text-white/75' : 'text-white/65'
                    }`}
                  >
                    {countFor(cat)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Posts ────────────────────────────────────────────────────────── */}
      <div className="bg-brand-forest text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <AnimatePresence mode="wait">
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-20"
              >
                <p className="text-white/80" style={{ fontFamily: '"Inter", sans-serif' }}>
                  No articles in this category yet.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Featured post */}
                {featured && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mb-8"
                  >
                    <Link href={`/blog/${featured.slug}`} className="block group">
                      <div className="relative overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-brand-surface text-brand-forest transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(16,44,41,0.12)]">
                        {/* Dot grid */}
                        <div
                          className="absolute inset-0 pointer-events-none opacity-[0.05]"
                          style={{
                            backgroundImage: 'radial-gradient(circle, var(--brand-teal) 1px, transparent 1px)',
                            backgroundSize: '24px 24px',
                          }}
                        />

                        <div className="relative p-8 md:p-12 md:flex md:items-center md:gap-12">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-4">
                              <span
                                className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-[color-mix(in_srgb,var(--brand-teal)_10%,transparent)] border border-[color:color-mix(in_srgb,var(--brand-teal)_15%,transparent)]"
                                style={{ fontFamily: '"Inter", sans-serif', color: 'var(--brand-teal)' }}
                              >
                                {featured.category}
                              </span>
                              <span
                                className="text-xs text-brand-slate"
                                style={{ fontFamily: '"Inter", sans-serif' }}
                              >
                                Latest
                              </span>
                            </div>

                            <h2
                              className="text-2xl md:text-3xl font-extrabold text-primary-main mb-4 leading-snug transition-colors group-hover:text-brand-teal"
                              style={{ fontFamily: '"Host Grotesk", sans-serif' }}
                            >
                              {featured.title}
                            </h2>

                            <p
                              className="text-brand-slate leading-relaxed mb-6 max-w-2xl"
                              style={{ fontFamily: '"Inter", sans-serif' }}
                            >
                              {featured.description}
                            </p>

                            <div
                              className="flex items-center gap-4 text-sm text-brand-slate"
                              style={{ fontFamily: '"Inter", sans-serif' }}
                            >
                              <span className="flex items-center gap-1.5">
                                <FiCalendar className="w-3.5 h-3.5" />
                                {new Date(featured.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                              <span>·</span>
                              <span>{featured.author}</span>
                            </div>
                          </div>

                          <div className="hidden md:flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-surface flex-shrink-0 transition-all duration-300 group-hover:bg-[color-mix(in_srgb,var(--brand-teal)_10%,transparent)] group-hover:translate-x-1">
                            <FiArrowRight className="w-7 h-7 text-brand-teal" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )}

                {/* Conversion CTA */}
                {activeCategory === 'All' && (
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.08 }}
                    className="mb-10 overflow-hidden rounded-2xl border border-brand-mint bg-brand-surface text-brand-forest"
                  >
                    <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_0.7fr] md:items-center md:p-8">
                      <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--brand-teal)_20%,transparent)] bg-brand-mint px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand-teal shadow-sm" style={{ fontFamily: '"Inter", sans-serif' }}>
                          <FiZap className="h-3.5 w-3.5" />
                          Put the guides into action
                        </div>
                        <h2 className="mb-3 text-2xl font-extrabold text-primary-main md:text-3xl" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>
                          Managing rentals while reading these guides?
                        </h2>
                        <p className="max-w-2xl text-brand-slate leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                          Property Peace helps independent landlords track rent records, manage leases, track maintenance, and stay organized without rebuilding another spreadsheet.
                        </p>
                      </div>
                      <div className="rounded-2xl bg-brand-surface p-5 shadow-[0_14px_34px_rgba(16,44,41,0.08)]">
                        <ul className="mb-5 space-y-3 text-sm text-brand-slate" style={{ fontFamily: '"Inter", sans-serif' }}>
                          <li className="flex gap-2"><FiCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-teal" />Free for up to 5 units</li>
                          <li className="flex gap-2"><FiCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-teal" />Built for landlords with 1–50 units</li>
                          <li className="flex gap-2"><FiCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-teal" />Rent, leases, tenants, and maintenance together</li>
                        </ul>
                        <Link href="https://app.propertypeace.io/register" className="inline-flex w-full items-center justify-center gap-2 rounded-none bg-gradient-to-r from-brand-teal to-brand-teal px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:from-brand-teal hover:to-brand-teal-hover" style={{ fontFamily: '"Inter", sans-serif' }}>
                          Start Free
                          <FiArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Results label */}
                {rest.length > 0 && (
                  <div className="flex items-center gap-3 mb-6">
                    <p
                      className="text-sm font-medium text-white/80"
                      style={{ fontFamily: '"Inter", sans-serif' }}
                    >
                      {activeCategory === 'All' ? 'More articles' : `All ${activeCategory} articles`}
                    </p>
                    <div className="flex-1 h-px bg-[color-mix(in_srgb,var(--brand-mint)_50%,transparent)]" />
                  </div>
                )}

                {/* Grid */}
                {rest.length > 0 && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {rest.map((post, index) => (
                      <motion.article
                        key={post.slug}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: index * 0.04 }}
                      >
                        <Link href={`/blog/${post.slug}`} className="block h-full group">
                          <div className="h-full flex flex-col rounded-2xl border border-[var(--brand-border)] bg-brand-surface p-6 text-brand-forest transition-all duration-200 hover:shadow-[0_8px_28px_rgba(16,44,41,0.09)] hover:-translate-y-0.5">
                            {/* Accent bar */}
                            <div
                              className="w-8 h-0.5 rounded-full mb-4"
                              style={{ background: categoryColor(post.category) }}
                            />

                            {/* Category */}
                            <span
                              className="text-xs font-semibold tracking-wide uppercase mb-2"
                              style={{
                                fontFamily: '"Inter", sans-serif',
                                color: categoryColor(post.category),
                              }}
                            >
                              {post.category}
                            </span>

                            {/* Title */}
                            <h2
                              className="text-[17px] font-extrabold text-primary-main mb-3 line-clamp-3 leading-snug group-hover:text-brand-teal transition-colors"
                              style={{ fontFamily: '"Host Grotesk", sans-serif' }}
                            >
                              {post.title}
                            </h2>

                            {/* Description */}
                            <p
                              className="text-sm text-brand-slate mb-5 flex-grow line-clamp-4 leading-relaxed"
                              style={{ fontFamily: '"Inter", sans-serif' }}
                            >
                              {post.description}
                            </p>

                            {/* Footer */}
                            <div
                              className="flex items-center justify-between pt-4 border-t border-brand-ivory text-xs text-[var(--brand-border)]"
                              style={{ fontFamily: '"Inter", sans-serif' }}
                            >
                              <span className="flex items-center gap-1.5">
                                <FiCalendar className="w-3 h-3" />
                                {new Date(post.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                              <FiArrowRight
                                className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1"
                                style={{ color: categoryColor(post.category) }}
                              />
                            </div>
                          </div>
                        </Link>
                      </motion.article>
                    ))}
                  </div>
                )}
                {rest.length > 0 && activeCategory === 'All' && (
                  <div className="relative mt-12 bg-brand-forest overflow-hidden rounded-2xl p-8 text-center text-white md:p-10">
                    <h2 className="mb-3 text-2xl font-extrabold md:text-3xl" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>
                      Ready to stop managing rentals from scattered notes?
                    </h2>
                    <p className="mx-auto mb-6 max-w-2xl text-white/70" style={{ fontFamily: '"Inter", sans-serif' }}>
                      Start with the guide that fits your problem, then use Property Peace to organize the actual workflow.
                    </p>
                    <Link href="https://app.propertypeace.io/register" className="inline-flex items-center gap-2 rounded-none bg-gradient-to-r from-brand-teal to-brand-teal px-7 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:from-brand-teal hover:to-brand-teal-hover hover:shadow-[0_10px_24px_rgba(36,117,104,0.25)]" style={{ fontFamily: '"Inter", sans-serif' }}>
                      Get Started Free
                      <FiArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
