import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useAppDispatch } from '../store/hooks';
import { appleLogin } from '../store/user/user.slice';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';

type Props = {
  mode?: 'sign-in' | 'sign-up';
};

export default function AppleSignInButton({ mode = 'sign-in' }: Props) {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  if (!available) return null;

  const handlePress = async () => {
    setLoading(true);
    try {
      const nonce = Crypto.randomUUID();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token.');
      }

      const result = await dispatch(appleLogin({
        identityToken: credential.identityToken,
        nonce,
        firstName: credential.fullName?.givenName ?? undefined,
        lastName: credential.fullName?.familyName ?? undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })).unwrap();
      if (result.kind === 'challenge') {
        navigation.navigate('MfaVerification', { challenge: result.challenge });
      }
    } catch (error: any) {
      if (error?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign in with Apple failed', error?.message || 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, loading && styles.loading]} pointerEvents={loading ? 'none' : 'auto'}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={mode === 'sign-up'
          ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
          : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={14}
        style={styles.button}
        onPress={handlePress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 16,
  },
  button: {
    width: '100%',
    height: 52,
  },
  loading: {
    opacity: 0.6,
  },
});
