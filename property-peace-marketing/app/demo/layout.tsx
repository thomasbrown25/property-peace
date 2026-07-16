import type { Metadata } from 'next';
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/demo/', {
  title: 'Simplify Your Property Management | Property Peace',
  description: 'Book a Property Peace demo to see how small landlords can simplify rent, maintenance, leases, tenants, expenses, and documents in one calm dashboard.',
  alternates: {
    canonical: '/demo',
  },
});

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
