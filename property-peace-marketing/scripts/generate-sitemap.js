const fs = require('fs');
const path = require('path');

const baseUrl = 'https://propertypeace.io';
const currentDate = new Date().toISOString().split('T')[0];

// Define all static pages
const staticPages = [
  { url: '', priority: '1.0', changefreq: 'weekly' },
  { url: 'features', priority: '0.9', changefreq: 'monthly' },
  { url: 'pricing', priority: '0.9', changefreq: 'monthly' },
  { url: 'blog', priority: '0.8', changefreq: 'weekly' },
  { url: 'landlord-software', priority: '0.9', changefreq: 'monthly' },
  { url: 'property-management-app', priority: '0.9', changefreq: 'monthly' },
  { url: 'rental-management-software', priority: '0.9', changefreq: 'monthly' },
  { url: 'small-landlord-tools', priority: '0.9', changefreq: 'monthly' },
];

// Comparison pages
const comparisonPages = [
  'brownstone-hub-vs-buildium',
  'brownstone-hub-vs-doorloop',
  'brownstone-hub-vs-appfolio',
];

// Blog posts
const blogPosts = require('../lib/blog-posts.ts');
const { getAllBlogPosts } = require('../lib/blog-posts.ts');

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

  // Add blog posts
  try {
    const posts = getAllBlogPosts();
    posts.forEach(post => {
      sitemap += `  <url>
    <loc>${baseUrl}/blog/${post.slug}/</loc>
    <lastmod>${post.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    });
  } catch (error) {
    console.warn('Could not load blog posts for sitemap:', error.message);
  }

  sitemap += `</urlset>`;

  // Write to public directory
  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap);
  console.log('Sitemap generated successfully at public/sitemap.xml');
}

// Handle TypeScript import issue - use dynamic require
try {
  generateSitemap();
} catch (error) {
  // Fallback: generate without blog posts if there's an issue
  console.warn('Error generating sitemap with blog posts, generating without them:', error.message);
  generateSitemap();
}
