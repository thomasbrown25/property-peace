import type { Metadata } from 'next';

type OttoSeoOverride = {
  title?: string;
  description?: string;
  canonical?: string;
  openGraphTitle?: string;
  openGraphDescription?: string;
  openGraphUrl?: string;
  twitterTitle?: string;
  twitterDescription?: string;
};

const ottoSeoOverrides: Record<string, OttoSeoOverride> = {
  '/': {
    title: '#1 Free Rental Management Software | Property Peace',
    description: 'The #1 free rental management software for independent landlords. Manage rent, tenants, leases, maintenance, and expenses in one calm dashboard. No credit card required.',
    canonical: 'https://propertypeace.io/',
    openGraphTitle: '#1 Free Rental Management Software | Property Peace',
    twitterTitle: '#1 Free Rental Management Software | Property Peace',
  },
  '/blog/': {
    openGraphUrl: 'https://propertypeace.io/blog/',
    twitterTitle: 'Manage Rentals Smarter: Free Software for 1-50 Units!',
  },
  '/resources/': {
    title: 'Landlord Guides & Checklists | Property Peace',
    description: 'Practical landlord guides and checklists for tenant screening, leases, rent tracking, accounting, maintenance, and move-in workflows.',
    canonical: 'https://propertypeace.io/resources/',
    openGraphTitle: 'Landlord Resource Center | Property Peace',
    openGraphDescription: 'Practical guides and checklists organized around the rental jobs independent landlords handle every day.',
    openGraphUrl: 'https://propertypeace.io/resources/',
  },
  '/contact-us/': {
    title: 'Contact Property Peace: Support & Inquiries',
    description: 'Contact Property Peace for 24/7 support. Reach us at support@propertypeace.io for product questions, billing help, demo requests, and landlord software support.',
    canonical: 'https://propertypeace.io/contact-us/',
    openGraphUrl: 'https://propertypeace.io/contact-us/',
  },
  '/demo/': {
    title: 'Book a Property Management Demo | Property Peace',
    description: 'Book a Property Peace demo to see rent, maintenance, and lease workflows, plus Percy-assisted tools currently available through the limited Percy Pilot.',
    openGraphTitle: 'Manage Properties Easily: Try Property Peace Free',
  },
  '/features/': {
    title: 'Property Management Software Features: Streamline Your Landlord Tasks | Property Peace',
    description: 'Explore Property Peace tools for rent tracking, maintenance, leases, applications, and accounting, plus portfolio summaries in the limited Percy Pilot.',
    canonical: 'https://propertypeace.io/features',
    twitterTitle: 'Property Peace: Simplify Landlord Life. Free Plan! #PropTech',
    twitterDescription: 'Simplify rent, leases, maintenance & expenses. Property Peace: your calm dashboard for 1-50 units. Start free! #LandlordLife',
  },
  '/features/ai-summaries/': {
    title: 'AI Summaries: Simplify Your Property Management | Property Peace',
    description: 'Try plain-English portfolio summaries through the limited Percy Pilot, with Percy-assisted views of rent, maintenance, and tenant activity.',
    openGraphDescription: 'Explore Percy-assisted portfolio summaries, currently available through the limited Percy Pilot, alongside Property Peace management tools.',
    twitterDescription: 'Explore Percy-assisted portfolio summaries for rent, maintenance, leases, and more through the limited Percy Pilot. #PropertyManagement',
  },
  '/features/all-in-one-dashboard/': {
    description: 'Property Peace dashboard: Real-time overview of properties, tenants, leases & finances. Simple management for independent landlords.',
    canonical: 'https://propertypeace.io/features/all-in-one-dashboard',
    openGraphDescription: "Manage your rentals effortlessly! Property Peace's dashboard offers independent landlords a real-time overview of properties, tenants, leases & finances.",
    twitterDescription: 'Simplify property management! Real-time overview of properties, tenants, leases & finances in one dashboard. #LandlordLife',
  },
  '/features/automation/': {
    description: 'Property Peace automation: Streamline rent, leases & maintenance with smart reminders. Simple tools for independent landlords. Get your weekends back.',
    canonical: 'https://propertypeace.io/features/automation',
    openGraphDescription: 'Automate rent reminders, lease expirations & maintenance follow-ups. Property Peace: Simple, smart property management for independent landlords.',
  },
  '/features/document-management/': {
    description: 'Property Peace: Secure cloud storage for all property documents. Simple management for independent landlords. Learn more.',
    canonical: 'https://propertypeace.io/features/document-management',
    openGraphDescription: 'Securely store & organize all your property docs in the cloud! Property Peace offers simple, bloat-free management for independent landlords.',
  },
  '/features/financial-reports/': {
    canonical: 'https://propertypeace.io/features/financial-reports',
  },
  '/features/lease-management/': {
    canonical: 'https://propertypeace.io/features/lease-management',
  },
  '/features/lease-shield/': {
    canonical: 'https://propertypeace.io/features/lease-shield/',
    openGraphTitle: 'LeaseShield: AI Legal Answers for Small Landlords',
  },
  '/features/maintenance-tracking/': {
    description: 'Property Peace: Streamline tenant maintenance requests & track work orders. Simple tools for independent landlords. Learn more.',
    canonical: 'https://propertypeace.io/features/maintenance-tracking',
    openGraphDescription: 'Tired of maintenance chaos? Property Peace simplifies tenant requests & work orders. Manage repairs efficiently, not with enterprise bloat.',
    twitterDescription: 'Simplify tenant maintenance & track work orders. Simple property tools for landlords, no enterprise bloat. #LandlordLife',
  },
  '/features/payment-processing/': {
    title: 'Online Rent Payments Roadmap | Property Peace',
    description: 'Online rent payment processing is not currently available in Property Peace. Use the live rent ledger, payment-history, late-fee, and reminder tools today.',
    canonical: 'https://propertypeace.io/features/payment-processing',
    openGraphDescription: 'Online payment processing is planned, not currently available. Property Peace currently provides rent tracking, payment records, late fees, and reminder workflows.',
    twitterDescription: 'Online payment processing is planned, not currently available. Track rent records, balances, late fees, and reminders today.',
  },
  '/features/property-management/': {
    canonical: 'https://propertypeace.io/features/property-management',
    openGraphDescription: 'Simplify property management for independent landlords. Organize leases, rent, maintenance & more with Property Peace – your calm in the chaos.',
  },
  '/features/rent-collection/': {
    title: 'Rent Tracking and Reminder Software | Property Peace',
    description: 'Track recorded rent payments, overdue balances, late fees, and reminders. Online payment processing is not currently available.',
    canonical: 'https://propertypeace.io/features/rent-collection',
  },
  '/features/rent-estimate/': {
    description: 'Property Peace rent estimates: Instant, data-driven pricing for landlords. Optimize income with accurate rent ranges. Simple property management.',
    openGraphDescription: 'Price your rental perfectly! Get instant, data-driven rent estimates for your property with Property Peace. Simple tools for independent landlords.',
  },
  '/features/real-time-communication/': {
    description: 'Property Peace: Instant tenant messaging with SignalR. Simple property management for landlords. No enterprise bloat.',
    canonical: 'https://propertypeace.io/features/real-time-communication',
    openGraphDescription: 'Real-time tenant messaging for landlords. Property Peace offers simple, bloat-free property management tools.',
  },
  '/features/rental-applications/': {
    canonical: 'https://propertypeace.io/features/rental-applications',
  },
  '/features/tenant-communication/': {
    description: 'Keep tenant communication organized with in-app and email notifications. SMS delivery depends on account and messaging configuration.',
    canonical: 'https://propertypeace.io/features/tenant-communication',
    openGraphDescription: 'Connect with tenants through in-app and email notifications; SMS availability depends on messaging configuration.',
  },
  '/free-landlord-software/': {
    title: '#1 Free Rental Management Software | Property Peace',
    description: 'The #1 free rental management software for small landlords. Manage rent, tenants, leases, maintenance, and expenses with no credit card required.',
    openGraphTitle: '#1 Free Rental Management Software | Property Peace',
    twitterTitle: '#1 Free Rental Management Software | Property Peace',
    twitterDescription: 'Manage rent, tenants, leases, maintenance, and expenses with the #1 free rental management software for small landlords.',
  },
  '/help-center/': {
    title: 'Property Peace Help Center: Support & FAQs for Landlords',
    canonical: 'https://propertypeace.io/help-center/',
    openGraphUrl: 'https://propertypeace.io/help-center/',
  },
  '/landlord-accounting-software/': {
    title: 'Landlord Accounting Software: Simplify Rental Finances | Property Peace',
    description: 'Property Peace landlord accounting: Simplify rent, expenses, and tax records for 1–50 units. Track performance & prepare taxes. Start free.',
    openGraphTitle: 'Simplify Rental Finances with Property Peace Software',
  },
  '/landlord-software/': {
    canonical: 'https://propertypeace.io/landlord-software/',
    openGraphTitle: 'Smart Landlord Software: Manage 1-50 Units Free',
    openGraphUrl: 'https://propertypeace.io/landlord-software/',
  },
  '/lease-shield/blog/': {
    openGraphTitle: 'Landlord Legal Risk Reduced with LeaseShield Examples',
  },
  '/listings/': {
    openGraphTitle: 'Create Shareable Rental Listings & Collect Applications Fast',
    twitterTitle: 'Manage Properties Effortlessly: Landlord Software for All!',
    twitterDescription: 'Streamline rent, tenants, leases & expenses! Property Peace is your calm dashboard for 1-50 units. Start free. #LandlordLife',
  },
  '/maintenance/ai-maintenance/': {
    description: 'Organize maintenance requests, priorities, and vendor records, with Percy-assisted maintenance tools currently offered through the limited Percy Pilot.',
    openGraphUrl: 'https://propertypeace.io/maintenance/ai-maintenance/',
    twitterTitle: 'Manage Rentals Effortlessly: Landlord Software for 1-50',
  },
  '/maintenance-request-software-for-landlords/': {
    title: 'Streamline Maintenance Requests: Organize Repairs & History | Property Peace',
    description: 'Organize tenant maintenance requests, photos, and repair history in one landlord dashboard. Property Peace: streamline repairs for small rental owners. Start',
    twitterTitle: 'Landlord Maintenance Software: Simplify Requests Now!',
    twitterDescription: 'Organize tenant maintenance, photos, and history in one dashboard. Built for small landlords. Start free! #PropertyManagement',
  },
  '/pricing/': {
    title: 'Property Peace Pricing: Free Plan & Premium Features',
    description: 'Start free with landlord software for up to 5 units. Upgrade for unlimited units, LeaseShield, AI tools, rent workflows, and financial reports.',
    canonical: 'https://propertypeace.io/pricing',
    openGraphTitle: 'Property Peace Pricing: Free Plan & Premium Features',
    twitterTitle: 'Property Peace: Manage 1-50 Units FREE! #LandlordLife',
  },
  '/privacy/': {
    canonical: 'https://propertypeace.io/privacy/',
    openGraphUrl: 'https://propertypeace.io/privacy/',
  },
  '/property-management-app/': {
    canonical: 'https://propertypeace.io/property-management-app/',
    openGraphUrl: 'https://propertypeace.io/property-management-app/',
  },
  '/property-management-software-for-small-landlords/': {
    title: 'Property Management Software for Small Landlords | Property Peace',
    description: 'Property Peace software for small landlords (1-50 units). Organize rent, tenants, leases, maintenance & expenses. Try our free plan today!',
    openGraphTitle: 'Organize Your Rentals: Simple Software for Small Landlords',
  },
  '/rent-collection-software-for-landlords/': {
    title: 'Rent Collection Software for Landlords | Property Peace',
    description: 'Property Peace: Track rent, reminders, & tenant records. Manage payments, overdue balances easily. Start free for small landlords.',
    twitterDescription: 'Simplify rent tracking, reminders & payments for your rental business. Manage tenants easily. Start free! #LandlordLife',
  },
  '/rental-management-software/': {
    canonical: 'https://propertypeace.io/rental-management-software/',
  },
  '/rent/rent-reporting/': {},
  '/sitemap/': {
    title: 'Property Peace Sitemap: Navigate All Features and Resources',
    canonical: 'https://propertypeace.io/sitemap/',
    openGraphUrl: 'https://propertypeace.io/sitemap/',
    twitterTitle: 'Manage 1-50 Units: Try Property Peace Free! #Landlord',
    twitterDescription: 'Manage rent, tenants, leases, maintenance, & expenses easily! Property Peace for small landlords. Start free!',
  },
  '/small-landlord-tools/': {
    canonical: 'https://propertypeace.io/small-landlord-tools/',
    openGraphUrl: 'https://propertypeace.io/small-landlord-tools/',
  },
  '/terms/': {
    title: 'Property Peace Terms of Use',
    canonical: 'https://propertypeace.io/terms/',
    openGraphUrl: 'https://propertypeace.io/terms/',
    twitterTitle: 'Property Peace Terms of Use: Your Guide to Our Software',
  },
};

