import React from 'react';
import { FontAwesome5 } from '@expo/vector-icons';

export default function GoogleLogo({ size = 20 }: { size?: number }) {
  return <FontAwesome5 name="google" size={size} color="#4285F4" />;
}
