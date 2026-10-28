import React, { useState } from 'react';
import TenantMaintenanceIntakeScreen from './TenantMaintenanceIntakeScreen';
import TenantMaintenanceAgentScreen from './TenantMaintenanceAgentScreen';

export default function TenantMaintenanceReportScreen() {
  const [mode, setMode] = useState<'agent' | 'manual'>('agent');
  return mode === 'agent'
    ? <TenantMaintenanceAgentScreen onManual={() => setMode('manual')} />
    : <TenantMaintenanceIntakeScreen />;
}
