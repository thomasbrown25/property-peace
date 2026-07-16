import React from 'react';
import { TouchableOpacity, View, StyleSheet, Text } from 'react-native';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';

interface SocialProviderButtonProps {
  provider: 'apple' | 'google' | 'facebook';
  onPress: () => void;
  disabled?: boolean;
}

export default function SocialProviderButton({ provider, onPress, disabled }: SocialProviderButtonProps) {
  const getIcon = () => {
    switch (provider) {
      case 'apple':
        return <FontAwesome5 name="apple" size={24} color="#fff" />;
      case 'google':
        return (
          <View style={styles.googleIconContainer}>
            <Text style={styles.googleG}>G</Text>
          </View>
        );
      case 'facebook':
        return <FontAwesome5 name="facebook-f" size={20} color="#1877F2" />;
      default:
        return null;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        provider === 'apple' && styles.appleButton,
        provider === 'google' && styles.googleButton,
        provider === 'facebook' && styles.facebookButton,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {getIcon()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E0E0',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E0E0',
  },
  facebookButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E0E0',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  googleIconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleG: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  facebookIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
  },
});
