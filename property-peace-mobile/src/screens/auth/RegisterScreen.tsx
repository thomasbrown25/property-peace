import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppDispatch } from "../../store/hooks";
import { register } from "../../store/user/user.slice";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/types";
import { useGoogleSignIn } from "../../hooks/useGoogleSignIn";
import config from "../../config";
import GoogleLogo from "../../components/GoogleLogo";
import AuthMarketingBackground from "../../components/AuthMarketingBackground";
import AppleSignInButton from "../../components/AppleSignInButton";
import { passwordRequirementStatuses } from "@property-peace/shared/password-validation";
import { prepareAccount, prepareRegistration, prepareGoogleRegistration } from "../../features/auth/registrationValidation";
import authService from "../../services/authService";
import RegistrationChallenge, { registrationChallengeEnabled } from "../../components/auth/RegistrationChallenge";
import {
  CODE_EXPIRY_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  normalizeVerificationCode,
  secondsRemaining,
} from "../../features/auth/emailVerification";

type RegisterScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "Register"
>;

export default function RegisterScreen() {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"account" | "verify" | "details" | "creating">("account");
  const [code, setCode] = useState("");
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [googleProfile, setGoogleProfile] = useState<{
    email: string; emailVerified: boolean; accessToken: string;
  } | null>(null);
  const challengeToken = useRef<{ value: string; receivedAt: number } | null>(null);
  const [challengeReady, setChallengeReady] = useState(false);
  const [challengeGeneration, setChallengeGeneration] = useState(0);
  const resetChallenge = () => {
    challengeToken.current = null;
    setChallengeReady(false);
    setChallengeGeneration((value) => value + 1);
  };
  const consumeChallenge = () => {
    if (!registrationChallengeEnabled) return undefined;
    const token = challengeToken.current;
    challengeToken.current = null;
    setChallengeReady(false);
    if (!token || Date.now() - token.receivedAt > 90_000) {
      throw new Error('Complete the security check again before sending a code.');
    }
    return token.value;
  };
  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn();
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const googleInFlight = useRef(false);
  const showGoogleSignIn =
    Boolean(Platform.OS === "ios" ? config.GOOGLE_IOS_CLIENT_ID : config.GOOGLE_CLIENT_ID);

  useEffect(() => {
    if (step !== "verify" || emailVerified) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [emailVerified, step]);

  const handleSendCode = async () => {
    const account = prepareAccount({ email, password });
    if ("error" in account) {
      setErrorMessage(account.error);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      await authService.sendRegistrationCode(account.data.email, consumeChallenge());
      const timestamp = Date.now();
      setEmail(account.data.email);
      setSentAt(timestamp);
      setNow(timestamp);
      setCode("");
      setStatusMessage("We sent a new six-digit code. It expires in 10 minutes.");
      setStep("verify");
    } catch (error: any) {
      setErrorMessage(error?.message || "We could not send the code. Check your connection and try again.");
    } finally {
      resetChallenge();
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (emailVerified) {
      setStep("details");
      return;
    }
    if (code.length !== 6) {
      setErrorMessage("Enter all 6 digits from your email.");
      return;
    }
    if (secondsRemaining(sentAt, Date.now()) === 0) {
      setErrorMessage("That code has expired. Request a new code to continue.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      await authService.verifyRegistrationCode(email, code);
      setEmailVerified(true);
      setStep("details");
    } catch (error: any) {
      setErrorMessage(error?.message || "We could not verify the code. Request a new one and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!emailVerified && !googleProfile) {
      setErrorMessage("Verify your email before creating an account.");
      setStep("verify");
      return;
    }
    const fields = {
      email, password, firstName, lastName, organizationName, phoneNumber,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    };
    const preparedRegistration = googleProfile
      ? prepareGoogleRegistration(fields, googleProfile)
      : prepareRegistration(fields);
    if ("error" in preparedRegistration) {
      setErrorMessage(preparedRegistration.error);
      return;
    }
    setStep("creating");
    setLoading(true);
    setErrorMessage("");
    try {
      await dispatch(register(preparedRegistration.data)).unwrap();
      // AppNavigator switches to the authenticated stack after registration.
    } catch (error: any) {
      setErrorMessage(error?.message || "We could not finish registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      await authService.resendRegistrationCode(email, consumeChallenge());
      const timestamp = Date.now();
      setSentAt(timestamp);
      setNow(timestamp);
      setCode("");
      setEmailVerified(false);
      setStatusMessage("A new code was sent. The previous code no longer works.");
    } catch (error: any) {
      setErrorMessage(error?.message || "The code could not be resent. Try again.");
    } finally {
      resetChallenge();
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (googleInFlight.current) return;
    if (!showGoogleSignIn) {
      Alert.alert("Error", "Google sign-up is not configured");
      return;
    }

    googleInFlight.current = true;
    setGoogleSubmitting(true);
    try {
      const result = await googleSignIn(true);

      if (result.error) {
        if (result.error !== "Authentication cancelled") {
          Alert.alert("Google Sign-Up Failed", result.error);
        }
        return;
      }

      if (!result.accessToken) {
        Alert.alert("Google Sign-Up Failed", "Google did not return an access token. Please try again.");
        return;
      }

      const profile = await authService.googleSignupProfile(result.accessToken);
      setGoogleProfile(profile);
      setEmail(profile.email.trim().toLowerCase());
      setPassword("");
      setFirstName(profile.firstName || "");
      setLastName(profile.lastName || "");
      setEmailVerified(false);
      setErrorMessage("");
      setStep("details");
    } catch (error: any) {
      Alert.alert("Google Sign-Up Failed", error?.message || "Failed to sign up with Google. Please try again.");
    } finally {
      googleInFlight.current = false;
      setGoogleSubmitting(false);
    }
  };

  const codeSecondsRemaining = sentAt ? secondsRemaining(sentAt, now) : CODE_EXPIRY_SECONDS;
  const resendSecondsRemaining = sentAt
    ? Math.max(0, RESEND_COOLDOWN_SECONDS - Math.floor((now - sentAt) / 1_000))
    : 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <AuthMarketingBackground>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
          <Text style={styles.eyebrow}>ACCOUNT SETUP · {step === "account" ? "01 / 03" : step === "verify" ? "02 / 03" : googleProfile ? "02 / 02" : "03 / 03"}</Text>
          <Text style={styles.title}>{step === "account" ? "Create your landlord account" : step === "verify" ? "Check your inbox" : step === "details" ? "Tell us about your business" : "Creating your account"}</Text>
          <Text style={styles.subtitle}>
            {step === "account" ? "Start with your email and password. We’ll verify your email before setting up your workspace."
              : step === "verify" ? `Enter the six-digit code sent to ${email}.`
              : step === "details" ? `${googleProfile ? `Google verified ${googleProfile.email}. ` : ""}Add the details we need to personalize your workspace. Your phone number is required for account and property communications.`
              : "Please wait while we set up your workspace and complete registration…"}
          </Text>

          {step === "account" && (
            <>
              <TextInput style={styles.input} placeholder="Email *" placeholderTextColor="rgba(255, 255, 255, 0.58)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
              <View style={[styles.passwordContainer, password.length > 0 && styles.passwordContainerWithRequirements]}>
                <TextInput style={styles.passwordInput} placeholder="Password *" placeholderTextColor="rgba(255, 255, 255, 0.58)" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="password-new" textContentType="newPassword" />
                <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword((visible) => !visible)} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
                  <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={22} color="rgba(255, 255, 255, 0.72)" />
                </TouchableOpacity>
              </View>
              {password.length > 0 && (
                <View style={styles.passwordRequirements}>
                  {passwordRequirementStatuses(password).map(({ label, met }) => (
                    <View key={label} style={[styles.requirementChip, met && styles.requirementChipMet]}>
                      <View style={[styles.requirementDot, met && styles.requirementDotMet]} />
                      <Text style={[styles.requirementText, met && styles.requirementTextMet]}>{label}</Text>
                    </View>
                  ))}
                </View>
              )}
              {registrationChallengeEnabled && (
                <RegistrationChallenge key={challengeGeneration} generation={challengeGeneration}
                  onToken={(token) => {
                    challengeToken.current = token ? { value: token, receivedAt: Date.now() } : null;
                    setChallengeReady(Boolean(token));
                    if (token) setErrorMessage("");
                  }}
                  onError={(message) => {
                    setErrorMessage(message);
                    if (message === 'Security check failed. Try again.') resetChallenge();
                  }} />
              )}
              {errorMessage ? <Text style={styles.errorText} accessibilityRole="alert">{errorMessage}</Text> : null}
              {errorMessage.startsWith('Security check') && !errorMessage.includes('not configured') && registrationChallengeEnabled && (
                <TouchableOpacity style={styles.linkButton} onPress={() => { setErrorMessage(''); resetChallenge(); }} accessibilityRole="button">
                  <Text style={styles.linkText}>Retry security check</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.button, (loading || (registrationChallengeEnabled && !challengeReady)) && styles.buttonDisabled]} onPress={handleSendCode} disabled={loading || googleLoading || googleSubmitting || (registrationChallengeEnabled && !challengeReady)} accessibilityRole="button">
                <Text style={styles.buttonText}>{loading ? "Sending code…" : "Send verification code"}</Text>
              </TouchableOpacity>
            </>
          )}
          {step === "verify" && (
            <View style={styles.verificationCard}>
              <Text style={styles.sectionLabel}>EMAIL VERIFICATION</Text>
              {!emailVerified && (
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={code}
                  onChangeText={(value) => { setCode(normalizeVerificationCode(value)); setErrorMessage(""); }}
                  placeholder="000000"
                  placeholderTextColor="rgba(255, 255, 255, 0.35)"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  autoFocus
                  accessibilityLabel="Six-digit email verification code"
                />
              )}
              {!emailVerified && (
                <Text style={[styles.expiryText, codeSecondsRemaining === 0 && styles.errorText]}>
                  {codeSecondsRemaining > 0
                    ? `Code expires in ${Math.floor(codeSecondsRemaining / 60)}:${String(codeSecondsRemaining % 60).padStart(2, "0")}`
                    : "This code has expired. Request a new one."}
                </Text>
              )}
              {statusMessage ? <Text style={styles.statusText} accessibilityRole="text">{statusMessage}</Text> : null}
              {errorMessage ? <Text style={styles.errorText} accessibilityRole="alert">{errorMessage}</Text> : null}
              <TouchableOpacity
                style={[styles.button, (loading || (!emailVerified && codeSecondsRemaining === 0)) && styles.buttonDisabled]}
                onPress={handleVerify}
                disabled={loading || (!emailVerified && codeSecondsRemaining === 0)}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>{loading ? "Verifying…" : emailVerified ? "Continue to details" : "Verify email"}</Text>
              </TouchableOpacity>
              {!emailVerified && registrationChallengeEnabled && (
                <RegistrationChallenge key={challengeGeneration} generation={challengeGeneration}
                  onToken={(token) => {
                    challengeToken.current = token ? { value: token, receivedAt: Date.now() } : null;
                    setChallengeReady(Boolean(token));
                    if (token) setErrorMessage("");
                  }}
                  onError={(message) => {
                    setErrorMessage(message);
                    if (message === 'Security check failed. Try again.') resetChallenge();
                  }} />
              )}
              {errorMessage.startsWith('Security check') && !errorMessage.includes('not configured') && registrationChallengeEnabled && (
                <TouchableOpacity style={styles.linkButton} onPress={() => { setErrorMessage(''); resetChallenge(); }} accessibilityRole="button">
                  <Text style={styles.linkText}>Retry security check</Text>
                </TouchableOpacity>
              )}
              {!emailVerified && (
                <TouchableOpacity style={styles.linkButton} onPress={handleResend} disabled={loading || resendSecondsRemaining > 0 || (registrationChallengeEnabled && !challengeReady)} accessibilityRole="button">
                  <Text style={[styles.linkText, (loading || resendSecondsRemaining > 0) && styles.mutedText]}>
                    {resendSecondsRemaining > 0 ? `Resend code in ${resendSecondsRemaining}s` : "Resend code"}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => { setStep("account"); setCode(""); setErrorMessage(""); setStatusMessage(""); setEmailVerified(false); }}
                disabled={loading}
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>Change email</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === "details" && (
            <>
              <TextInput style={styles.input} placeholder="First Name *" placeholderTextColor="rgba(255, 255, 255, 0.58)" value={firstName} onChangeText={setFirstName} autoCapitalize="words" textContentType="givenName" maxLength={100} />
              <TextInput style={styles.input} placeholder="Last Name *" placeholderTextColor="rgba(255, 255, 255, 0.58)" value={lastName} onChangeText={setLastName} autoCapitalize="words" textContentType="familyName" maxLength={100} />
              <TextInput style={styles.input} placeholder="Workspace or Business Name *" placeholderTextColor="rgba(255, 255, 255, 0.58)" value={organizationName} onChangeText={setOrganizationName} autoCapitalize="words" maxLength={100} />
              <TextInput style={styles.input} placeholder="Phone Number *" placeholderTextColor="rgba(255, 255, 255, 0.58)" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" accessibilityLabel="Phone number, ten-digit US number including area code" />
              <Text style={styles.expiryText}>Enter a complete 10-digit US number, including area code.</Text>
              {errorMessage ? <Text style={styles.errorText} accessibilityRole="alert">{errorMessage}</Text> : null}
              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleCreateAccount} disabled={loading} accessibilityRole="button">
                <Text style={styles.buttonText}>Create account</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkButton} onPress={() => { setErrorMessage(""); if (googleProfile) { setGoogleProfile(null); setEmail(""); setStep("account"); } else setStep("verify"); }} accessibilityRole="button">
                <Text style={styles.linkText}>{googleProfile ? "Use a different sign-up method" : "Back to verification"}</Text>
              </TouchableOpacity>
            </>
          )}
          {step === "creating" && (
            <View style={styles.verificationCard}>
              {errorMessage ? (
                <>
                  <Text style={styles.errorText} accessibilityRole="alert">{errorMessage}</Text>
                  <TouchableOpacity style={styles.button} onPress={handleCreateAccount} disabled={loading} accessibilityRole="button"><Text style={styles.buttonText}>Try again</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.linkButton} onPress={() => { setErrorMessage(""); setStep("details"); }} accessibilityRole="button"><Text style={styles.linkText}>Review details</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate("Login")} accessibilityRole="button"><Text style={styles.linkText}>Go to login</Text></TouchableOpacity>
                </>
              ) : <Text style={styles.statusText} accessibilityRole="text">Setting up your workspace…</Text>}
            </View>
          )}

          {step === "account" && (
            <>
              {Platform.OS === "ios" && <AppleSignInButton mode="sign-up" />}

              {showGoogleSignIn && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[
                  styles.googleButton,
                  (loading || googleLoading || googleSubmitting) && styles.buttonDisabled,
                ]}
                onPress={handleGoogleSignUp}
                disabled={loading || googleLoading || googleSubmitting}
              >
                <View style={styles.googleButtonContent}>
                  <View style={{ marginRight: 12 }}>
                    <GoogleLogo size={20} />
                  </View>
                  <Text style={styles.googleButtonText}>
                    {googleLoading || googleSubmitting ? "Signing up..." : "Sign up with Google"}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={styles.linkText}>
                  Already have an account? Sign In
                </Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.legalLinks}>
            <Text style={styles.legalText}>
              Creating an account means you accept our{" "}
            </Text>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL("https://www.propertypeace.io/terms")
              }
            >
              <Text style={styles.legalLink}>Terms</Text>
            </TouchableOpacity>
            <Text style={styles.legalText}> and </Text>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL("https://www.propertypeace.io/privacy")
              }
            >
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalText}>.</Text>
          </View>
        </ScrollView>
      </AuthMarketingBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#061e35",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  eyebrow: {
    color: "#86efac",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
    textAlign: "left",
    textTransform: "uppercase",
  },
  verificationCard: {
    width: "100%",
  },
  sectionLabel: { color: "#93c5fd", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: 12 },
  codeInput: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 10,
    paddingLeft: 26,
    textAlign: "center",
  },
  expiryText: {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: 13,
    marginBottom: 16,
    textAlign: "center",
  },
  statusText: {
    borderLeftColor: "#4ade80",
    borderLeftWidth: 2,
    color: "#bbf7d0",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "left",
  },
  errorText: {
    color: "#fecaca",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
    textAlign: "center",
  },
  mutedText: {
    opacity: 0.5,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    textAlign: "left",
    marginBottom: 8,
    color: "#fff",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "left",
    marginBottom: 24,
    color: "rgba(255, 255, 255, 0.68)",
    lineHeight: 23,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    fontSize: 16,
    color: "#fff",
  },
  passwordContainer: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  passwordContainerWithRequirements: {
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 14,
    fontSize: 16,
    color: "#fff",
  },
  passwordToggle: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  passwordRequirements: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  requirementChip: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  requirementChipMet: {
    borderColor: "rgba(74, 222, 128, 0.45)",
    backgroundColor: "rgba(34, 197, 94, 0.14)",
  },
  requirementDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.32)",
    marginRight: 6,
  },
  requirementDotMet: {
    backgroundColor: "#4ade80",
  },
  requirementText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 11,
    fontWeight: "600",
  },
  requirementTextMet: {
    color: "#bbf7d0",
  },
  button: {
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 0,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.45)",

  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  linkButton: {
    marginTop: 8,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  linkText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  legalLinks: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  legalText: {
    color: "rgba(255, 255, 255, 0.60)",
    fontSize: 12,
    lineHeight: 18,
  },
  legalLink: {
    color: "#bfdbfe",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  dividerText: {
    marginHorizontal: 16,
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: 14,
    fontWeight: "700",
  },
  googleButton: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",

  },
  googleButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
