import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';

/** Transparent, full-size touch target for secondary screens. */
export default function PageBackButton({ onPress, inHeader = false }: { onPress?: () => void; inHeader?: boolean } = {}) {
  const navigation = useNavigation<any>();
  const { mode, colors } = useAppTheme();

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }, inHeader && styles.headerButton]}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={onPress ?? (() => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('Dashboard');
      })}
    >
      <Ionicons name="arrow-back" size={24} color={mode === 'dark' ? colors.text : '#0b3558'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  headerButton: { marginBottom: 0 },
});
