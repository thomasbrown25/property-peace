// assets
import {
  DashboardOutlined,
  HomeOutlined,
  ToolOutlined,
  DollarCircleOutlined,
  FundOutlined,
  UserOutlined,
  RocketOutlined,
  NotificationOutlined,
  ShopOutlined,
  AuditOutlined,
  RobotOutlined,
  MessageOutlined,
  CreditCardOutlined
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
  NotificationOutlined,
  ShopOutlined,
  AuditOutlined,
  RobotOutlined,
  MessageOutlined,
  CreditCardOutlined
};

// ==============================|| MENU ITEMS - PAGES ||============================== //

// Keep every landlord destination visible. Named groups render as static section
// labels in the drawer; there are no collapsible navigation categories.
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
        id: 'properties-page',
        title: 'Properties',
        type: 'item',
        url: '/landlord/properties',
        icon: icons.HomeOutlined
      },
      {
        id: 'leases',
        title: 'Leases',
        type: 'item',
        url: '/landlord/leases',
        icon: icons.DollarCircleOutlined
      },
      {
        id: 'listings',
        title: 'Listings & Applications',
        type: 'item',
        url: '/landlord/listings',
        icon: icons.RocketOutlined
      }
    ]
  },
  {
    id: 'group-property-operations',
    title: 'Property Operations',
    type: 'group',
    children: [
      {
        id: 'ai-center',
        title: 'Percy',
        type: 'item',
        url: '/landlord/ai-center',
        icon: icons.RobotOutlined
      },
      {
        id: 'inspections',
        title: 'Checklists',
        type: 'item',
        url: '/landlord/checklists',
        icon: icons.AuditOutlined
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
  {
    id: 'group-admin-operations',
    title: 'Admin Operations',
    type: 'group',
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
        id: 'messages',
        title: 'Messages',
        type: 'item',
        url: '/landlord/messages',
        icon: icons.MessageOutlined
      }
    ]
  },
  {
    id: 'group-accounting',
    title: 'Accounting',
    type: 'group',
    children: [
      {
        id: 'online-payments',
        title: 'Online Payments',
        type: 'item',
        url: '/landlord/online-payments',
        icon: icons.CreditCardOutlined
      },
      {
        id: 'finances',
        title: 'Finances',
        type: 'item',
        url: '/landlord/finances',
        icon: icons.DollarCircleOutlined
      },
      {
        id: 'tax-center',
        title: 'Tax Center',
        type: 'item',
        url: '/landlord/accounting/tax-center',
        icon: icons.AuditOutlined
      },
      {
        id: 'reports-analytics',
        title: 'Reports',
        type: 'item',
        url: '/landlord/reports',
        icon: icons.FundOutlined
      }
    ]
  }
];

export default pages;
