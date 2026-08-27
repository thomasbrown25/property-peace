import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDrawer } from 'contexts/DrawerContext';
import MaintenanceAgentDrawer from 'pages/tenant/MaintenanceAgentDrawer';
import MaintenanceAddDrawer from './MaintenanceAddDrawer';
import axiosServices from 'utils/axios';

export default function LandlordMaintenanceDrawer({ onAddSuccess }) {
  const drawer = useDrawer();
  const [agentEnabled, setAgentEnabled] = useState(null);

  useEffect(() => {
    if (!drawer.isOpenMaintenanceAdd) {
      setAgentEnabled(null);
      return undefined;
    }

    let isCurrent = true;
    setAgentEnabled(null);

    axiosServices
      .get('/api/landlord-maintenance-agent/settings')
      .then((res) => {
        const enabled = res.data?.success
          ? (res.data.data?.isMaintenanceAgentEnabled ?? false)
          : false;
        if (isCurrent) setAgentEnabled(enabled);
      })
      .catch(() => {
        if (isCurrent) setAgentEnabled(false);
      });

    return () => { isCurrent = false; };
  }, [drawer.isOpenMaintenanceAdd]);

  const handleAgentRequestCreated = async () => {
    if (onAddSuccess) await onAddSuccess();
  };

  const handleAgentUnavailable = () => {
    setAgentEnabled(false);
  };

  if (agentEnabled === null) return null;

  if (agentEnabled === true) {
    return (
      <MaintenanceAgentDrawer
        open={drawer.isOpenMaintenanceAdd}
        onClose={drawer.closeMaintenanceAddDrawer}
        onRequestCreated={handleAgentRequestCreated}
        onUnavailable={handleAgentUnavailable}
        subtitle="Active · Landlord-initiated"
        chatEndpoint="/api/landlord-maintenance-agent/chat"
        initialContext={drawer.maintenanceAddInitialValues}
      />
    );
  }

  return <MaintenanceAddDrawer onAddSuccess={onAddSuccess} />;
}

LandlordMaintenanceDrawer.propTypes = {
  onAddSuccess: PropTypes.func
};
