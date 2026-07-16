'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiActivity,
  FiAlertTriangle,
  FiBarChart2,
  FiBell,
  FiBookOpen,
  FiCheck,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiFile,
  FiFileText,
  FiFolder,
  FiGlobe,
  FiHome,
  FiLayout,
  FiMail,
  FiMapPin,
  FiMessageSquare,
  FiRefreshCw,
  FiShield,
  FiTool,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi';

const TICK_MS = 50;
const STEP_DURATIONS = [3200, 4200, 3200];

type MockStep = {
  label: string;
  caption: string;
  callout: string;
  eyebrow: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'blue' | 'green' | 'red' | 'purple';
  rows: { label: string; value: string; status: string; tone: 'blue' | 'green' | 'red' | 'gray' }[];
  note: string;
};

type FeatureHeroMockProps = {
  slug: string;
  title: string;
  benefits?: string[];
  theme?: 'light' | 'dark';
  showWhyItMatters?: boolean;
  captionPlacement?: 'bottom' | 'none';
  onActiveStepChange?: (index: number) => void;
};

const toneClasses = {
  blue: {
    icon: 'bg-blue-50 text-blue-600',
    pill: 'border-blue-200 bg-blue-50 text-blue-600',
    bar: 'bg-blue-500',
  },
  green: {
    icon: 'bg-emerald-50 text-emerald-600',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    bar: 'bg-emerald-500',
  },
  red: {
    icon: 'bg-red-50 text-red-600',
    pill: 'border-red-200 bg-red-50 text-red-600',
    bar: 'bg-red-500',
  },
  gray: {
    icon: 'bg-slate-50 text-slate-600',
    pill: 'border-slate-200 bg-slate-50 text-slate-600',
    bar: 'bg-slate-500',
  },
  purple: {
    icon: 'bg-violet-50 text-violet-600',
    pill: 'border-violet-200 bg-violet-50 text-violet-600',
    bar: 'bg-violet-500',
  },
};

