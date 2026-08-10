import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = 'https://propertypeace.io';
const currentDate = new Date().toUTCString();

// Blog posts data - matches lib/blog-posts.ts
const blogPosts = [
  { slug: 'how-to-choose-property-management-software-for-small-landlords', title: 'How to Choose Property Management Software for Small Landlords (1-50 Units)', description: 'A comprehensive guide to selecting the right property management software for landlords managing 1-50 rental units.', date: '2024-01-15', author: 'Property Peace Team', category: 'Guides' },
  { slug: 'property-management-software-vs-spreadsheets', title: 'Property Management Software vs Spreadsheets: Which is Better for Small Landlords?', description: 'Discover why property management software beats spreadsheets for landlords managing rental properties.', date: '2024-01-22', author: 'Property Peace Team', category: 'Comparison' },
  { slug: 'essential-features-landlord-software', title: '10 Essential Features Every Landlord Software Should Have', description: 'Discover the 10 must-have features for property management software.', date: '2024-01-29', author: 'Property Peace Team', category: 'Features' },
  { slug: 'streamline-rent-collection-property-management-software', title: 'How to Streamline Rent Collection with Property Management Software', description: 'Learn how property management software automates rent collection, reduces late payments, and saves landlords time.', date: '2024-02-05', author: 'Property Peace Team', category: 'How-To' },
  { slug: 'property-management-software-small-apartment-buildings', title: 'Property Management Software for Small Apartment Buildings: Complete Guide', description: 'Complete guide to managing small apartment buildings (2-20 units) with property management software.', date: '2024-02-12', author: 'Property Peace Team', category: 'Guides' },
  { slug: 'best-property-management-app-solo-landlords', title: 'Best Property Management App for Solo Landlords: Features and Pricing', description: 'Discover the best property management app for solo landlords managing their own rental properties.', date: '2024-02-19', author: 'Property Peace Team', category: 'Reviews' },
  { slug: 'manage-multiple-rental-properties', title: 'How to Manage Multiple Rental Properties Without Losing Your Mind', description: 'Practical guide for landlords managing multiple rental properties.', date: '2024-02-26', author: 'Property Peace Team', category: 'How-To' },
  { slug: 'online-rent-collection-property-management-software', title: 'Online Rent Collection: How Property Management Software Simplifies Payments', description: 'Learn how property management software streamlines online rent collection.', date: '2024-03-05', author: 'Property Peace Team', category: 'How-To' },
  { slug: 'how-to-automate-rent-collection-never-chase-payments-again', title: 'How to Automate Rent Collection and Never Chase Payments Again', description: 'Learn how automated rent collection helps small landlords reduce late payments, send reminders, accept secure online payments, and keep rent history organized.', date: '2026-06-07T12:00:00', author: 'Property Peace Team', category: 'How-To' },
  { slug: 'landlord-move-in-move-out-checklist', title: 'Landlord Move-In and Move-Out Checklist: What to Document Before and After Tenancy', description: 'A practical move-in and move-out checklist for landlords. Learn what to inspect, document, photograph, and store so deposits, repairs, and tenant handoffs stay organized.', date: '2026-01-18', author: 'Property Peace Team', category: 'Guides' },
  { slug: 'rental-property-cash-flow-template-landlords', title: 'Rental Property Cash Flow Template: What Landlords Should Track Monthly', description: 'Learn what belongs in a rental property cash flow template, including rent, vacancies, maintenance, mortgage payments, reserves, and property-level profitability.', date: '2026-01-12', author: 'Property Peace Team', category: 'Guides' },
  { slug: 'landlord-maintenance-checklist-prevent-costly-repairs', title: 'Landlord Maintenance Checklist: Prevent Costly Repairs Before They Happen', description: 'A seasonal and monthly maintenance checklist for landlords who want to reduce emergency repairs, protect property value, and keep tenants happy.', date: '2026-01-05', author: 'Property Peace Team', category: 'How-To' },
];

function generateRSS() {
  const posts = blogPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Property Peace Blog - Property Management for Landlords</title>
    <link>${baseUrl}/blog</link>
    <description>Expert guides, tips, and insights for landlords managing rental properties. Learn about property management software, rent collection, tenant management, and more.</description>
    <language>en-US</language>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <copyright>Copyright ${new Date().getFullYear()} Property Peace</copyright>
    <managingEditor>support@propertypeace.io (Property Peace)</managingEditor>
    <webMaster>support@propertypeace.io (Property Peace)</webMaster>
`;

  posts.forEach(post => {
    const pubDate = new Date(post.date).toUTCString();
    const postUrl = `${baseUrl}/blog/${post.slug}/`;
    
    rss += `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description><![CDATA[${post.description}]]></description>
      <pubDate>${pubDate}</pubDate>
      <author>support@propertypeace.io (${post.author})</author>
      <category><![CDATA[${post.category}]]></category>
    </item>
`;
  });

  rss += `  </channel>
</rss>`;

  // Write to public directory
  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(path.join(publicDir, 'rss.xml'), rss);
  console.log('RSS feed generated successfully at public/rss.xml');
}

generateRSS();
