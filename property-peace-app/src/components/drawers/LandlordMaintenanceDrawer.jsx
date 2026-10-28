import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDrawer } from 'contexts/DrawerContext';
import MaintenanceAgentDrawer from 'pages/tenant/MaintenanceAgentDrawer';
import MaintenanceAddDrawer from './MaintenanceAddDrawer';

export default function LandlordMaintenanceDrawer({ onAddSuccess }) {
  const drawer = useDrawer();
  const [agentEnabled, setAgentEnabled] = useState(true);

  useEffect(() => {
    if (!drawer.isOpenMaintenanceAdd) setAgentEnabled(true);
  }, [drawer.isOpenMaintenanceAdd]);

  const handleAgentRequestCreated = async () => {
    if (onAddSuccess) await onAddSuccess();
  };

  const handleAgentUnavailable = () => {
    setAgentEnabled(false);
  };

  if (agentEnabled) {
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