const featureSteps: Record<string, MockStep[]> = {
  'ai-summaries': [
    {
      label: 'Scan portfolio',
      caption: 'Percy reads rent, maintenance, lease, and tenant activity across the portfolio.',
      callout: 'Portfolio scanned',
      eyebrow: 'Percy snapshot',
      title: '12-unit portfolio review',
      icon: FiActivity,
      tone: 'purple',
      rows: [
        { label: 'Rent status', value: '2 overdue', status: 'Needs attention', tone: 'red' },
        { label: 'Maintenance', value: '3 open', status: 'Active', tone: 'blue' },
        { label: 'Lease renewals', value: '1 upcoming', status: '60 days', tone: 'green' },
      ],
      note: 'Pulling the important signals into one plain-English summary.',
    },
    {
      label: 'Summarize',
      caption: 'Get the story behind your numbers without opening every report.',
      callout: 'Summary written',
      eyebrow: 'Plain-English output',
      title: 'This week needs two follow-ups',
      icon: FiMessageSquare,
      tone: 'blue',
      rows: [
        { label: 'Maple Ridge 4B', value: '$1,450 late', status: 'Follow up', tone: 'red' },
        { label: 'Oak Street 2A', value: 'Pipe leak', status: 'Vendor waiting', tone: 'blue' },
        { label: 'Cedar Loft', value: 'Renewal due', status: 'Draft ready', tone: 'green' },
      ],
      note: 'A dashboard check becomes a quick decision list.',
    },
    {
      label: 'Act faster',
      caption: 'Jump from the summary to the exact rent, lease, or maintenance item.',
      callout: 'Next steps ready',
      eyebrow: 'Recommended actions',
      title: 'Today’s landlord checklist',
      icon: FiCheck,
      tone: 'green',
      rows: [
        { label: 'Send rent reminder', value: 'Sarah M.', status: 'Ready', tone: 'blue' },
        { label: 'Approve vendor', value: 'Oak Street', status: 'Waiting', tone: 'red' },
        { label: 'Review renewal', value: 'Cedar Loft', status: 'Open', tone: 'green' },
      ],
      note: 'Everything important is surfaced before it slips through.',
    },
  ],
  'rent-estimate': [
    {
      label: 'Select unit',
      caption: 'Choose the exact unit you want to price before listing it.',
      callout: 'Unit selected',
      eyebrow: 'Rent estimate',
      title: '2 bed · 1 bath · Charlotte, NC',
      icon: FiMapPin,
      tone: 'blue',
      rows: [
        { label: 'Current rent', value: '$1,550', status: 'Expiring', tone: 'gray' },
        { label: 'Bedrooms', value: '2', status: 'Matched', tone: 'green' },
        { label: 'Nearby listings', value: '18', status: 'Found', tone: 'blue' },
      ],
      note: 'Estimates stay tied to the property and unit you manage.',
    },
    {
      label: 'Compare market',
      caption: 'Scan real nearby listings instead of guessing from stale spreadsheets.',
      callout: 'Comps found',
      eyebrow: 'Comparable listings',
      title: 'Nearby rent range',
      icon: FiGlobe,
      tone: 'purple',
      rows: [
        { label: 'Low comparable', value: '$1,625', status: '0.4 mi', tone: 'blue' },
        { label: 'Median', value: '$1,745', status: 'Best fit', tone: 'green' },
        { label: 'High comparable', value: '$1,875', status: '0.8 mi', tone: 'blue' },
      ],
      note: 'Price with context from listings that actually compete with yours.',
    },
    {
      label: 'Price confidently',
      caption: 'Use a clear range to avoid underpricing or sitting vacant.',
      callout: 'Range ready',
      eyebrow: 'Recommended range',
      title: '$1,700–$1,825 / month',
      icon: FiTrendingUp,
      tone: 'green',
      rows: [
        { label: 'Suggested list price', value: '$1,775', status: 'Strong', tone: 'green' },
        { label: 'Income lift', value: '+$225/mo', status: 'Potential', tone: 'blue' },
        { label: 'Vacancy risk', value: 'Low', status: 'Balanced', tone: 'green' },
      ],
      note: 'Turn market data into a number you can stand behind.',
    },
  ],
  'all-in-one-dashboard': [
    {
      label: 'Portfolio view',
      caption: 'See rent, tasks, leases, and maintenance in one calm view.',
      callout: 'Live overview',
      eyebrow: 'Dashboard',
      title: 'Today across 8 units',
      icon: FiLayout,
      tone: 'blue',
      rows: [
        { label: 'Rent collected', value: '$8,225', status: '78%', tone: 'green' },
        { label: 'Open requests', value: '3', status: 'Active', tone: 'blue' },
        { label: 'Lease alerts', value: '1', status: 'Soon', tone: 'red' },
      ],
      note: 'No switching between tabs just to understand the day.',
    },
    {
      label: 'Live updates',
      caption: 'Changes appear as tenants pay, message, or submit requests.',
      callout: 'SignalR update',
      eyebrow: 'Real-time activity',
      title: 'New tenant payment received',
      icon: FiZap,
      tone: 'green',
      rows: [
        { label: 'Unit 4B', value: '$1,450', status: 'Paid', tone: 'green' },
        { label: 'Ledger', value: 'Updated', status: 'Auto', tone: 'blue' },
        { label: 'Balance', value: '$0', status: 'Clear', tone: 'green' },
      ],
      note: 'The dashboard updates while you work.',
    },
    {
      label: 'Take action',
      caption: 'Jump directly to reminders, leases, reports, or maintenance.',
      callout: 'Actions ready',
      eyebrow: 'Quick actions',
      title: 'Next best tasks',
      icon: FiCheck,
      tone: 'purple',
      rows: [
        { label: 'Send reminder', value: '1 tenant', status: 'Ready', tone: 'blue' },
        { label: 'Review request', value: 'Pipe leak', status: 'Open', tone: 'red' },
        { label: 'Export report', value: 'October', status: 'Ready', tone: 'green' },
      ],
      note: 'A dashboard should tell you what to do next, not just show numbers.',
    },
  ],
  'property-management': [
    {
      label: 'Add property',
      caption: 'Keep properties, units, tenants, docs, and notes together.',
      callout: 'Property organized',
      eyebrow: 'Portfolio',
      title: 'Maple Ridge Duplex',
      icon: FiHome,
      tone: 'blue',
      rows: [
        { label: 'Units', value: '4', status: 'Occupied', tone: 'green' },
        { label: 'Documents', value: '18', status: 'Stored', tone: 'blue' },
        { label: 'Monthly rent', value: '$5,900', status: 'Tracked', tone: 'green' },
      ],
      note: 'One record becomes the source of truth for the property.',
    },
    {
      label: 'Track details',
      caption: 'Capture photos, records, tenant assignments, and performance.',
      callout: 'Details saved',
      eyebrow: 'Property record',
      title: 'Everything in one place',
      icon: FiFolder,
      tone: 'purple',
      rows: [
        { label: 'Photos', value: '24', status: 'Uploaded', tone: 'blue' },
        { label: 'Maintenance history', value: '7 items', status: 'Logged', tone: 'green' },
        { label: 'Insurance doc', value: 'PDF', status: 'Current', tone: 'green' },
      ],
      note: 'Stop hunting through desktop folders and old email threads.',
    },
    {
      label: 'Monitor performance',
      caption: 'See income, expenses, occupancy, and outstanding work by property.',
      callout: 'Performance clear',
      eyebrow: 'Property health',
      title: 'October snapshot',
      icon: FiBarChart2,
      tone: 'green',
      rows: [
        { label: 'Income', value: '$5,900', status: 'On track', tone: 'green' },
        { label: 'Expenses', value: '$720', status: 'Logged', tone: 'blue' },
        { label: 'Open work', value: '1', status: 'Scheduled', tone: 'red' },
      ],
      note: 'Know which properties need attention before month-end.',
    },
  ],
  'lease-management': [
    {
      label: 'Draft lease',
      caption: 'Create lease documents and keep terms tied to the tenant and unit.',
      callout: 'Draft ready',
      eyebrow: 'Lease workflow',
      title: 'Unit 2A lease draft',
      icon: FiFile,
      tone: 'blue',
      rows: [
        { label: 'Tenant', value: 'Marcus Lee', status: 'Selected', tone: 'green' },
        { label: 'Term', value: '12 months', status: 'Set', tone: 'blue' },
        { label: 'Rent', value: '$1,325', status: 'Confirmed', tone: 'green' },
      ],
      note: 'Lease details stay connected to the property record.',
    },
    {
      label: 'Send to sign',
      caption: 'Use DocuSign to collect signatures without printing or scanning.',
      callout: 'Envelope sent',
      eyebrow: 'E-signature',
      title: 'DocuSign envelope',
      icon: FiFileText,
      tone: 'purple',
      rows: [
        { label: 'Landlord', value: 'Signed', status: 'Done', tone: 'green' },
        { label: 'Tenant', value: 'Pending', status: 'Sent', tone: 'blue' },
        { label: 'Reminder', value: 'Tomorrow', status: 'Auto', tone: 'gray' },
      ],
      note: 'Track signature progress from the lease workflow.',
    },
    {
      label: 'Track renewals',
      caption: 'Never let a lease expiration surprise you again.',
      callout: 'Renewal alert',
      eyebrow: 'Lease calendar',
      title: 'Upcoming expirations',
      icon: FiClock,
      tone: 'green',
      rows: [
        { label: 'Cedar Loft', value: '45 days', status: 'Renewal due', tone: 'red' },
        { label: 'Maple 2A', value: '120 days', status: 'Healthy', tone: 'green' },
        { label: 'Oak 1C', value: 'Signed', status: 'Complete', tone: 'green' },
      ],
      note: 'Renewal reminders happen before the deadline gets stressful.',
    },
  ],
  'maintenance-tracking': [
    {
      label: 'Request arrives',
      caption: 'Tenants submit repair requests with details and photos.',
      callout: 'New request',
      eyebrow: 'Maintenance inbox',
      title: 'Kitchen sink leaking',
      icon: FiTool,
      tone: 'red',
      rows: [
        { label: 'Unit', value: '1C', status: 'Tenant submitted', tone: 'blue' },
        { label: 'Priority', value: 'Medium', status: 'Triage', tone: 'red' },
        { label: 'Photos', value: '3', status: 'Attached', tone: 'green' },
      ],
      note: 'Requests arrive with enough context to act quickly.',
    },
    {
      label: 'Assign work',
      caption: 'Track vendor, priority, schedule, and cost from one place.',
      callout: 'Vendor assigned',
      eyebrow: 'Work order',
      title: 'Plumber scheduled',
      icon: FiCheck,
      tone: 'blue',
      rows: [
        { label: 'Vendor', value: 'Queen City Plumbing', status: 'Assigned', tone: 'green' },
        { label: 'Visit', value: 'Thu 10 AM', status: 'Scheduled', tone: 'blue' },
        { label: 'Estimate', value: '$185', status: 'Logged', tone: 'gray' },
      ],
      note: 'Every repair has a clear next step and owner.',
    },
    {
      label: 'Close loop',
      caption: 'Keep a complete maintenance history for every property.',
      callout: 'Request closed',
      eyebrow: 'Maintenance history',
      title: 'Repair completed',
      icon: FiFolder,
      tone: 'green',
      rows: [
        { label: 'Invoice', value: '$172', status: 'Saved', tone: 'green' },
        { label: 'Tenant update', value: 'Sent', status: 'Done', tone: 'blue' },
        { label: 'History', value: 'Updated', status: 'Auto', tone: 'green' },
      ],
      note: 'Future-you can see what happened without searching texts.',
    },
  ],
  'rent-collection': [
    {
      label: 'Rent status',
      caption: 'See paid, due, and overdue rent without opening a spreadsheet.',
      callout: '1 tenant needs a nudge',
      eyebrow: 'October rent roll',
      title: 'Maple Ridge',
      icon: FiDollarSign,
      tone: 'red',
      rows: [
        { label: 'Sarah Mitchell · 4B', value: '$1,450', status: 'Overdue', tone: 'red' },
        { label: 'Marcus Lee · 2A', value: '$1,325', status: 'Paid', tone: 'green' },
        { label: 'Nora Patel · 1C', value: '$1,600', status: 'Due soon', tone: 'blue' },
      ],
      note: 'The rent roll shows who needs attention before you chase manually.',
    },
    {
      label: 'Reminder sent',
      caption: 'Send a friendly rent reminder by email or SMS from the same workflow.',
      callout: 'Reminder ready',
      eyebrow: 'Tenant reminder',
      title: 'Friendly follow-up',
      icon: FiBell,
      tone: 'blue',
      rows: [
        { label: 'Email reminder', value: 'Ready', status: 'Drafted', tone: 'blue' },
        { label: 'SMS reminder', value: 'Ready', status: 'Optional', tone: 'green' },
        { label: 'Late fee', value: '$50', status: 'Calculated', tone: 'gray' },
      ],
      note: 'Send the right nudge without rewriting the same message.',
    },
    {
      label: 'Ledger updated',
      caption: 'When the tenant pays, the balance and rent roll update automatically.',
      callout: 'Payment posted',
      eyebrow: 'Payment received',
      title: '$1,450.00 paid',
      icon: FiCreditCard,
      tone: 'green',
      rows: [
        { label: 'Method', value: 'Tenant portal', status: 'Processed', tone: 'green' },
        { label: 'Balance', value: '$0', status: 'Cleared', tone: 'green' },
        { label: 'Rent roll', value: '100%', status: 'Updated', tone: 'blue' },
      ],
      note: 'No duplicate entry. No “did they pay?” guessing.',
    },
  ],
  'financial-reports': [
    {
      label: 'Pull data',
      caption: 'Income, expenses, and property activity roll into reports automatically.',
      callout: 'Data gathered',
      eyebrow: 'Financial reports',
      title: 'October financials',
      icon: FiBarChart2,
      tone: 'blue',
      rows: [
        { label: 'Rental income', value: '$8,225', status: 'Posted', tone: 'green' },
        { label: 'Expenses', value: '$1,140', status: 'Categorized', tone: 'blue' },
        { label: 'Net cash flow', value: '$7,085', status: 'Calculated', tone: 'green' },
      ],
      note: 'Reports start from the data already in your workflow.',
    },
    {
      label: 'Compare periods',
      caption: 'See property profitability and month-over-month changes clearly.',
      callout: 'Trends ready',
      eyebrow: 'Profitability',
      title: 'Maple Ridge vs last month',
      icon: FiTrendingUp,
      tone: 'green',
      rows: [
        { label: 'Income', value: '+8%', status: 'Up', tone: 'green' },
        { label: 'Repairs', value: '-12%', status: 'Down', tone: 'blue' },
        { label: 'Profit', value: '+$430', status: 'Improved', tone: 'green' },
      ],
      note: 'Know which properties are performing and why.',
    },
    {
      label: 'Export cleanly',
      caption: 'Prepare tax categories and exports without rebuilding spreadsheets.',
      callout: 'Export ready',
      eyebrow: 'Tax prep',
      title: 'Schedule E categories',
      icon: FiFileText,
      tone: 'purple',
      rows: [
        { label: 'Repairs', value: '$720', status: 'Categorized', tone: 'blue' },
        { label: 'Supplies', value: '$95', status: 'Categorized', tone: 'blue' },
        { label: 'Export', value: 'Excel/PDF', status: 'Ready', tone: 'green' },
      ],
      note: 'Cleaner reports mean less cleanup for tax season.',
    },
  ],
  'tenant-communication': [
    {
      label: 'Choose channel',
      caption: 'Reach tenants by in-app message, email, or SMS based on urgency.',
      callout: 'Channels ready',
      eyebrow: 'Notifications',
      title: 'Message Sarah Mitchell',
      icon: FiBell,
      tone: 'blue',
      rows: [
        { label: 'In-app', value: 'Enabled', status: 'Default', tone: 'green' },
        { label: 'Email', value: 'On', status: 'Backup', tone: 'blue' },
        { label: 'SMS', value: 'Critical only', status: 'Set', tone: 'gray' },
      ],
      note: 'Pick the right channel without leaving the tenant record.',
    },
    {
      label: 'Send update',
      caption: 'Keep tenants informed about rent, maintenance, leases, and notices.',
      callout: 'Update sent',
      eyebrow: 'Tenant update',
      title: 'Repair scheduled for Thursday',
      icon: FiMail,
      tone: 'green',
      rows: [
        { label: 'Tenant', value: 'Sarah M.', status: 'Delivered', tone: 'green' },
        { label: 'Property', value: 'Maple 4B', status: 'Linked', tone: 'blue' },
        { label: 'Thread', value: 'Saved', status: 'History', tone: 'gray' },
      ],
      note: 'Every notification becomes part of the property record.',
    },
    {
      label: 'Track history',
      caption: 'See what was sent, when, and which tenant received it.',
      callout: 'History saved',
      eyebrow: 'Communication log',
      title: 'Complete tenant timeline',
      icon: FiClock,
      tone: 'purple',
      rows: [
        { label: 'Rent reminder', value: 'Oct 6', status: 'Read', tone: 'green' },
        { label: 'Maintenance update', value: 'Oct 8', status: 'Delivered', tone: 'blue' },
        { label: 'Lease notice', value: 'Oct 14', status: 'Scheduled', tone: 'gray' },
      ],
      note: 'No more “did I already tell them?” moments.',
    },
  ],
  'document-management': [
    {
      label: 'Upload',
      caption: 'Store leases, receipts, photos, and forms in secure cloud folders.',
      callout: 'Document saved',
      eyebrow: 'Document vault',
      title: 'Maple Ridge files',
      icon: FiFolder,
      tone: 'blue',
      rows: [
        { label: 'Signed lease', value: 'PDF', status: 'Stored', tone: 'green' },
        { label: 'Move-in photos', value: '24 files', status: 'Uploaded', tone: 'blue' },
        { label: 'Receipts', value: '8 files', status: 'Tagged', tone: 'gray' },
      ],
      note: 'Documents stay attached to the property, unit, and tenant they belong to.',
    },
    {
      label: 'Organize',
      caption: 'Use folders and tags instead of desktop chaos.',
      callout: 'Files organized',
      eyebrow: 'Smart folders',
      title: 'Lease + expense folders',
      icon: FiFile,
      tone: 'purple',
      rows: [
        { label: 'Leases', value: '12', status: 'Current', tone: 'green' },
        { label: 'Invoices', value: '31', status: 'Tagged', tone: 'blue' },
        { label: 'Insurance', value: '2', status: 'Current', tone: 'green' },
      ],
      note: 'Find the right file without digging through old emails.',
    },
    {
      label: 'Retrieve',
      caption: 'Access important documents wherever you manage your rentals.',
      callout: 'Link ready',
      eyebrow: 'Secure access',
      title: 'Shareable secure file',
      icon: FiCheck,
      tone: 'green',
      rows: [
        { label: 'Access token', value: 'Temporary', status: 'Secure', tone: 'green' },
        { label: 'Preview', value: 'Available', status: 'Ready', tone: 'blue' },
        { label: 'Download', value: 'Enabled', status: 'Logged', tone: 'gray' },
      ],
      note: 'Get the document you need without waiting until you’re at a computer.',
    },
  ],
  'rental-applications': [
    {
      label: 'Invite applicant',
      caption: 'Send secure application links tied to the property and unit.',
      callout: 'Invite sent',
      eyebrow: 'Application workflow',
      title: 'Applicant invite',
      icon: FiFileText,
      tone: 'blue',
      rows: [
        { label: 'Unit', value: 'Oak 2B', status: 'Selected', tone: 'blue' },
        { label: 'Applicant', value: 'Jamie K.', status: 'Invited', tone: 'green' },
        { label: 'Link expires', value: '14 days', status: 'Secure', tone: 'gray' },
      ],
      note: 'Applicants can complete the form without creating an account.',
    },
    {
      label: 'Review answers',
      caption: 'Keep application details, notes, and status in one workflow.',
      callout: 'Application received',
      eyebrow: 'Applicant review',
      title: 'Jamie Kim application',
      icon: FiCheck,
      tone: 'green',
      rows: [
        { label: 'Employment', value: 'Verified', status: 'Complete', tone: 'green' },
        { label: 'Income', value: '3.2x rent', status: 'Meets', tone: 'green' },
        { label: 'Notes', value: '2', status: 'Internal', tone: 'blue' },
      ],
      note: 'Review the applicant without juggling PDF attachments.',
    },
    {
      label: 'Create PDF',
      caption: 'Generate and store a professional PDF automatically.',
      callout: 'PDF created',
      eyebrow: 'Application packet',
      title: 'Completed application',
      icon: FiFolder,
      tone: 'purple',
      rows: [
        { label: 'PDF', value: 'Generated', status: 'Stored', tone: 'green' },
        { label: 'Status', value: 'Reviewed', status: 'Ready', tone: 'blue' },
        { label: 'Next step', value: 'Lease draft', status: 'Open', tone: 'green' },
      ],
      note: 'Move from application to lease without re-entering data.',
    },
  ],
  'payment-processing': [
    {
      label: 'Payment link',
      caption: 'Give tenants a secure online way to pay.',
      callout: 'Link generated',
      eyebrow: 'Stripe payments',
      title: 'Tenant portal payment',
      icon: FiCreditCard,
      tone: 'blue',
      rows: [
        { label: 'Amount due', value: '$1,450', status: 'Open', tone: 'blue' },
        { label: 'Payment methods', value: 'Card/ACH', status: 'Enabled', tone: 'green' },
        { label: 'Receipt', value: 'Auto', status: 'Ready', tone: 'gray' },
      ],
      note: 'Online payments connect directly to the tenant ledger.',
    },
    {
      label: 'Process securely',
      caption: 'Stripe handles payment processing while Property Peace tracks status.',
      callout: 'Processing',
      eyebrow: 'Payment status',
      title: 'Payment in progress',
      icon: FiRefreshCw,
      tone: 'purple',
      rows: [
        { label: 'Processor', value: 'Stripe', status: 'Secure', tone: 'green' },
        { label: 'Status', value: 'Pending', status: 'Webhook', tone: 'blue' },
        { label: 'Tenant', value: 'Notified', status: 'Auto', tone: 'gray' },
      ],
      note: 'Payment state stays synchronized after checkout.',
    },
    {
      label: 'Post payment',
      caption: 'Confirmed payments update rent tracking automatically.',
      callout: 'Payment confirmed',
      eyebrow: 'Ledger update',
      title: '$1,450 posted',
      icon: FiCheck,
      tone: 'green',
      rows: [
        { label: 'Balance', value: '$0', status: 'Cleared', tone: 'green' },
        { label: 'Receipt', value: 'Sent', status: 'Done', tone: 'blue' },
        { label: 'Report', value: 'Updated', status: 'Auto', tone: 'green' },
      ],
      note: 'Less reconciliation work after rent hits.',
    },
  ],
  'real-time-communication': [
    {
      label: 'Tenant message',
      caption: 'Messages arrive instantly instead of getting buried in email.',
      callout: 'New message',
      eyebrow: 'Live conversation',
      title: 'Tenant asks about repair time',
      icon: FiMessageSquare,
      tone: 'blue',
      rows: [
        { label: 'From', value: 'Nora P.', status: 'Online', tone: 'green' },
        { label: 'Unit', value: '1C', status: 'Linked', tone: 'blue' },
        { label: 'Thread', value: 'Maintenance', status: 'Open', tone: 'red' },
      ],
      note: 'The message stays tied to the tenant and property context.',
    },
    {
      label: 'Reply live',
      caption: 'SignalR updates conversations without refreshing the page.',
      callout: 'Reply delivered',
      eyebrow: 'SignalR messaging',
      title: 'Vendor arrives Thursday at 10',
      icon: FiZap,
      tone: 'green',
      rows: [
        { label: 'Delivered', value: 'Now', status: 'Instant', tone: 'green' },
        { label: 'Read receipt', value: 'Seen', status: 'Live', tone: 'blue' },
        { label: 'Attachment', value: 'Invoice', status: 'Shared', tone: 'gray' },
      ],
      note: 'Fast replies keep small issues from becoming big ones.',
    },
    {
      label: 'Keep history',
      caption: 'Conversation history stays searchable later.',
      callout: 'Thread saved',
      eyebrow: 'Message history',
      title: 'Complete tenant thread',
      icon: FiClock,
      tone: 'purple',
      rows: [
        { label: 'Messages', value: '14', status: 'Saved', tone: 'blue' },
        { label: 'Files', value: '2', status: 'Attached', tone: 'green' },
        { label: 'Search', value: 'Available', status: 'Ready', tone: 'gray' },
      ],
      note: 'You can prove what was said without scrolling through texts.',
    },
  ],
  'automation': [
    {
      label: 'Set rule',
      caption: 'Choose a trigger once and let the workflow run.',
      callout: 'Rule created',
      eyebrow: 'Automation rule',
      title: 'Rent reminder workflow',
      icon: FiRefreshCw,
      tone: 'blue',
      rows: [
        { label: 'Trigger', value: '3 days before due', status: 'Set', tone: 'blue' },
        { label: 'Channel', value: 'Email + SMS', status: 'Enabled', tone: 'green' },
        { label: 'Audience', value: 'Unpaid tenants', status: 'Filtered', tone: 'gray' },
      ],
      note: 'Routine reminders happen without rebuilding the task every month.',
    },
    {
      label: 'Run quietly',
      caption: 'Background jobs check deadlines and payment status for you.',
      callout: 'Workflow running',
      eyebrow: 'Background task',
      title: 'Checking overdue rent',
      icon: FiClock,
      tone: 'purple',
      rows: [
        { label: 'Rent due', value: 'Today', status: 'Checked', tone: 'blue' },
        { label: 'Unpaid', value: '1 tenant', status: 'Found', tone: 'red' },
        { label: 'Reminder', value: 'Queued', status: 'Auto', tone: 'green' },
      ],
      note: 'The system watches the calendar so you do not have to.',
    },
    {
      label: 'Notify',
      caption: 'Get notified when something actually needs your attention.',
      callout: 'Alert sent',
      eyebrow: 'Smart alert',
      title: 'Lease renewal due soon',
      icon: FiBell,
      tone: 'green',
      rows: [
        { label: 'Lease', value: 'Cedar Loft', status: '60 days', tone: 'red' },
        { label: 'Reminder', value: 'Sent', status: 'Done', tone: 'green' },
        { label: 'Task', value: 'Created', status: 'Open', tone: 'blue' },
      ],
      note: 'Automation turns deadlines into clear next steps.',
    },
  ],
  'lease-shield': [
    {
      label: 'Select state',
      caption: 'Ground answers in the jurisdiction where your property is located.',
      callout: 'State selected',
      eyebrow: 'LeaseShield',
      title: 'North Carolina lease question',
      icon: FiShield,
      tone: 'blue',
      rows: [
        { label: 'State', value: 'NC', status: 'Selected', tone: 'blue' },
        { label: 'Lease', value: 'Maple 4B', status: 'Linked', tone: 'green' },
        { label: 'Source type', value: '.gov only', status: 'Locked', tone: 'green' },
      ],
      note: 'Percy starts with the state and lease, not generic AI guesswork.',
    },
    {
      label: 'Ask question',
      caption: 'Ask lease or landlord-tenant law questions in plain English.',
      callout: 'Question grounded',
      eyebrow: 'Official-source Q&A',
      title: 'Can I charge this late fee?',
      icon: FiMessageSquare,
      tone: 'purple',
      rows: [
        { label: 'Statutes', value: '2 found', status: 'Official', tone: 'green' },
        { label: 'AG guide', value: '1 found', status: '.gov', tone: 'blue' },
        { label: 'Blogs', value: '0 used', status: 'Excluded', tone: 'gray' },
      ],
      note: 'LeaseShield searches official sources instead of random internet pages.',
    },
    {
      label: 'Cite answer',
      caption: 'Get a plain-English answer with links you can verify.',
      callout: 'Citations ready',
      eyebrow: 'Cited answer',
      title: 'Answer backed by state sources',
      icon: FiBookOpen,
      tone: 'green',
      rows: [
        { label: 'Answer', value: 'Drafted', status: 'Plain English', tone: 'green' },
        { label: 'Citations', value: '3 links', status: 'Included', tone: 'blue' },
        { label: 'Lease history', value: 'Saved', status: 'Context', tone: 'gray' },
      ],
      note: 'Useful, citable guidance lives next to the lease conversation.',
    },
  ],
};

