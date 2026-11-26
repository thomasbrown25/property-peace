import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import {
  SettingOutlined,
  UserOutlined,
  DollarOutlined,
  CreditCardOutlined,
  BellOutlined,
  HighlightOutlined,
  ProfileOutlined,
  MobileOutlined
} from '@ant-design/icons';
import SettingsLayout from 'components/settings/SettingsLayout';
import NotificationSettings from 'sections/landlord/settings/NotificationSettings';
import GeneralSettings from 'sections/landlord/settings/GeneralSettings';
import AppearanceSettings from 'sections/landlord/settings/AppearanceSettings';
import AccountSettings from 'sections/landlord/settings/AccountSettings';
import OnlinePaymentSettings from 'sections/landlord/settings/OnlinePaymentSettings';
import ProfileSettings from 'sections/landlord/settings/ProfileSettings';
import SmsNumberSettings from 'sections/landlord/settings/SmsNumberSettings';
import SubscriptionSettings from 'sections/landlord/settings/SubscriptionSettings';

// ==============================|| SETTINGS PAGE ||============================== //

const tabMap = {
  general: 0,
  profile: 1,
  account: 2,
  subscription: 3,
  payments: 4,
  smsnumber: 5,
  notifications: 6,
  appearance: 7
};

const tabKeys = Object.keys(tabMap);

const tabConfig = [
  { key: 'general', label: 'General', description: 'Default app behavior and landlord preferences.', icon: SettingOutlined, component: GeneralSettings },
  { key: 'profile', label: 'Profile', description: 'Your name, contact details, and public identity.', icon: ProfileOutlined, component: ProfileSettings },
  { key: 'account', label: 'Account Settings', description: 'Login, security, and account-level controls.', icon: UserOutlined, component: AccountSettings },
  { key: 'subscription', label: 'Manage Subscription', description: 'Plans, portfolio usage, billing details, and invoices.', icon: CreditCardOutlined, component: SubscriptionSettings },
  { key: 'payments', label: 'Online Rent Payments', description: 'Set up Stripe and manage bank accounts and rent payouts.', icon: DollarOutlined, component: OnlinePaymentSettings },
  { key: 'smsnumber', label: 'SMS Number Settings', description: 'Dedicated tenant texting number, routing, and setup.', icon: MobileOutlined, component: SmsNumberSettings },
  { key: 'notifications', label: 'Notifications', description: 'Alerts, reminders, and communication preferences.', icon: BellOutlined, component: NotificationSettings },
  { key: 'appearance', label: 'Appearance', description: 'Theme, color, and display customization.', icon: HighlightOutlined, component: AppearanceSettings }
];

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSettingsLoading } = useDashboardLoading();

  useEffect(() => {
    setSettingsLoading(false);
  }, [setSettingsLoading]);

  const getInitialTab = () => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabMap[tabParam.toLowerCase()] !== undefined) {
      return tabMap[tabParam.toLowerCase()];
    }
    return 0;
  };

  const [tab, setTab] = useState(() => getInitialTab());

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const normalizedTab = tabParam.toLowerCase();
      if (tabMap[normalizedTab] !== undefined) {
        const newTab = tabMap[normalizedTab];
        setTab((prevTab) => (prevTab !== newTab ? newTab : prevTab));
      }
    } else {
      setTab((prevTab) => (prevTab !== 0 ? 0 : prevTab));
    }
  }, [searchParams]);

  const updateTab = (newValue) => {
    setTab(newValue);
    const tabKey = tabKeys.find((key) => tabMap[key] === newValue);
    if (tabKey) {
      setSearchParams({ tab: tabKey });
    }
  };

  return <SettingsLayout tabs={tabConfig} selectedIndex={tab} onTabChange={updateTab} />;
}