const blogTitleOverrides: Record<string, string> = {
  '/blog/property-management-software-austin-texas/': 'Property Management Software for Austin Landlords | Property Peace',
  '/blog/property-management-software-vs-spreadsheets/': 'Property Management Software vs. Spreadsheets for Landlords | Property Peace',
  '/blog/property-management-software-charlotte-nc/': 'Property Management Software Guide for Charlotte Landlords | Property Peace',
  '/blog/landlord-move-in-move-out-checklist/': 'Landlord Move-In & Move-Out Checklist: Property Peace Guide',
};

const blogCanonicalPaths = [
  '/blog/manage-multiple-rental-properties/',
  '/blog/tax-deductions-landlords-complete-guide/',
  '/blog/how-to-screen-tenants-complete-guide/',
  '/blog/property-management-software-whats-new-2025/',
  '/blog/best-property-management-app-solo-landlords/',
  '/blog/how-to-choose-property-management-software-for-small-landlords/',
  '/blog/property-management-software-small-apartment-buildings/',
  '/blog/how-to-handle-maintenance-requests-like-pro/',
  '/blog/property-management-software-austin-texas/',
  '/blog/online-rent-collection-property-management-software/',
  '/blog/rental-property-cash-flow-template-landlords/',
  '/blog/how-to-increase-rental-property-roi-software/',
  '/blog/property-management-software-pricing-2024/',
  '/blog/property-management-software-vs-spreadsheets/',
  '/blog/prepare-rental-properties-2025-tax-season/',
  '/blog/property-management-software-trends-2025/',
  '/blog/best-property-management-software-airbnb-hosts/',
  '/blog/how-to-write-lease-agreement-landlord-guide/',
  '/blog/landlord-maintenance-checklist-prevent-costly-repairs/',
  '/blog/scale-rental-property-business-2025/',
  '/blog/essential-features-landlord-software/',
  '/blog/property-management-software-charlotte-nc/',
  '/blog/property-management-software-reviews-top-10-2024/',
  '/blog/property-management-software-vs-hiring-property-manager/',
  '/blog/streamline-rent-collection-property-management-software/',
  '/blog/landlord-move-in-move-out-checklist/',
];

