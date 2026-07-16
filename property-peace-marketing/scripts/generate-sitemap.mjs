import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = 'https://propertypeace.io';
const currentDate = new Date().toISOString().split('T')[0];

// Define all static pages
const staticPages = [
  { url: '', priority: '1.0', changefreq: 'weekly' },
  { url: 'features', priority: '0.9', changefreq: 'monthly' },
  { url: 'pricing', priority: '0.9', changefreq: 'monthly' },
  { url: 'blog', priority: '0.8', changefreq: 'weekly' },
  { url: 'landlord-software', priority: '0.9', changefreq: 'monthly' },
  { url: 'free-landlord-software', priority: '0.9', changefreq: 'monthly' },
  { url: 'property-management-software-for-small-landlords', priority: '0.9', changefreq: 'monthly' },
  { url: 'property-management-app', priority: '0.9', changefreq: 'monthly' },
  { url: 'rental-management-software', priority: '0.9', changefreq: 'monthly' },
  { url: 'small-landlord-tools', priority: '0.9', changefreq: 'monthly' },
  { url: 'rent-collection-software-for-landlords', priority: '0.9', changefreq: 'monthly' },
  { url: 'maintenance-request-software-for-landlords', priority: '0.9', changefreq: 'monthly' },
  { url: 'landlord-accounting-software', priority: '0.9', changefreq: 'monthly' },
  { url: 'property-management-spreadsheet-alternative', priority: '0.9', changefreq: 'monthly' },
  { url: 'help-center', priority: '0.8', changefreq: 'monthly' },
  { url: 'contact-us', priority: '0.8', changefreq: 'monthly' },
  { url: 'demo', priority: '0.8', changefreq: 'monthly' },
  { url: 'terms', priority: '0.5', changefreq: 'yearly' },
  { url: 'privacy', priority: '0.5', changefreq: 'yearly' },
  { url: 'sitemap', priority: '0.4', changefreq: 'monthly' },
  { url: 'maintenance/ai-maintenance', priority: '0.8', changefreq: 'monthly' },
  { url: 'maintenance/in-app-messaging', priority: '0.8', changefreq: 'monthly' },
  { url: 'lease/ai-lease-creation', priority: '0.8', changefreq: 'monthly' },
  { url: 'lease/e-sign-docusign', priority: '0.8', changefreq: 'monthly' },
  { url: 'lease/online-condition-reports', priority: '0.8', changefreq: 'monthly' },
  { url: 'rent/accounting', priority: '0.8', changefreq: 'monthly' },
  { url: 'rent/custom-late-fees', priority: '0.8', changefreq: 'monthly' },
  { url: 'rent/expense-tracking', priority: '0.8', changefreq: 'monthly' },
  { url: 'rent/rent-reporting', priority: '0.8', changefreq: 'monthly' },
  { url: 'lease-shield/blog', priority: '0.7', changefreq: 'weekly' },
];

// Comparison pages
const comparisonPages = [
  'brownstone-hub-vs-buildium',
  'brownstone-hub-vs-doorloop',
  'brownstone-hub-vs-appfolio',
];

// Feature detail pages (must match app/features/[slug])
const featureSlugs = [
  'ai-copilot',
  'all-in-one-dashboard',
  'property-management',
  'lease-management',
  'maintenance-tracking',
  'rent-collection',
  'financial-reports',
  'tenant-communication',
  'document-management',
  'rental-applications',
  'payment-processing',
  'real-time-communication',
  'automation',
  'lease-shield',
];

// Blog posts - full list from lib/blog-posts.ts (add new slugs when publishing)
const blogSlugs = [
  'how-to-choose-property-management-software-for-small-landlords',
  'property-management-software-vs-spreadsheets',
  'essential-features-landlord-software',
  'streamline-rent-collection-property-management-software',
  'property-management-software-small-apartment-buildings',
  'best-property-management-app-solo-landlords',
  'manage-multiple-rental-properties',
  'online-rent-collection-property-management-software',
  'property-management-software-charlotte-nc',
  'how-to-screen-tenants-complete-guide',
  'property-management-software-pricing-2024',
  'best-property-management-software-airbnb-hosts',
  'how-to-handle-maintenance-requests-like-pro',
  'property-management-software-vs-hiring-property-manager',
  'tax-deductions-landlords-complete-guide',
  'how-to-write-lease-agreement-landlord-guide',
  'property-management-software-reviews-top-10-2024',
  'how-to-increase-rental-property-roi-software',
  'property-management-software-trends-2025',
  'property-management-software-austin-texas',
  'prepare-rental-properties-2025-tax-season',
  'property-management-software-whats-new-2025',
  'scale-rental-property-business-2025',
  'how-to-automate-rent-collection-never-chase-payments-again',
];

function generateSitemap() {
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Add static pages
  staticPages.forEach(page => {
    const url = page.url ? `${baseUrl}/${page.url}/` : `${baseUrl}/`;
    sitemap += `  <url>
    <loc>${url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  });

  // Add comparison pages
  comparisonPages.forEach(slug => {
    sitemap += `  <url>
    <loc>${baseUrl}/comparison/${slug}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  });

  // Add feature detail pages
  featureSlugs.forEach(slug => {
    sitemap += `  <url>
    <loc>${baseUrl}/features/${slug}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  });

  // Add blog posts
  blogSlugs.forEach(slug => {
    sitemap += `  <url>
    <loc>${baseUrl}/blog/${slug}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  });

  sitemap += `</urlset>`;

  // Write to public directory
  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap);
  console.log('Sitemap generated successfully at public/sitemap.xml');
}

generateSitemap();
