const siteUrl = 'https://propertypeace.io';
const organizationId = `${siteUrl}/#organization`;
const websiteId = `${siteUrl}/#website`;

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': organizationId,
  name: 'Property Peace',
  url: siteUrl,
  logo: `${siteUrl}/favicon.png`,
  sameAs: ['https://www.linkedin.com/company/property-peace'],
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': websiteId,
  name: 'Property Peace',
  url: siteUrl,
  description: 'Property Peace is landlord software and a structured system of record for rental workflows. Percy, Property Peace’s AI property assistant, offers read-only help for supported records through a limited pilot.',
  publisher: { '@id': organizationId },
  inLanguage: 'en-US',
};

export function webPageSchema({
  path,
  name,
  description,
}: {
  path: string;
  name: string;
  description: string;
}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${siteUrl}${normalizedPath === '/' ? '' : normalizedPath}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: { '@id': websiteId },
    publisher: { '@id': organizationId },
    inLanguage: 'en-US',
  };
}