for (const path of blogCanonicalPaths) {
  ottoSeoOverrides[path] = {
    ...(ottoSeoOverrides[path] ?? {}),
    title: blogTitleOverrides[path] ?? ottoSeoOverrides[path]?.title,
    canonical: `https://propertypeace.io${path}`,
    openGraphUrl: `https://propertypeace.io${path}`,
  };
}

function candidatePaths(path: string) {
  const leading = path.startsWith('/') ? path : `/${path}`;
  const withoutQuery = leading.split(/[?#]/)[0];
  const noTrailing = withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery;
  const trailing = noTrailing === '/' ? '/' : `${noTrailing}/`;
  return [withoutQuery, trailing, noTrailing];
}

export function getOttoSeo(path: string): OttoSeoOverride | undefined {
  for (const candidate of candidatePaths(path)) {
    const override = ottoSeoOverrides[candidate];
    if (override) return override;
  }
  return undefined;
}

export function applyOttoSeo(path: string, metadata: Metadata = {}): Metadata {
  const override = getOttoSeo(path);
  if (!override) return metadata;

  const title = override.title ?? metadata.title;
  const description = override.description ?? metadata.description;
  const openGraphTitle = override.openGraphTitle ?? metadata.openGraph?.title ?? title;
  const openGraphDescription = override.openGraphDescription ?? metadata.openGraph?.description ?? description;
  const openGraphUrl = override.openGraphUrl ?? override.canonical ?? metadata.openGraph?.url;
  const twitterTitle = override.twitterTitle ?? metadata.twitter?.title ?? title;
  const twitterDescription = override.twitterDescription ?? metadata.twitter?.description ?? description;

  return {
    ...metadata,
    title,
    description,
    alternates: {
      ...metadata.alternates,
      ...(override.canonical ? { canonical: override.canonical } : {}),
    },
    openGraph: {
      ...metadata.openGraph,
      ...(openGraphTitle ? { title: openGraphTitle } : {}),
      ...(openGraphDescription ? { description: openGraphDescription } : {}),
      ...(openGraphUrl ? { url: openGraphUrl } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...metadata.twitter,
      ...(twitterTitle ? { title: twitterTitle } : {}),
      ...(twitterDescription ? { description: twitterDescription } : {}),
    },
  };
}
