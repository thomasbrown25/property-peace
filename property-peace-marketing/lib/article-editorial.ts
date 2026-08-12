export type ArticleSource = {
  title: string;
  publisher: string;
  href: string;
};

export type ArticleEditorial = {
  reviewedOn: string;
  reviewNote: string;
  disclaimer?: string;
  sources: ArticleSource[];
};

const ARTICLE_EDITORIAL: Record<string, ArticleEditorial> = {
  'landlord-move-in-move-out-checklist': {
    reviewedOn: '2026-08-08',
    reviewNote: 'Reviewed for practical accuracy and jurisdiction-dependent deposit guidance.',
    disclaimer: 'Security-deposit rules, inspection procedures, notice periods, and documentation requirements vary by state and locality. Verify the rules where the rental is located.',
    sources: [
      {
        title: 'Tenant Rights, Laws and Protections: State Resources',
        publisher: 'U.S. Department of Housing and Urban Development',
        href: 'https://www.hud.gov/states',
      },
      {
        title: 'The Fair Housing Act',
        publisher: 'U.S. Department of Justice',
        href: 'https://www.justice.gov/crt/fair-housing-act-1',
      },
    ],
  },
  'rental-property-cash-flow-template-landlords': {
    reviewedOn: '2026-08-08',
    reviewNote: 'Reviewed against current federal rental-income and expense guidance.',
    disclaimer: 'This guide is for general educational purposes and is not tax, accounting, or investment advice. Tax treatment depends on your facts; consult a qualified professional.',
    sources: [
      {
        title: 'Publication 527: Residential Rental Property',
        publisher: 'Internal Revenue Service',
        href: 'https://www.irs.gov/publications/p527',
      },
      {
        title: 'Instructions for Schedule E (Form 1040)',
        publisher: 'Internal Revenue Service',
        href: 'https://www.irs.gov/instructions/i1040se',
      },
    ],
  },
  'landlord-maintenance-checklist-prevent-costly-repairs': {
    reviewedOn: '2026-08-08',
    reviewNote: 'Reviewed for general preventive-maintenance and residential safety guidance.',
    disclaimer: 'Maintenance duties and inspection requirements vary by property, lease, and jurisdiction. Use qualified contractors where appropriate and follow local codes and manufacturer instructions.',
    sources: [
      {
        title: 'A Brief Guide to Mold, Moisture and Your Home',
        publisher: 'U.S. Environmental Protection Agency',
        href: 'https://www.epa.gov/mold/brief-guide-mold-moisture-and-your-home',
      },
      {
        title: 'Smoke Alarms',
        publisher: 'U.S. Fire Administration',
        href: 'https://www.usfa.fema.gov/prevention/home-fires/prepare-for-fire/smoke-alarms/',
      },
      {
        title: 'Carbon Monoxide Fact Sheet',
        publisher: 'U.S. Consumer Product Safety Commission',
        href: 'https://www.cpsc.gov/s3fs-public/464.pdf',
      },
    ],
  },
};

export function getArticleEditorial(slug: string): ArticleEditorial | undefined {
  return ARTICLE_EDITORIAL[slug];
}
