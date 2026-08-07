import type { Metadata } from "next";

const comparisonData: Record<string, {
  title: string;
  description: string;
  metaKeywords: string;
  canonical: string;
}> = {
  'brownstone-hub-vs-buildium': {
    title: 'Buildium Alternative for Small Landlords | Property Peace',
    description: 'Compare Property Peace with Buildium. See why small landlords with 1–50 units choose a free-start, simpler rental workflow instead of enterprise property management software.',
    metaKeywords: 'Property Peace vs Buildium, Buildium alternative, property management software comparison, Buildium vs Property Peace, affordable property management software, solo landlord property management, growing portfolio management',
    canonical: 'https://propertypeace.io/comparison/brownstone-hub-vs-buildium'
  },
  'brownstone-hub-vs-doorloop': {
    title: 'DoorLoop Alternative for Small Landlords | Property Peace',
    description: 'Compare Property Peace with DoorLoop. Built for independent landlords who want rent, maintenance, leases, expenses, and Percy Pilot tools without enterprise complexity.',
    metaKeywords: 'Property Peace vs DoorLoop, DoorLoop alternative, property management software comparison, DoorLoop vs Property Peace, affordable property management software, solo landlord property management, growing portfolio management',
    canonical: 'https://propertypeace.io/comparison/brownstone-hub-vs-doorloop'
  },
  'brownstone-hub-vs-appfolio': {
    title: 'AppFolio Alternative for Small Landlords | Property Peace',
    description: 'Compare Property Peace with AppFolio. A landlord-first option for 1–50 units with simple pricing, free start, rent tools, maintenance tracking, leases, and reports.',
    metaKeywords: 'Property Peace vs AppFolio, AppFolio alternative, property management software comparison, AppFolio vs Property Peace, affordable property management software, solo landlord property management, growing portfolio management',
    canonical: 'https://propertypeace.io/comparison/brownstone-hub-vs-appfolio'
  }
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const comparison = comparisonData[slug];

  if (!comparison) {
    return {
      title: 'Comparison Not Found | Property Peace'
    };
  }

  return {
    title: comparison.title,
    description: comparison.description,
    keywords: comparison.metaKeywords + ', property management software, landlord software, rental property management, Appfolio, Buildium, DoorLoop, Yardi Breeze, Rent Manager, TenantCloud, Entrata, Innago, MRI Software, TurboTenant',
    alternates: {
      canonical: comparison.canonical
    }
  };
}

export default function ComparisonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
