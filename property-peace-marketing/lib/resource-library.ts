import type { IconType } from 'react-icons';
import {
  FiBookOpen,
  FiCheckSquare,
  FiDollarSign,
  FiDownload,
  FiFileText,
  FiHome,
  FiTool,
  FiUsers,
} from 'react-icons/fi';

export type ResourceTopic =
  | 'All resources'
  | 'Getting started'
  | 'Tenants'
  | 'Leases'
  | 'Rent & accounting'
  | 'Maintenance';

export type ResourceType = 'Guide' | 'Checklist' | 'Download';

export type ResourceEntry = {
  slug: string;
  href?: string;
  title: string;
  description: string;
  topic: Exclude<ResourceTopic, 'All resources'>;
  type: ResourceType;
  readTime: string;
  featured?: boolean;
};

export type ResourcePathway = {
  title: string;
  description: string;
  topic: Exclude<ResourceTopic, 'All resources'>;
  icon: IconType;
};

export const resourceTopics: ResourceTopic[] = [
  'All resources',
  'Getting started',
  'Tenants',
  'Leases',
  'Rent & accounting',
  'Maintenance',
];

export const resourcePathways: ResourcePathway[] = [
  {
    title: 'Start and organize',
    description: 'Build a repeatable rental workflow before scattered notes become your system.',
    topic: 'Getting started',
    icon: FiHome,
  },
  {
    title: 'Find and manage tenants',
    description: 'Learn consistent application, screening, communication, and documentation practices.',
    topic: 'Tenants',
    icon: FiUsers,
  },
  {
    title: 'Create clearer lease records',
    description: 'Prepare terms, handoffs, condition records, and renewal information in one place.',
    topic: 'Leases',
    icon: FiFileText,
  },
  {
    title: 'Understand the money',
    description: 'Track property-level income, expenses, rent status, reserves, and reporting inputs.',
    topic: 'Rent & accounting',
    icon: FiDollarSign,
  },
  {
    title: 'Stay ahead of repairs',
    description: 'Turn tenant reports and seasonal checks into documented maintenance work.',
    topic: 'Maintenance',
    icon: FiTool,
  },
];

export const resourceEntries: ResourceEntry[] = [
  {
    slug: 'landlord-starter-pack',
    href: '/resources/starter-pack',
    title: 'Free Landlord Starter Pack',
    description: 'Download four printable checklists and worksheets plus an editable rental cash-flow workbook.',
    topic: 'Getting started',
    type: 'Download',
    readTime: '5 files',
    featured: true,
  },
  {
    slug: 'landlord-move-in-move-out-checklist',
    title: 'Landlord Move-In and Move-Out Checklist',
    description: 'What to inspect, photograph, document, and store before and after a tenancy.',
    topic: 'Leases',
    type: 'Checklist',
    readTime: '3 min read',
    featured: true,
  },
  {
    slug: 'rental-property-cash-flow-template-landlords',
    title: 'Rental Property Cash Flow Template',
    description: 'A practical monthly view of rent, vacancies, expenses, reserves, debt, and property performance.',
    topic: 'Rent & accounting',
    type: 'Guide',
    readTime: '2 min read',
    featured: true,
  },
  {
    slug: 'landlord-maintenance-checklist-prevent-costly-repairs',
    title: 'Preventive Maintenance Checklist for Landlords',
    description: 'Monthly and seasonal checks that help you catch small issues before they become emergencies.',
    topic: 'Maintenance',
    type: 'Checklist',
    readTime: '2 min read',
    featured: true,
  },
];

export const resourceTypeIcons: Record<ResourceType, IconType> = {
  Guide: FiBookOpen,
  Checklist: FiCheckSquare,
  Download: FiDownload,
};

export function getResourceHref(resource: ResourceEntry) {
  return resource.href ?? `/blog/${resource.slug}`;
}
