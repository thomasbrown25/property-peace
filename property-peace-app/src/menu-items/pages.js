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

// Export as array of groups to support sections
// Dashboard and Team are in their own group (no title)
// Each section is its own group with a title

const pages = [
  // Top section - no title
  {
    id: 'group-top',
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
      },
      {
        id: 'applications',
        title: 'Applications',
        type: 'item',
        url: '/landlord/applications',
        icon: icons.FormOutlined
      },
      {
        id: 'listings',
        title: 'Listings',
        type: 'item',
        url: '/landlord/listings',
        icon: icons.RocketOutlined
      }
    ]
  },
  // FINANCIALS section
  {
    id: 'group-financials',
    type: 'group',
    title: 'FINANCIALS',
    children: [
      {
        id: 'expenses',
        title: 'Expenses',
        type: 'item',
        url: '/landlord/expenses',
        icon: icons.FallOutlined
      },
      {
        id: 'payments',
        title: 'Payments',
        type: 'item',
        url: '/landlord/payments',
        icon: icons.ArrowUpOutlined
      },
      {
        id: 'ledger',
        title: 'Ledger',
        type: 'item',
        url: '/landlord/ledger',
        icon: icons.FormOutlined
      },
      {
        id: 'reports',
        title: 'Reports & Analytics',
        type: 'item',
        url: '/landlord/reports',
        icon: icons.FundOutlined
      },
    ]
  },
  // PROPERTY OPERATIONS section
  {
    id: 'group-property-operations',
    type: 'group',
    title: 'PROPERTY OPERATIONS',
    children: [
      {
        id: 'admin-users',
        title: 'Team & Staff',
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
  },
  // ADDITIONAL FEATURES section
  {
    id: 'group-additional-features',
    type: 'group',
    title: 'ADDITIONAL FEATURES',
    children: [
      {
        id: 'lease-shield',
        title: 'LeaseShield',
        type: 'item',
        url: '/landlord/lease-shield',
        icon: icons.SafetyCertificateOutlined
      }
    ]
  }
];

export default pages;
