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
    if (!drawer.isOpenMaintenanceAdd) return;
    axiosServices
      .get('/api/landlord-maintenance-agent/settings')
      .then((res) => {
        if (res.data?.success) {
          setAgentEnabled(res.data.data?.isMaintenanceAgentEnabled ?? false);
        } else {
          setAgentEnabled(false);
        }
      })
      .catch(() => setAgentEnabled(false));
  }, [drawer.isOpenMaintenanceAdd]);

  const handleAgentRequestCreated = async () => {
    if (onAddSuccess) await onAddSuccess();
  };

  if (agentEnabled === null) return null;

  if (agentEnabled === true) {
    return (
      <MaintenanceAgentDrawer
        open={drawer.isOpenMaintenanceAdd}
        onClose={drawer.closeMaintenanceAddDrawer}
        onRequestCreated={handleAgentRequestCreated}
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
