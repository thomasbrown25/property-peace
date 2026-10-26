import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import MaintenanceAPI from '../../api/maintenanceAPI';
import { useAppTheme } from '../../theme/AppTheme';
import TenantMaintenanceIntakeScreen from './TenantMaintenanceIntakeScreen';
import TenantMaintenanceAgentScreen from './TenantMaintenanceAgentScreen';

export default function TenantMaintenanceReportScreen() {
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<'loading' | 'agent' | 'manual'>('loading');
  useEffect(() => {
    let active = true;
    MaintenanceAPI.getTenantAgentSettings()
      .then(enabled => { if (active) setMode(enabled ? 'agent' : 'manual'); })
      .catch(() => { if (active) setMode('manual'); });
    return () => { active = false; };
  }, []);
  if (mode === 'loading') return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>;
  return mode === 'agent'
    ? <TenantMaintenanceAgentScreen onManual={() => setMode('manual')} />
    : <TenantMaintenanceIntakeScreen />;
}
