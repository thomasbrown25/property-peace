"use client";

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiCalendar, FiRss, FiBookOpen, FiZap, FiCheckCircle } from 'react-icons/fi';

const CATEGORY_COLORS: Record<string, string> = {
  'How-To':        '#16a34a',
  'Guides':        '#16a34a',
  'Updates':       '#16a34a',
  'Trends':        '#16a34a',
  'Location-Based':'#16a34a',
  'Reviews':       '#16a34a',
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? '#16a34a';
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
      <div className="relative overflow-hidden bg-white">

        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-green-50/80 via-white to-white" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 md:pt-32 pb-14 text-center">
          <div
            className="inline-flex items-center gap-2 bg-green-50 border border-green-500/20 text-green-600 text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full mb-6 shadow-sm"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            <FiBookOpen className="w-3.5 h-3.5" />
            Resources &amp; Guides
          </div>

          <h1
            className="text-4xl md:text-6xl font-bold text-primary-main mb-5 leading-tight"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            Property Management <span className="text-green-600">Blog</span>
          </h1>

          <p
            className="text-lg text-[#737373] max-w-2xl mx-auto mb-8 leading-relaxed"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Educational guides and practical insights for landlords managing 1–50 rental units. Put what you learn into organized records; when opened, the limited Percy Pilot can review supported current context read-only, without taking actions.
          </p>

          <div
            className="flex items-center justify-center gap-5 text-sm text-[#737373]"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            <span className="text-[#737373]">{posts.length} articles</span>
            <span className="text-[#B5B5B5]">·</span>
            <Link
              href="/rss.xml"
              className="flex items-center gap-1.5 text-green-600 hover:text-green-700 transition-colors font-medium"
            >
              <FiRss className="w-3.5 h-3.5" />
              RSS Feed
            </Link>
          </div>
        </div>

        {/* Category filter bar */}
        <div
          style={{
            background: '#ffffff',
            borderTop: '1px solid #E5E5E5',
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
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'text-[#516A80] hover:text-green-600 hover:bg-green-50'
                  }`}
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  {cat}
                  <span
                    className={`ml-1.5 text-xs ${
                      activeCategory === cat ? 'text-white/75' : 'text-[#8A8A8A]'
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
      <div className="bg-white">
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
                <p className="text-[#516A80]" style={{ fontFamily: '"Inter", sans-serif' }}>
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
                      <div className="relative overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(10,45,82,0.12)]">
                        {/* Dot grid */}
                        <div
                          className="absolute inset-0 pointer-events-none opacity-[0.05]"
                          style={{
                            backgroundImage: 'radial-gradient(circle, #16a34a 1px, transparent 1px)',
                            backgroundSize: '24px 24px',
                          }}
                        />

                        <div className="relative p-8 md:p-12 md:flex md:items-center md:gap-12">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-4">
                              <span
                                className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-green-600/10 border border-green-600/15"
                                style={{ fontFamily: '"Inter", sans-serif', color: '#16a34a' }}
                              >
                                {featured.category}
                              </span>
                              <span
                                className="text-xs text-[#8A8A8A]"
                                style={{ fontFamily: '"Inter", sans-serif' }}
                              >
                                Latest
                              </span>
                            </div>

                            <h2
                              className="text-2xl md:text-3xl font-bold text-primary-main mb-4 leading-snug transition-colors group-hover:text-green-600"
                              style={{ fontFamily: '"Poppins", sans-serif' }}
                            >
                              {featured.title}
                            </h2>

                            <p
                              className="text-[#737373] leading-relaxed mb-6 max-w-2xl"
                              style={{ fontFamily: '"Inter", sans-serif' }}
                            >
                              {featured.description}
                            </p>

                            <div
                              className="flex items-center gap-4 text-sm text-[#8A8A8A]"
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

                          <div className="hidden md:flex items-center justify-center w-16 h-16 rounded-2xl bg-white flex-shrink-0 transition-all duration-300 group-hover:bg-green-600/10 group-hover:translate-x-1">
                            <FiArrowRight className="w-7 h-7 text-green-600" />
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
                    className="mb-10 overflow-hidden rounded-2xl border border-green-100 bg-green-50/40"
                  >
                    <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_0.7fr] md:items-center md:p-8">
                      <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-green-600 shadow-sm" style={{ fontFamily: '"Inter", sans-serif' }}>
                          <FiZap className="h-3.5 w-3.5" />
                          Put the guides into action
                        </div>
                        <h2 className="mb-3 text-2xl font-bold text-primary-main md:text-3xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
                          Managing rentals while reading these guides?
                        </h2>
                        <p className="max-w-2xl text-[#516A80] leading-relaxed" style={{ fontFamily: '"Inter", sans-serif' }}>
                          Property Peace helps independent landlords track rent records, manage leases, track maintenance, and stay organized without rebuilding another spreadsheet.
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-5 shadow-[0_14px_34px_rgba(10,45,82,0.08)]">
                        <ul className="mb-5 space-y-3 text-sm text-[#516A80]" style={{ fontFamily: '"Inter", sans-serif' }}>
                          <li className="flex gap-2"><FiCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />Free for up to 5 units</li>
                          <li className="flex gap-2"><FiCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />Built for landlords with 1–50 units</li>
                          <li className="flex gap-2"><FiCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />Rent, leases, tenants, and maintenance together</li>
                        </ul>
                        <Link href="https://app.propertypeace.io/register" className="inline-flex w-full items-center justify-center gap-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700" style={{ fontFamily: '"Inter", sans-serif' }}>
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
                      className="text-sm font-medium text-[#8fa8c0]"
                      style={{ fontFamily: '"Inter", sans-serif' }}
                    >
                      {activeCategory === 'All' ? 'More articles' : `All ${activeCategory} articles`}
                    </p>
                    <div className="flex-1 h-px bg-green-50/50" />
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
                          <div className="h-full flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:shadow-[0_8px_28px_rgba(10,45,82,0.09)] hover:-translate-y-0.5">
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
                              className="text-[17px] font-bold text-primary-main mb-3 line-clamp-3 leading-snug group-hover:text-[#15803d] transition-colors"
                              style={{ fontFamily: '"Poppins", sans-serif' }}
                            >
                              {post.title}
                            </h2>

                            {/* Description */}
                            <p
                              className="text-sm text-[#516A80] mb-5 flex-grow line-clamp-4 leading-relaxed"
                              style={{ fontFamily: '"Inter", sans-serif' }}
                            >
                              {post.description}
                            </p>

                            {/* Footer */}
                            <div
                              className="flex items-center justify-between pt-4 border-t border-[#f0f5fb] text-xs text-[#8fa8c0]"
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
                  <div className="relative mt-12 bg-[#061e35] overflow-hidden rounded-2xl p-8 text-center text-white md:p-10">
                    <h2 className="mb-3 text-2xl font-bold md:text-3xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
                      Ready to stop managing rentals from scattered notes?
                    </h2>
                    <p className="mx-auto mb-6 max-w-2xl text-white/70" style={{ fontFamily: '"Inter", sans-serif' }}>
                      Start with the guide that fits your problem, then use Property Peace to organize the actual workflow.
                    </p>
                    <Link href="https://app.propertypeace.io/register" className="inline-flex items-center gap-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-7 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700 hover:shadow-[0_10px_24px_rgba(34,197,94,0.25)]" style={{ fontFamily: '"Inter", sans-serif' }}>
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
