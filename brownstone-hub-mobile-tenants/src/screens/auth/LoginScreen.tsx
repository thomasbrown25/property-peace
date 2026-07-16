import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAppDispatch } from '../../store/hooks';
import { googleLogin } from '../../store/user/user.slice';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import SocialProviderButton from '../../components/SocialProviderButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn();

  const handleEmailLogin = () => {
    navigation.navigate('EmailLogin');
  };

  const handleGoogleSignIn = async () => {
    try {
      const result = await googleSignIn();
      
      if (result.error) {
        if (result.error !== 'Authentication cancelled') {
          Alert.alert('Google Sign-In Failed', result.error);
        }
        return;
      }

      if (!result.accessToken && !result.idToken) {
        Alert.alert('Error', 'No authentication token received');
        return;
      }

      // Backend handles both new and existing users
      await dispatch(
        googleLogin({
          idToken: result.idToken || undefined,
          accessToken: result.accessToken || undefined,
        })
      ).unwrap();
    } catch (error: any) {
      Alert.alert('Google Sign-In Failed', error?.message || 'Failed to sign in with Google. Please try again.');
    }
  };

  const isLoading = googleLoading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { paddingTop: Math.max(insets.top, 20) }]}>
          {/* Centered content container */}
          <View style={styles.centeredContent}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Text style={styles.logoText}>BH</Text>
              </View>
              <Text style={styles.logoTitle}>
                <Text style={styles.logoTitleBlue}>Brownstone Hub</Text>
                <Text style={styles.logoTitleGray}> for Tenants</Text>
              </Text>
              <Text style={styles.subtitle}>Welcome back! Please sign in to continue.</Text>
            </View>

            {/* Sign in with Email button */}
            <TouchableOpacity
              style={[styles.emailButton, isLoading && styles.buttonDisabled]}
              onPress={handleEmailLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.emailButtonText}>Sign in with Email</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social provider buttons - Only Google */}
            <View style={styles.socialButtonsContainer}>
              <SocialProviderButton
                provider="google"
                onPress={handleGoogleSignIn}
                disabled={isLoading}
              />
            </View>
          </View>

          {/* Spacer to push footer to bottom */}
          <View style={styles.spacer} />

          {/* Footer links */}
          <View style={styles.footerLinks}>
            <TouchableOpacity
              style={styles.footerLink}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.footerLinkText}>Reset password</Text>
            </TouchableOpacity>
            <View style={styles.footerDivider} />
            <TouchableOpacity
              style={styles.footerLink}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.footerLinkText}>Create account</Text>
            </TouchableOpacity>
          </View>

          {/* Privacy notice */}
          <Text style={styles.privacyText}>
            This app is protected by reCAPTCHA and the Google{' '}
            <Text style={styles.privacyLink}>Privacy Policy</Text> and{' '}
            <Text style={styles.privacyLink}>Terms of Service</Text> apply.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 40,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
    width: '100%',
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  logoTitleBlue: {
    color: '#1976d2',
  },
  logoTitleGray: {
    color: '#666666',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  emailButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999999',
    fontSize: 14,
    fontWeight: '500',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  footerLink: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  footerLinkText: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '500',
  },
  footerDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
  },
  privacyText: {
    fontSize: 11,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
  },
  privacyLink: {
    color: '#1976d2',
    textDecorationLine: 'underline',
  },
});
