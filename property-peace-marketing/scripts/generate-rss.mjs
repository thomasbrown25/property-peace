import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = 'https://propertypeace.io';
const currentDate = new Date().toUTCString();

// Only articles with dated editorial review and official sources are published.
const blogPosts = [
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
