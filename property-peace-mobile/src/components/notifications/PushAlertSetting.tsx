import React, { useEffect, useState } from 'react';
import { AppState, Linking, Switch, Text, View } from 'react-native';
import { useAppTheme } from '../../theme/AppTheme';
import { disablePushNotifications, enablePushNotifications, pushRegistrationStatus } from '../../services/pushNotifications';

export default function PushAlertSetting() {
  const { colors } = useAppTheme();
  const [status, setStatus] = useState<'enabled' | 'disabled' | 'unavailable'>('unavailable');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => { void pushRegistrationStatus().then((value) => { if (active) setStatus(value); }).catch(() => {}); };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { active = false; subscription.remove(); };
  }, []);
  const toggle = async (enable: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      if (enable) {
        const result = await enablePushNotifications();
        if (result === 'denied') {
          setMessage('Notifications are blocked in device settings. Open Settings to allow Property Peace alerts.');
          await Linking.openSettings();
        } else if (result === 'unavailable') {
          setMessage('Push notifications require a physical device and a native build.');
        }
      } else {
        await disablePushNotifications();
      }
      setStatus(await pushRegistrationStatus());
    } catch {
      setMessage('Could not update push alerts. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };
  return <View style={{ paddingVertical: 14, gap: 6 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Push alerts on this device</Text>
        <Text style={{ color: colors.text, opacity: 0.7, marginTop: 4 }}>Private details stay in the app, not on your lock screen.</Text>
      </View>
      <Switch accessibilityLabel="Push alerts on this device" value={status === 'enabled'} disabled={busy || status === 'unavailable'} onValueChange={toggle} trackColor={{ false: colors.border, true: colors.accent }} />
    </View>
    {status === 'unavailable' && <Text style={{ color: colors.text }}>Available on a physical device in a native build.</Text>}
    {message && <Text accessibilityRole="alert" style={{ color: colors.text }}>{message}</Text>}
  </View>;
}
