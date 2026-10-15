import React from 'react';
import { Image } from 'react-native';

export default function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/g-logo.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible
      accessibilityLabel="Google"
    />
  );
}
