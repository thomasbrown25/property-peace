// assets
import {
  DashboardOutlined,
  HomeOutlined,
  ToolOutlined,
  DollarCircleOutlined,
  FundOutlined,
  UserOutlined,
  RocketOutlined,
  FormOutlined,
  ArrowUpOutlined,
  NotificationOutlined,
  FallOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  AuditOutlined,
  RobotOutlined,
  CalendarOutlined,
  MessageOutlined
} from '@ant-design/icons';

// icons
const icons = {
  DashboardOutlined,
  HomeOutlined,
  ToolOutlined,
  DollarCircleOutlined,
  FundOutlined,
  UserOutlined,
  RocketOutlined,
  FormOutlined,
  ArrowUpOutlined,
  NotificationOutlined,
  FallOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  AuditOutlined,
  RobotOutlined,
  CalendarOutlined,
  MessageOutlined
};

// ==============================|| MENU ITEMS - PAGES ||============================== //

// Keep the core destinations visible and group the longer feature list into
// expandable categories. Support and Settings remain anchored below the menu.
const pages = [
  {
    id: 'group-landlord-navigation',
    type: 'group',
    children: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        type: 'item',
        url: '/landlord/dashboard',
        icon: icons.DashboardOutlined
      },
      {
        id: 'portfolio',
        title: 'Portfolio',
        type: 'collapse',
        icon: icons.HomeOutlined,
        children: [
          {
            id: 'properties-page',
            title: 'Properties',
            type: 'item',
            url: '/landlord/properties',
            icon: icons.HomeOutlined
          },
          {
            id: 'tenants',
            title: 'Tenants',
            type: 'item',
            url: '/landlord/tenants',
            icon: icons.UserOutlined
          },
          {
            id: 'leases',
            title: 'Leases',
            type: 'item',
            url: '/landlord/leases',
            icon: icons.DollarCircleOutlined
          },
          {
            id: 'inspections',
            title: 'Checklists',
            type: 'item',
            url: '/landlord/checklists',
            icon: icons.AuditOutlined
          }
        ]
      },
      {
        id: 'ai-center',
        title: 'Percy',
        type: 'item',
        url: '/landlord/ai-center',
        icon: icons.RobotOutlined
      },
      {
        id: 'calendar',
        title: 'Calendar',
        type: 'item',
        url: '/landlord/calendar',
        icon: icons.CalendarOutlined
      },
      {
        id: 'messages',
        title: 'Messages',
        type: 'item',
        url: '/landlord/messages',
        icon: icons.MessageOutlined
      },
      {
        id: 'money-center',
        title: 'Money Center',
        type: 'collapse',
        icon: icons.DollarCircleOutlined,
        children: [
          {
            id: 'money',
            title: 'Money',
            type: 'item',
            url: '/landlord/money',
            icon: icons.DollarCircleOutlined
          },
          {
            id: 'rent-collection',
            title: 'Rent Collection',
            type: 'item',
            url: '/landlord/rent-collection',
            icon: icons.DollarCircleOutlined
          }
        ]
      },
      {
        id: 'leads',
        title: 'Leads & Showings',
        type: 'item',
        url: '/landlord/leads',
        icon: icons.FormOutlined
      },
      {
        id: 'leasing',
        title: 'Leasing',
        type: 'collapse',
        icon: icons.RocketOutlined,
        children: [
          {
            id: 'applications',
            title: 'Applications',
            type: 'item',
            url: '/landlord/applications',
            icon: icons.FormOutlined
          },
          {
            id: 'screenings',
            title: 'Screenings',
            type: 'item',
            url: '/landlord/screenings',
            icon: icons.SafetyCertificateOutlined
          },
          {
            id: 'listings',
            title: 'Listings',
            type: 'item',
            url: '/landlord/listings',
            icon: icons.RocketOutlined
          },
          {
            id: 'lease-shield',
            title: 'LeaseShield',
            type: 'item',
            url: '/landlord/lease-shield',
            icon: icons.SafetyCertificateOutlined
          }
        ]
      },
      {
        id: 'accounting',
        title: 'Accounting',
        type: 'collapse',
        icon: icons.FundOutlined,
        children: [
          {
            id: 'payments',
            title: 'Payments',
            type: 'item',
            url: '/landlord/payments',
            icon: icons.ArrowUpOutlined
          },
          {
            id: 'expenses',
            title: 'Expenses',
            type: 'item',
            url: '/landlord/expenses',
            icon: icons.FallOutlined
          },

          {
            id: 'ledger',
            title: 'Ledger',
            type: 'item',
            url: '/landlord/ledger',
            icon: icons.FormOutlined
          },
          {
            id: 'tax-center',
            title: 'Tax Center',
            type: 'item',
            url: '/landlord/money/tax-center',
            icon: icons.AuditOutlined
          },
          {
            id: 'reports-analytics',
            title: 'Reports & Analytics',
            type: 'item',
            url: '/landlord/reports',
            icon: icons.FundOutlined
          }
        ]
      },
      {
        id: 'operations',
        title: 'Operations',
        type: 'collapse',
        icon: icons.ToolOutlined,
        children: [
          {
            id: 'admin-users',
            title: 'Team',
            type: 'item',
            url: '/landlord/admin-members',
            icon: icons.UserOutlined
          },
          {
            id: 'announcements',
            title: 'Announcements',
            type: 'item',
            url: '/landlord/announcements',
            icon: icons.NotificationOutlined
          },
          {
            id: 'maintenances',
            title: 'Maintenance',
            type: 'item',
            url: '/landlord/maintenances',
            icon: icons.ToolOutlined
          },
          {
            id: 'vendors',
            title: 'Vendors',
            type: 'item',
            url: '/landlord/vendors',
            icon: icons.ShopOutlined
          }
        ]
      }
    ]
  }
];

export default pages;
