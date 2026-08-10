import type { Metadata } from "next";
import { getBlogPost } from '@/lib/blog-posts';
import { applyOttoSeo } from '@/lib/otto-seo';
import { getArticleEditorial } from '@/lib/article-editorial';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {
      title: 'Blog Post Not Found | Property Peace',
    };
  }

  const description = post.description;
  const editorial = getArticleEditorial(slug);

  return applyOttoSeo(`/blog/${slug}/`, {
    title: `${post.title} | Property Peace Blog`,
    description,
    keywords: post.keywords,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.date,
      ...(editorial ? { modifiedTime: editorial.reviewedOn } : {}),
      authors: [post.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
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
