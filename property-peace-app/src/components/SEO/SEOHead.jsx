import { useEffect } from 'react';

/**
 * SEO Head Component for dynamic meta tags per page
 * Uses direct DOM manipulation for React 19 compatibility
 * No dependencies required!
 * 
 * Usage:
 * <SEOHead
 *   title="Page Title"
 *   description="Page description"
 *   keywords="keyword1, keyword2"
 *   canonical="https://brownstonehub.com/page"
 *   ogImage="/og-image.png"
 * />
 */
const SEOHead = ({
  title = 'Property Management Software for Landlords | Property Peace',
  description = 'Property management software for landlords with rent records, tenant management, lease workflows, and maintenance tracking. Property Peace does not currently process online rent payments. Start Free — free for up to 5 units.',
  keywords = 'property management software, landlord software, rental property management, property management app, rent collection software, tenant management software, property management system, landlord management software, rental management software, property management platform, best property management software for landlords, property management software for small landlords, free property management software, online rent collection software, tenant portal software, lease management software, property accounting software',
  canonical,
  ogImage = '/logo-with-text.png',
  noindex = false,
  type = 'website'
}) => {
  const baseUrl = 'https://brownstonehub.com';
  const fullTitle = title.includes('Property Peace') ? title : `${title} | Property Peace`;
  const canonicalUrl = canonical || baseUrl;
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Helper function to update or create meta tags
    const updateMetaTag = (property, content, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${property}"]`);
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, property);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Primary Meta Tags
    updateMetaTag('title', fullTitle);
    updateMetaTag('description', description);
    if (keywords) {
      updateMetaTag('keywords', keywords);
    }
    if (noindex) {
      updateMetaTag('robots', 'noindex, nofollow');
    } else {
      updateMetaTag('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    }

    // Canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // Open Graph Tags
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:url', canonicalUrl, true);
    updateMetaTag('og:title', fullTitle, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', fullOgImage, true);

    // Twitter Card Tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:url', canonicalUrl);
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', fullOgImage);
  }, [fullTitle, description, keywords, canonicalUrl, fullOgImage, noindex, type]);

  // This component doesn't render anything visible
  return null;
};

export default SEOHead;
