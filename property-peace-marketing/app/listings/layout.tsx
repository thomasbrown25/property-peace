import type { Metadata } from "next";
import { applyOttoSeo } from '@/lib/otto-seo';

export const metadata: Metadata = applyOttoSeo('/listings/', {
  title: "Rental Listing Software | Property Peace",
  description: "Create shareable rental listings, collect applications online, and keep leasing workflows connected in Property Peace.",
  keywords: "rental listing software, landlord listings, online rental applications, property peace",
  alternates: {
    canonical: "/listings",
  },
});

export default function ListingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
