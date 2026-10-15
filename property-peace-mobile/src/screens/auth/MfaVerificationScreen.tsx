import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AuthMarketingBackground from '../../components/AuthMarketingBackground';
import { AuthStackParamList } from '../../navigation/types';
import { useAppDispatch } from '../../store/hooks';
import { verifyMfaLogin } from '../../store/user/user.slice';

type Props = NativeStackScreenProps<AuthStackParamList, 'MfaVerification'>;

export default function MfaVerificationScreen({ navigation, route }: Props) {
  const dispatch = useAppDispatch();
  const { challenge } = route.params;
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const description = useMemo(() => {
    if (challenge.method === 'sms') {
      return `Enter the 6-digit code sent to ${challenge.maskedDestination || 'your verified mobile number'}.`;
    }
    return 'Enter the current 6-digit code from your authenticator app.';
  }, [challenge.maskedDestination, challenge.method]);

  const handleVerify = async () => {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setError('');
    try {
      await dispatch(verifyMfaLogin({ challengeId: challenge.challengeId, code })).unwrap();
    } catch (verifyError: any) {
      setError(verifyError?.message || 'That security code could not be verified.');
      setVerifying(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <AuthMarketingBackground>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Secure sign in</Text>
          </View>
          <Text style={styles.title}>Verify it’s you</Text>
          <Text style={styles.subtitle}>Complete one more step to securely sign in.</Text>

          <View style={styles.card}>
            <Text style={styles.method}>
              {challenge.method === 'sms' ? 'Text message' : 'Authenticator app'}
            </Text>
            <Text style={styles.description}>{description}</Text>
            <TextInput
              autoFocus
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              style={styles.input}
              placeholder="000000"
              placeholderTextColor="rgba(255, 255, 255, 0.35)"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              accessibilityLabel="Multi-factor security code"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, (code.length !== 6 || verifying) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={code.length !== 6 || verifying}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{verifying ? 'Verifying…' : 'Verify and sign in'}</Text>
            </TouchableOpacity>
          </View>

          {challenge.expiresAt ? (
            <Text style={styles.expires}>
              This request expires at {new Date(challenge.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={verifying}
            accessibilityRole="button"
          >
            <Text style={styles.backText}>Back to login</Text>
          </TouchableOpacity>
        </ScrollView>
      </AuthMarketingBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#061e35' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 36 },
  badge: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  badgeText: { color: '#93c5fd', fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 34, fontWeight: '800', textAlign: 'left', marginBottom: 8 },
  subtitle: { color: 'rgba(255, 255, 255, 0.68)', fontSize: 16, textAlign: 'left', lineHeight: 23, marginBottom: 30 },
  card: { width: '100%' },
  method: { color: '#93c5fd', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  description: { color: 'rgba(255, 255, 255, 0.72)', fontSize: 14, lineHeight: 21, marginBottom: 16 },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.45)',
    backgroundColor: 'rgba(6, 30, 53, 0.75)',
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 10,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  error: { color: '#fecaca', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  button: { minHeight: 52, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  expires: { color: 'rgba(255, 255, 255, 0.56)', textAlign: 'left', fontSize: 12, marginTop: 16 },
  backButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  backText: { color: '#bfdbfe', fontSize: 14, fontWeight: '700' },
});