const defaultSteps: MockStep[] = [
  {
    label: 'Organize',
    caption: 'Bring the work into one focused Property Peace workflow.',
    callout: 'Workflow ready',
    eyebrow: 'Feature workflow',
    title: 'Organized landlord task',
    icon: FiLayout,
    tone: 'blue',
    rows: [
      { label: 'Property', value: 'Maple Ridge', status: 'Linked', tone: 'blue' },
      { label: 'Tenant', value: 'Sarah M.', status: 'Selected', tone: 'green' },
      { label: 'Task', value: 'Open', status: 'Ready', tone: 'gray' },
    ],
    note: 'Everything starts from the property and tenant context you already track.',
  },
  {
    label: 'Act',
    caption: 'Complete the next landlord task without spreadsheet detours.',
    callout: 'Action taken',
    eyebrow: 'Action center',
    title: 'Next step completed',
    icon: FiCheck,
    tone: 'green',
    rows: [
      { label: 'Reminder', value: 'Sent', status: 'Done', tone: 'green' },
      { label: 'Record', value: 'Updated', status: 'Auto', tone: 'blue' },
      { label: 'History', value: 'Saved', status: 'Logged', tone: 'gray' },
    ],
    note: 'Small workflows stay simple and easy to repeat.',
  },
  {
    label: 'Track',
    caption: 'Keep the history and status visible for later.',
    callout: 'Status clear',
    eyebrow: 'History',
    title: 'Clean record saved',
    icon: FiFolder,
    tone: 'purple',
    rows: [
      { label: 'Timeline', value: 'Updated', status: 'Saved', tone: 'blue' },
      { label: 'Report', value: 'Ready', status: 'Export', tone: 'green' },
      { label: 'Follow-up', value: 'None', status: 'Clear', tone: 'green' },
    ],
    note: 'You can come back later and know exactly what happened.',
  },
];

