import type { Metadata } from "next";
import BlogPageClient from './BlogPageClient';
import { applyOttoSeo } from '@/lib/otto-seo';
import { getAllBlogPosts } from '@/lib/blog-posts';
import { getArticleEditorial } from '@/lib/article-editorial';

export const metadata: Metadata = applyOttoSeo('/blog/', {
  title: "Property Management Blog for Landlords | Property Peace",
  description: "Expert guides, tips, and insights for landlords managing rental properties. Learn about property management software, rent collection, tenant management, and more.",
  keywords: "property management blog, landlord tips, rental property management guides, property management software blog, landlord resources",
  openGraph: {
    title: "Property Management Blog for Landlords | Property Peace",
    description: "Expert guides, tips, and insights for landlords managing rental properties.",
    type: 'website',
  },
  alternates: {
    canonical: '/blog',
  },
});

export default function BlogPage() {
  const posts = getAllBlogPosts()
    .filter((post) => getArticleEditorial(post.slug))
    .map(({ slug, title, description, date, author, category }) => ({
      slug,
      title,
      description,
      date,
      author,
      category,
    }));

  return <BlogPageClient posts={posts} />;
}
