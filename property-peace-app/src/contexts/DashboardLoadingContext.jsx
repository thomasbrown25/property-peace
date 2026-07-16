import { createContext, useContext, useState } from 'react';

const DashboardLoadingContext = createContext({
  isDashboardLoading: false,
  isPropertyLoading: false,
  isPropertiesLoading: false,
  isExpensesLoading: false,
  isLeasesLoading: false,
  isLeaseLoading: false,
  isMaintenancesLoading: false,
  isTenantsLoading: false,
  isMessagesLoading: false,
  isReportsLoading: false,
  isSettingsLoading: false,
  isAccountingLoading: false,
  setDashboardLoading: () => {},
  setPropertyLoading: () => {},
  setPropertiesLoading: () => {},
  setExpensesLoading: () => {},
  setLeasesLoading: () => {},
  setLeaseLoading: () => {},
  setMaintenancesLoading: () => {},
  setTenantsLoading: () => {},
  setMessagesLoading: () => {},
  setReportsLoading: () => {},
  setSettingsLoading: () => {},
  setAccountingLoading: () => {}
});

export const useDashboardLoading = () => {
  const context = useContext(DashboardLoadingContext);
  if (!context) {
    return {
      isDashboardLoading: false,
      isPropertyLoading: false,
      isPropertiesLoading: false,
      isExpensesLoading: false,
      isLeasesLoading: false,
      isLeaseLoading: false,
      isMaintenancesLoading: false,
      isTenantsLoading: false,
      isMessagesLoading: false,
      isReportsLoading: false,
      isSettingsLoading: false,
      isAccountingLoading: false,
      setDashboardLoading: () => {},
      setPropertyLoading: () => {},
      setPropertiesLoading: () => {},
      setExpensesLoading: () => {},
      setLeasesLoading: () => {},
      setLeaseLoading: () => {},
      setMaintenancesLoading: () => {},
      setTenantsLoading: () => {},
      setMessagesLoading: () => {},
      setReportsLoading: () => {},
      setSettingsLoading: () => {},
      setAccountingLoading: () => {}
    };
  }
  return context;
};

export const DashboardLoadingProvider = ({ children }) => {
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isPropertyLoading, setIsPropertyLoading] = useState(false);
  const [isPropertiesLoading, setIsPropertiesLoading] = useState(false);
  const [isExpensesLoading, setIsExpensesLoading] = useState(false);
  const [isLeasesLoading, setIsLeasesLoading] = useState(false);
  const [isLeaseLoading, setIsLeaseLoading] = useState(false);
  const [isMaintenancesLoading, setIsMaintenancesLoading] = useState(false);
  const [isTenantsLoading, setIsTenantsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [isAccountingLoading, setIsAccountingLoading] = useState(false);

  return (
    <DashboardLoadingContext.Provider value={{
      isDashboardLoading,
      isPropertyLoading,
      isPropertiesLoading,
      isExpensesLoading,
      isLeasesLoading,
      isLeaseLoading,
      isMaintenancesLoading,
      isTenantsLoading,
      isMessagesLoading,
      isReportsLoading,
      isSettingsLoading,
      isAccountingLoading,
      setDashboardLoading: setIsDashboardLoading,
      setPropertyLoading: setIsPropertyLoading,
      setPropertiesLoading: setIsPropertiesLoading,
      setExpensesLoading: setIsExpensesLoading,
      setLeasesLoading: setIsLeasesLoading,
      setLeaseLoading: setIsLeaseLoading,
      setMaintenancesLoading: setIsMaintenancesLoading,
      setTenantsLoading: setIsTenantsLoading,
      setMessagesLoading: setIsMessagesLoading,
      setReportsLoading: setIsReportsLoading,
      setSettingsLoading: setIsSettingsLoading,
      setAccountingLoading: setIsAccountingLoading
    }}>
      {children}
    </DashboardLoadingContext.Provider>
  );
};
