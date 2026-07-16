import type { Metadata } from "next";
import { getBlogPost } from '@/lib/blog-posts';
import { applyOttoSeo } from '@/lib/otto-seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {
      title: 'Blog Post Not Found | Brownstone Hub',
    };
  }

  return applyOttoSeo(`/blog/${slug}/`, {
    title: `${post.title} | Brownstone Hub Blog`,
    description: post.description,
    keywords: post.keywords,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  });
}

export default function BlogPostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
