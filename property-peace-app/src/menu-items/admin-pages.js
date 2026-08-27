// assets
import {
  DashboardTwoTone,
  UsergroupAddOutlined,
  DollarCircleTwoTone,
  SettingTwoTone,
  CustomerServiceOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  MailOutlined,
  DatabaseOutlined
} from '@ant-design/icons';

// icons
const icons = {
  DashboardTwoTone,
  UsergroupAddOutlined,
  DollarCircleTwoTone,
  SettingTwoTone,
  CustomerServiceOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  MailOutlined,
  DatabaseOutlined
};

// ==============================|| MENU ITEMS - ADMIN PAGES ||============================== //

const adminPages = {
  id: 'group-admin-pages',
  type: 'group',
  children: [
    {
      id: 'admin-dashboard',
      title: 'Admin Dashboard',
      type: 'item',
      url: '/admin/dashboard',
      icon: icons.DashboardTwoTone
    },
    {
      id: 'admin-jobs',
      title: 'Jobs',
      type: 'item',
      url: '/admin/jobs',
      icon: icons.ThunderboltOutlined
    },
    {
      id: 'admin-lease-shield',
      title: 'LeaseShield',
      type: 'item',
      url: '/admin/lease-shield',
      icon: icons.SafetyCertificateOutlined
    },

    {
      id: 'admin-subscriptions',
      title: 'Subscriptions',
      type: 'item',
      url: '/admin/subscriptions',
      icon: icons.DollarCircleTwoTone
    },
    {
      id: 'admin-users',
      title: 'Users',
      type: 'item',
      url: '/admin/users',
      icon: icons.UsergroupAddOutlined
    },
    {
      id: 'admin-storage',
      title: 'Storage',
      type: 'item',
      url: '/admin/storage',
      icon: icons.DatabaseOutlined
    },
    {
      id: 'admin-invite-landlord',
      title: 'Invite Landlord',
      type: 'item',
      url: '/admin/invite-landlord',
      icon: icons.UsergroupAddOutlined
    },
    {
      id: 'admin-broadcast-email',
      title: 'Broadcast Email',
      type: 'item',
      url: '/admin/broadcast-email',
      icon: icons.MailOutlined
    },
    {
      id: 'admin-upcoming-features',
      title: 'Upcoming Features',
      type: 'item',
      url: '/admin/upcoming-features',
      icon: icons.RocketOutlined
    },
    {
      id: 'admin-stripe-payees',
      title: 'Stripe Payees',
      type: 'item',
      url: '/admin/stripe-payees',
      icon: icons.SafetyCertificateOutlined
    },
    {
      id: 'admin-rent-payment-access',
      title: 'Rent payment access',
      type: 'item',
      url: '/admin/rent-payment-access',
      icon: icons.SafetyCertificateOutlined
    },
    {
      id: 'admin-settings',
      title: 'Settings',
      type: 'item',
      url: '/admin/settings',
      icon: icons.SettingTwoTone
    },
    {
      id: 'admin-messages',
      title: 'Support',
      type: 'item',
      url: '/admin/messages',
      icon: icons.CustomerServiceOutlined
    }
  ]
};

export default adminPages;

