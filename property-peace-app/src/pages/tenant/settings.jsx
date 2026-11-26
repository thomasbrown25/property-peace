import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BellOutlined, HighlightOutlined, ProfileOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import SettingsLayout from 'components/settings/SettingsLayout';
import NotificationSettings from 'sections/tenant/settings/NotificationSettings';
import GeneralSettings from 'sections/tenant/settings/GeneralSettings';
import AppearanceSettings from 'sections/tenant/settings/AppearanceSettings';
import AccountSettings from 'sections/tenant/settings/AccountSettings';
import ProfileSettings from 'sections/tenant/settings/ProfileSettings';

// ==============================|| TENANT SETTINGS PAGE ||============================== //

const tabMap = {
  profile: 0,
  general: 1,
  account: 2,
  notifications: 3,
  appearance: 4
};

const tabKeys = Object.keys(tabMap);

const tabConfig = [
  { key: 'profile', label: 'Profile', description: 'Your name, contact details, and tenant profile.', icon: ProfileOutlined, component: ProfileSettings },
  { key: 'general', label: 'General', description: 'Default app behavior and tenant preferences.', icon: SettingOutlined, component: GeneralSettings },
  { key: 'account', label: 'Account Settings', description: 'Login, security, and account-level controls.', icon: UserOutlined, component: AccountSettings },
  { key: 'notifications', label: 'Notifications', description: 'Alerts, reminders, and communication preferences.', icon: BellOutlined, component: NotificationSettings },
  { key: 'appearance', label: 'Appearance', description: 'Theme, color, and display customization.', icon: HighlightOutlined, component: AppearanceSettings }
];

export default function TenantSettings() {
  const [searchParams, setSearchParams] = useSearchParams();

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
        setTab((previousTab) => (previousTab !== newTab ? newTab : previousTab));
      }
    } else {
      setTab((previousTab) => (previousTab !== 0 ? 0 : previousTab));
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
