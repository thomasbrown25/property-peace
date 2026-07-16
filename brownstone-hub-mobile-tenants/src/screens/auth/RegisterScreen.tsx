import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAppDispatch } from '../../store/hooks';
import { register, googleLogin, appleLogin, facebookLogin } from '../../store/user/user.slice';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { useAppleSignIn } from '../../hooks/useAppleSignIn';
import { useFacebookSignIn } from '../../hooks/useFacebookSignIn';
import SocialProviderButton from '../../components/SocialProviderButton';

type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn();
  const { signIn: appleSignIn, loading: appleLoading } = useAppleSignIn();
  const { signIn: facebookSignIn, loading: facebookLoading } = useFacebookSignIn();

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await dispatch(
        register({
          email,
          password,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        })
      ).unwrap();
    } catch (error: any) {
      Alert.alert('Registration Failed', error?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      const result = await googleSignIn();
      
      if (result.error) {
        if (result.error !== 'Authentication cancelled') {
          Alert.alert('Google Sign-Up Failed', result.error);
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
      Alert.alert('Google Sign-Up Failed', error?.message || 'Failed to sign up with Google. Please try again.');
    }
  };

  const handleAppleSignUp = async () => {
    try {
      const result = await appleSignIn();
      
      if (result.error) {
        if (result.error !== 'Authentication cancelled') {
          Alert.alert('Apple Sign-Up Failed', result.error);
        }
        return;
      }

      if (!result.idToken && !result.accessToken) {
        Alert.alert('Error', 'No authentication token received');
        return;
      }

      // Backend handles both new and existing users
      await dispatch(
        appleLogin({
          idToken: result.idToken || undefined,
          accessToken: result.accessToken || undefined,
        })
      ).unwrap();
    } catch (error: any) {
      Alert.alert('Apple Sign-Up Failed', error?.message || 'Failed to sign up with Apple. Please try again.');
    }
  };

  const handleFacebookSignUp = async () => {
    try {
      const result = await facebookSignIn();
      
      if (result.error) {
        if (result.error !== 'Authentication cancelled') {
          Alert.alert('Facebook Sign-Up Failed', result.error);
        }
        return;
      }

      if (!result.accessToken) {
        Alert.alert('Error', 'No access token received');
        return;
      }

      // Backend handles both new and existing users
      await dispatch(
        facebookLogin({
          accessToken: result.accessToken || undefined,
        })
      ).unwrap();
    } catch (error: any) {
      Alert.alert('Facebook Sign-Up Failed', error?.message || 'Failed to sign up with Facebook. Please try again.');
    }
  };

  const isLoading = loading || googleLoading || appleLoading || facebookLoading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoText}>BH</Text>
            </View>
            <Text style={styles.logoTitle}>Brownstone</Text>
            <Text style={styles.logoSubtitle}>Hub</Text>
          </View>

          {/* Sign up instruction */}
          <Text style={styles.instructionText}>Create account</Text>

          <TextInput
            style={styles.input}
            placeholder="First Name (Optional)"
            placeholderTextColor="#666"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Last Name (Optional)"
            placeholderTextColor="#666"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#666"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{loading ? 'Creating Account...' : 'Sign Up'}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or Sign up with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social provider buttons */}
          <View style={styles.socialButtonsContainer}>
            <SocialProviderButton
              provider="apple"
              onPress={handleAppleSignUp}
              disabled={isLoading || Platform.OS !== 'ios'}
            />
            <SocialProviderButton
              provider="google"
              onPress={handleGoogleSignUp}
              disabled={isLoading}
            />
            <SocialProviderButton
              provider="facebook"
              onPress={handleFacebookSignUp}
              disabled={isLoading}
            />
          </View>

          {/* Footer links */}
          <View style={styles.footerLinks}>
            <TouchableOpacity
              style={styles.footerLink}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.footerLinkText}>Sign in</Text>
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
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  logoSubtitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  instructionText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#fff',
  },
  button: {
    backgroundColor: '#1976d2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  footerLink: {
    padding: 8,
  },
  footerLinkText: {
    color: '#1976d2',
    fontSize: 14,
  },
  privacyText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  privacyLink: {
    color: '#1976d2',
  },
});
