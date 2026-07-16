import type { Metadata } from "next";
import BlogPageClient from './BlogPageClient';
import { applyOttoSeo } from '@/lib/otto-seo';

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
  return <BlogPageClient />;
}
