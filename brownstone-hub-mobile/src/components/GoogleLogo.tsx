import React from 'react';
import { FontAwesome5 } from '@expo/vector-icons';

// Simple Google logo using FontAwesome icon
// This avoids the react-native-svg dependency issue
export default function GoogleLogo({ size = 20 }: { size?: number }) {
  return <FontAwesome5 name="google" size={size} color="#4285F4" />;
}
