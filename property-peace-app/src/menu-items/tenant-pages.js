// assets
import {
  DashboardTwoTone,
  FileTextTwoTone,
  ToolTwoTone,
  DollarCircleTwoTone,
  MessageTwoTone,
  FolderTwoTone,
  FormOutlined,
  SafetyCertificateOutlined,
  CreditCardOutlined
} from '@ant-design/icons';

// icons
const icons = {
  DashboardTwoTone,
  FileTextTwoTone,
  ToolTwoTone,
  DollarCircleTwoTone,
  MessageTwoTone,
  FolderTwoTone,
  FormOutlined,
  SafetyCertificateOutlined,
  CreditCardOutlined
};

// ==============================|| MENU ITEMS - TENANT PAGES ||============================== //
// Export as array of groups: main tenant nav + Features section

const tenantPages = [
  {
    id: 'group-tenant-pages',
    type: 'group',
    children: [
      {
        id: 'tenant-dashboard',
        title: 'Dashboard',
        type: 'item',
        url: '/tenant/dashboard',
        icon: icons.DashboardTwoTone
      },
      {
        id: 'tenant-lease',
        title: 'My Lease',
        type: 'item',
        url: '/tenant/lease',
        icon: icons.FileTextTwoTone
      },
      {
        id: 'tenant-applications',
        title: 'Applications',
        type: 'item',
        url: '/tenant/applications',
        icon: icons.FormOutlined
      },
      {
        id: 'tenant-maintenance',
        title: 'Maintenance',
        type: 'item',
        url: '/tenant/maintenance',
        icon: icons.ToolTwoTone
      },
      {
        id: 'tenant-payments',
        title: 'Payments',
        type: 'item',
        url: '/tenant/payments',
        icon: icons.DollarCircleTwoTone
      },
      {
        id: 'tenant-documents',
        title: 'Documents',
        type: 'item',
        url: '/tenant/documents',
        icon: icons.FolderTwoTone
      },
      {
        id: 'tenant-messages',
        title: 'Messages',
        type: 'item',
        url: '/tenant/messages',
        icon: icons.MessageTwoTone
      }
    ]
  },
  {
    id: 'group-tenant-features',
    type: 'group',
    title: 'Features',
    children: [
      {
        id: 'tenant-lease-shield',
        title: 'LeaseShield',
        type: 'item',
        url: '/tenant/lease-shield',
        icon: icons.SafetyCertificateOutlined
      },
      {
        id: 'tenant-subscription',
        title: 'Subscription',
        type: 'item',
        url: '/tenant/subscription',
        icon: icons.CreditCardOutlined
      }
    ]
  }
];

export default tenantPages;