function FeatureScreen({ step, benefits, showWhyItMatters }: { step: MockStep; benefits: string[]; showWhyItMatters: boolean }) {
  const Icon = step.icon;
  const tone = toneClasses[step.tone];

  return (
    <div className="h-full bg-white p-5" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A8A8A]">{step.eyebrow}</p>
          <h3 className="mt-1 truncate text-base font-bold text-primary-main">{step.title}</h3>
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mb-4 space-y-2.5">
        {step.rows.map((row, index) => (
          <motion.div
            key={`${row.label}-${index}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.08 }}
            className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E5E5] bg-white px-3 py-2.5 shadow-sm"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-primary-main">{row.label}</p>
              <p className="text-[10px] text-[#8A8A8A]">{row.value}</p>
            </div>
            <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${toneClasses[row.tone].pill}`}>
              {row.status}
            </span>
          </motion.div>
        ))}
      </div>

      {showWhyItMatters && (
        <div className="rounded-2xl border border-[#dfeaf5] bg-[#F8FBFF] p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8A8A8A]">Why it matters</p>
          <p className="text-xs leading-relaxed text-[#405a70]">{step.note}</p>
          {benefits.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {benefits.slice(0, 2).map((benefit) => (
                <span key={benefit} className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#516A80] shadow-sm">
                  {benefit}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FeatureHeroMock({ slug, title, benefits = [], theme = 'light', showWhyItMatters = true, captionPlacement = 'bottom', onActiveStepChange }: FeatureHeroMockProps) {
  const steps = useMemo(() => featureSteps[slug] ?? defaultSteps, [slug]);
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const activeStepRef = useRef(0);
  const elapsedRef = useRef(0);

  useEffect(() => {
    activeStepRef.current = 0;
    elapsedRef.current = 0;
    setActiveStep(0);
    setElapsed(0);
  }, [slug]);

  useEffect(() => {
    const id = setInterval(() => {
      if (paused) return;
      elapsedRef.current += TICK_MS;
      if (elapsedRef.current >= STEP_DURATIONS[activeStepRef.current]) {
        elapsedRef.current = 0;
        setActiveStep((current) => {
          const next = (current + 1) % steps.length;
          activeStepRef.current = next;
          return next;
        });
      }
      setElapsed(elapsedRef.current);
    }, TICK_MS);

    return () => clearInterval(id);
  }, [paused, steps.length]);

  useEffect(() => {
    onActiveStepChange?.(activeStep);
  }, [activeStep, onActiveStepChange]);

  const selectStep = (index: number) => {
    activeStepRef.current = index;
    elapsedRef.current = 0;
    setElapsed(0);
    setActiveStep(index);
  };

  const progress = (elapsed / STEP_DURATIONS[activeStep]) * 100;
  const active = steps[activeStep];
  const isDarkTheme = theme === 'dark';
  const frameClassName = isDarkTheme
    ? 'relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-white shadow-[0_24px_70px_rgba(0,0,0,0.22)]'
    : 'relative overflow-hidden rounded-[1.35rem] border border-[#dfeaf5] bg-white shadow-[0_24px_70px_rgba(10,45,82,0.16)]';
  const captionClassName = isDarkTheme
    ? 'mt-4 p-4 text-center'
    : 'mt-4 rounded-2xl border border-[#dfeaf5] bg-white/80 p-4 text-center shadow-sm backdrop-blur-sm';
  const captionTextClassName = isDarkTheme
    ? 'text-sm font-medium leading-relaxed text-white'
    : 'text-sm font-medium leading-relaxed text-[#405a70]';

  return (
    <div className="relative mx-auto w-full max-w-[460px] lg:mx-0" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="absolute -left-8 top-8 h-40 w-40 rounded-full bg-primary-main/10 blur-3xl" />
      <div className="absolute -right-8 bottom-10 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className={frameClassName}>
        <div className="bg-[#1a2035]">
          <div className="flex items-stretch border-b border-white/[0.08]">
            <div className="flex flex-shrink-0 items-center gap-1.5 border-r border-white/[0.08] px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <div className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex min-w-0 flex-1">
              {steps.map((step, index) => {
                const isActive = index === activeStep;
                return (
                  <button
                    key={step.label}
                    type="button"
                    onClick={() => selectStep(index)}
                    className={`relative min-w-0 flex-1 px-2 py-3 text-center text-[10px] font-semibold leading-tight transition-colors duration-200 ${
                      isActive ? 'bg-white/[0.12] text-white' : 'text-white/45 hover:bg-white/[0.06] hover:text-white/75'
                    }`}
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    <span className="block truncate">{step.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                        <div className="h-full bg-blue-400" style={{ width: `${progress}%`, transition: 'none' }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 rounded-md bg-[#252d42] px-3 py-1.5">
              <span className="block truncate font-mono text-[11px] text-white/35">app.propertypeace.io/{slug}</span>
            </div>
          </div>
        </div>

        <div className={`relative overflow-hidden bg-[#f8fbff] ${slug === 'maintenance-tracking' && !showWhyItMatters ? 'h-[320px]' : slug === 'maintenance-tracking' ? 'h-[420px]' : 'h-[370px]'}`}>
          <AnimatePresence mode="wait">
            <motion.div key={`${slug}-${activeStep}`} className="absolute inset-0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: 'easeInOut' }}>
              <FeatureScreen step={active} benefits={benefits} showWhyItMatters={showWhyItMatters} />
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div key={`callout-${slug}-${activeStep}`} className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-primary-main px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg" initial={{ opacity: 0, scale: 0.85, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.22, delay: 0.15 }}>
              <FiCheck className="h-3 w-3" />
              {active.callout}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {captionPlacement === 'bottom' && (
        <div className={captionClassName}>
          <AnimatePresence mode="wait">
            <motion.p key={`caption-${slug}-${activeStep}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className={captionTextClassName} style={{ fontFamily: '"Inter", sans-serif' }}>
              {active.caption || `${title} keeps the workflow clear and organized.`}
            </motion.p>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
