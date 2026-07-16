import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBlogPost, getAllBlogPosts } from '@/lib/blog-posts';
import { FiArrowLeft, FiCalendar, FiUser, FiClock, FiArrowRight, FiZap, FiList, FiCheckCircle, FiFileText } from 'react-icons/fi';
import StructuredData from '@/components/SEO/StructuredData';

const CATEGORY_COLORS: Record<string, string> = {
  'How-To':         '#16a34a',
  'Guides':         '#16a34a',
  'Updates':        '#16a34a',
  'Trends':         '#16a34a',
  'Location-Based': '#16a34a',
  'Reviews':        '#16a34a',
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? '#16a34a';
}

type BlogCta = {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  label: string;
};

function slugifyHeading(text: string) {
  return text
    .replace(/<[^>]*>/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractHeadings(content: string) {
  return content
    .split('\n')
    .map((line) => line.trim().match(/^##\s+(.+)/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .slice(0, 8)
    .map((match) => ({ text: match[1].replace(/\*\*(.+?)\*\*/g, '$1'), id: slugifyHeading(match[1]) }));
}

function getPostCta(post: ReturnType<typeof getBlogPost>): BlogCta {
  const fallback: BlogCta = {
    eyebrow: 'Free landlord software',
    title: 'Put this guide into action with Property Peace',
    body: 'Collect rent, track maintenance, store leases, and manage tenant communication from one simple dashboard.',
    href: 'https://app.propertypeace.io/register',
    label: 'Get Started Free',
  };

  if (!post) return fallback;

  const text = `${post.slug} ${post.title} ${post.description} ${post.keywords}`.toLowerCase();

  if (text.includes('lease') || text.includes('docusign')) {
    return {
      eyebrow: 'Lease workflow',
      title: 'Create, store, and manage leases in one place',
      body: 'Use Property Peace to keep lease documents organized, track renewals, and move from signed agreement to tenant management faster.',
      href: '/features/lease-management',
      label: 'See Lease Management',
    };
  }

  if (text.includes('maintenance')) {
    return {
      eyebrow: 'Maintenance tracking',
      title: 'Stop losing maintenance requests in texts and emails',
      body: 'Let tenants submit requests with photos, track status, and keep every repair organized by property.',
      href: '/features/maintenance-tracking',
      label: 'See Maintenance Tracking',
    };
  }

  if (text.includes('rent') || text.includes('payment')) {
    return {
      eyebrow: 'Online rent collection',
      title: 'Make rent collection easier this month',
      body: 'Send reminders, accept online payments, track overdue rent, and keep payment history organized automatically.',
      href: '/features/rent-collection',
      label: 'See Rent Collection',
    };
  }

  if (text.includes('tax') || text.includes('roi') || text.includes('financial') || text.includes('cash flow')) {
    return {
      eyebrow: 'Financial reporting',
      title: 'Know which properties are actually profitable',
      body: 'Track income, expenses, reports, and property-level performance without rebuilding spreadsheets every month.',
      href: '/features/financial-reports',
      label: 'See Financial Reports',
    };
  }

  if (text.includes('tenant') || text.includes('screen')) {
    return {
      eyebrow: 'Tenant management',
      title: 'Keep tenant workflows organized from application to move-out',
      body: 'Centralize applications, communication, documents, and tenant details so nothing slips through the cracks.',
      href: '/features/tenant-communication',
      label: 'See Tenant Tools',
    };
  }

  if (text.includes('scale') || text.includes('multiple') || text.includes('automation')) {
    return {
      eyebrow: 'Scale with systems',
      title: 'Manage more rentals without adding more chaos',
      body: 'Property Peace helps growing landlords replace scattered spreadsheets with repeatable workflows across every property.',
      href: 'https://app.propertypeace.io/register',
      label: 'Start Free',
    };
  }

  return fallback;
}

export async function generateStaticParams() {
  const posts = getAllBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderContent(content: string) {
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  let inList = false;
  let listItems: string[] = [];
  let listKey = 0;

  const inlineFormat = (text: string) => {
    const out = text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-primary-main">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(
        /\[(.+?)\]\((.+?)\)/g,
        '<a href="$2" class="text-[#16a34a] hover:text-[#0a2d52] underline underline-offset-4 decoration-[#16a34a]/30 hover:decoration-[#0a2d52] transition-colors">$1</a>'
      );
    return out;
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="mb-7 space-y-3 pl-0">
          {listItems.map((item, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3 text-[#405a70] leading-[1.85] text-[17px]"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              <span
                className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: '#16a34a' }}
              />
              <span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed === '') {
      if (inList) flushList();
      return;
    }

    // Headers
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      if (inList) flushList();
      const level = hMatch[1].length;
      const text = hMatch[2];
      const headingId = level === 2 ? slugifyHeading(text) : undefined;

      const headingClass: Record<number, string> = {
        1: 'text-2xl md:text-3xl font-bold text-primary-main mt-12 mb-5 pb-3 border-b border-slate-200',
        2: 'text-xl md:text-2xl font-bold text-primary-main mt-10 mb-4',
        3: 'text-lg font-semibold text-primary-main mt-8 mb-3',
        4: 'text-base font-semibold text-primary-main mt-6 mb-2',
        5: 'text-sm font-semibold text-primary-main mt-4 mb-2 uppercase tracking-wide',
        6: 'text-sm font-semibold text-[#516A80] mt-4 mb-2',
      };

      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      elements.push(
        <Tag
          key={index}
          id={headingId}
          className={`${headingClass[level] ?? headingClass[2]} scroll-mt-28`}
          style={{ fontFamily: '"Poppins", sans-serif' }}
          dangerouslySetInnerHTML={{ __html: inlineFormat(text) }}
        />
      );
      return;
    }

    // List items
    if (trimmed.startsWith('- ')) {
      inList = true;
      listItems.push(trimmed.slice(2));
      return;
    }

    if (inList) flushList();

    elements.push(
      <p
        key={index}
        className="mb-6 text-[#405a70] leading-[1.9] text-[17px]"
        style={{ fontFamily: '"Inter", sans-serif' }}
        dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }}
      />
    );
  });

  if (inList) flushList();

  return elements;
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) notFound();

  const allPosts = getAllBlogPosts();
  const related = allPosts
    .filter((p) => p.slug !== post.slug && p.category === post.category)
    .slice(0, 2);

  const readingTime = Math.max(1, Math.ceil(post.content.split(' ').length / 200));
  const color = categoryColor(post.category);
  const headings = extractHeadings(post.content);
  const cta = getPostCta(post);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    author: { '@type': 'Organization', name: post.author },
    datePublished: post.date,
    publisher: {
      '@type': 'Organization',
      name: 'Property Peace',
      logo: { '@type': 'ImageObject', url: 'https://propertypeace.io/images/logos/logo-with-text.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://propertypeace.io/blog/${post.slug}` },
  };

  const faqStructuredData =
    post.faqs && post.faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer },
          })),
        }
      : null;

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-white">

        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-green-50/80 via-white to-white" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-[#516A80] hover:text-green-600 transition-colors mb-10 text-sm font-medium"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            <FiArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>

          {/* Category */}
          <div className="mb-5">
            <span
              className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full border"
              style={{
                fontFamily: '"Inter", sans-serif',
                color,
                background: `${color}18`,
                borderColor: `${color}40`,
              }}
            >
              {post.category}
            </span>
          </div>

          {/* Title */}
          <h1
            className="text-3xl md:text-5xl font-bold text-primary-main mb-5 leading-tight max-w-3xl"
            style={{ fontFamily: '"Poppins", sans-serif' }}
          >
            {post.title}
          </h1>

          {/* Description */}
          <p
            className="text-[#737373] text-lg leading-relaxed max-w-2xl mb-8"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            {post.description}
          </p>

          {/* Meta row */}
          <div
            className="flex flex-wrap items-center gap-5 text-sm text-[#737373]"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            <span className="flex items-center gap-1.5">
              <FiCalendar className="w-3.5 h-3.5" />
              {new Date(post.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="text-[#B5B5B5]">·</span>
            <span className="flex items-center gap-1.5">
              <FiUser className="w-3.5 h-3.5" />
              {post.author}
            </span>
            <span className="text-[#B5B5B5]">·</span>
            <span className="flex items-center gap-1.5">
              <FiClock className="w-3.5 h-3.5" />
              {readingTime} min read
            </span>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={cta.href}
              className="inline-flex items-center gap-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-950/20 transition-all hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              <FiZap className="h-4 w-4" />
              {cta.label}
            </Link>
            <a
              href="#article"
              className="inline-flex items-center gap-2 rounded-none border border-[#E5E5E5] bg-white px-5 py-3 text-sm font-semibold text-primary-main transition-all hover:border-green-300 hover:text-green-600"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Read the guide
              <FiArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* ── Article body ──────────────────────────────────────────────────── */}
      <div className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
          <div className="lg:grid lg:grid-cols-[minmax(0,760px)_320px] lg:gap-10">
            <main id="article" className="min-w-0">
              <div className="mb-10 rounded-2xl border border-green-100 bg-green-50/40 p-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-[#16a34a] shadow-sm">
                    <FiFileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#16a34a]" style={{ fontFamily: '"Inter", sans-serif' }}>
                      Quick takeaway
                    </p>
                    <p className="text-[17px] leading-relaxed text-[#405a70]" style={{ fontFamily: '"Inter", sans-serif' }}>
                      Use this guide to make a better decision, then turn the advice into a repeatable rental workflow inside Property Peace.
                    </p>
                  </div>
                </div>
              </div>

              <article className="article-content">{renderContent(post.content)}</article>

              <div className="my-14 rounded-3xl border border-green-100 bg-gradient-to-br from-[#f7fbff] to-white p-7 md:p-8 shadow-[0_18px_50px_rgba(10,45,82,0.07)]">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#16a34a]" style={{ fontFamily: '"Inter", sans-serif' }}>
                  {cta.eyebrow}
                </p>
                <h2 className="mb-3 text-2xl font-bold text-primary-main md:text-3xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
                  {cta.title}
                </h2>
                <p className="mb-6 max-w-2xl text-[17px] leading-relaxed text-[#405a70]" style={{ fontFamily: '"Inter", sans-serif' }}>
                  {cta.body}
                </p>
                <Link href={cta.href} className="inline-flex items-center gap-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-green-100 transition-all hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700" style={{ fontFamily: '"Inter", sans-serif' }}>
                  {cta.label}
                  <FiArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* FAQs */}
              {post.faqs && post.faqs.length > 0 && (
                <div className="mt-14">
                  <h2
                    className="text-2xl font-bold text-primary-main mb-8"
                    style={{ fontFamily: '"Poppins", sans-serif' }}
                  >
                    Frequently Asked Questions
                  </h2>
                  <div className="space-y-4">
                    {post.faqs.map((faq, i) => (
                      <div key={i} className="rounded-2xl p-6" style={{ background: '#f4f8fc', border: '1px solid #e2ecf6' }}>
                        <h3
                          className="text-base font-semibold text-primary-main mb-2"
                          style={{ fontFamily: '"Poppins", sans-serif' }}
                        >
                          {faq.question}
                        </h3>
                        <p
                          className="text-[15px] text-[#405a70] leading-relaxed"
                          style={{ fontFamily: '"Inter", sans-serif' }}
                        >
                          {faq.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="relative bg-[#061e35] mt-14 overflow-hidden rounded-2xl p-10 text-center">
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                  <FiZap className="w-6 h-6 text-white" />
                </div>
                <h2
                  className="text-2xl md:text-3xl font-bold text-white mb-3"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  Ready to streamline your properties?
                </h2>
                <p
                  className="text-white/65 mb-7 max-w-md mx-auto leading-relaxed"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  Free for up to 2 units. No credit card required.
                </p>
                <Link
                  href="https://app.propertypeace.io/register"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-none font-semibold transition-all duration-300 hover:from-green-600 hover:to-green-700 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(34,197,94,0.25)] shadow-lg"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  <FiZap className="w-4 h-4" />
                  Get Started Free
                </Link>
              </div>

              {/* Related posts */}
              {related.length > 0 && (
                <div className="mt-14">
                  <div className="flex items-center gap-3 mb-6">
                    <p
                      className="text-sm font-medium text-[#8fa8c0] whitespace-nowrap"
                      style={{ fontFamily: '"Inter", sans-serif' }}
                    >
                      More {post.category} articles
                    </p>
                    <div className="flex-1 h-px bg-green-50/50" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    {related.map((rp) => (
                      <Link key={rp.slug} href={`/blog/${rp.slug}`} className="block group">
                        <div className="h-full flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:shadow-[0_8px_28px_rgba(10,45,82,0.09)] hover:-translate-y-0.5">
                          <div
                            className="w-7 h-0.5 rounded-full mb-3"
                            style={{ background: color }}
                          />
                          <h3
                            className="text-base font-bold text-primary-main mb-2 leading-snug group-hover:text-[#15803d] transition-colors line-clamp-3"
                            style={{ fontFamily: '"Poppins", sans-serif' }}
                          >
                            {rp.title}
                          </h3>
                          <p
                            className="text-sm text-[#516A80] leading-relaxed flex-grow line-clamp-3 mb-4"
                            style={{ fontFamily: '"Inter", sans-serif' }}
                          >
                            {rp.description}
                          </p>
                          <div
                            className="flex items-center justify-between text-xs text-[#8fa8c0]"
                            style={{ fontFamily: '"Inter", sans-serif' }}
                          >
                            <span className="flex items-center gap-1.5">
                              <FiCalendar className="w-3 h-3" />
                              {new Date(rp.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                            <FiArrowRight
                              className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1"
                              style={{ color }}
                            />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </main>

            <aside className="mt-12 lg:mt-0">
              <div className="sticky top-24 space-y-5">
                {headings.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(10,45,82,0.06)]">
                    <div className="mb-4 flex items-center gap-2 text-sm font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>
                      <FiList className="h-4 w-4 text-[#16a34a]" />
                      In this guide
                    </div>
                    <nav className="space-y-2" aria-label="Table of contents">
                      {headings.map((heading) => (
                        <a key={heading.id} href={`#${heading.id}`} className="block rounded-none px-3 py-2 text-sm leading-snug text-[#516A80] transition-colors hover:bg-green-50/40 hover:text-[#15803d]" style={{ fontFamily: '"Inter", sans-serif' }}>
                          {heading.text}
                        </a>
                      ))}
                    </nav>
                  </div>
                )}

                <div className="relative bg-[#061e35] overflow-hidden rounded-2xl p-6 text-white shadow-[0_18px_50px_rgba(6,30,53,0.2)]">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-green-300" style={{ fontFamily: '"Inter", sans-serif' }}>
                    {cta.eyebrow}
                  </p>
                  <h3 className="mb-3 text-xl font-bold leading-tight" style={{ fontFamily: '"Poppins", sans-serif' }}>
                    {cta.title}
                  </h3>
                  <p className="mb-5 text-sm leading-relaxed text-white/70" style={{ fontFamily: '"Inter", sans-serif' }}>
                    {cta.body}
                  </p>
                  <Link href={cta.href} className="inline-flex w-full items-center justify-center gap-2 rounded-none bg-gradient-to-r from-green-500 to-green-600 px-4 py-3 text-sm font-bold text-white transition-all hover:from-green-600 hover:to-green-700" style={{ fontFamily: '"Inter", sans-serif' }}>
                    {cta.label}
                    <FiArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-green-50/40 p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>
                    <FiCheckCircle className="h-4 w-4 text-[#16a34a]" />
                    Why landlords use Property Peace
                  </div>
                  <ul className="space-y-3 text-sm leading-relaxed text-[#516A80]" style={{ fontFamily: '"Inter", sans-serif' }}>
                    <li>Free for up to 2 rental units</li>
                    <li>Built for independent landlords</li>
                    <li>Rent, leases, maintenance, and tenants together</li>
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <StructuredData data={structuredData} />
      {faqStructuredData && <StructuredData data={faqStructuredData} />}
    </>
  );
}
