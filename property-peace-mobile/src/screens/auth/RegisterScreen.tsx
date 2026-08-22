import React, { useState } from "react";
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
import { register, googleLogin } from "../../store/user/user.slice";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/types";
import { useGoogleSignIn } from "../../hooks/useGoogleSignIn";
import config from "../../config";
import GoogleLogo from "../../components/GoogleLogo";
import AuthMarketingBackground from "../../components/AuthMarketingBackground";
import AppleSignInButton from "../../components/AppleSignInButton";
import { passwordRequirementStatuses } from "@property-peace/shared/password-validation";
import { prepareRegistration } from "../../features/auth/registrationValidation";

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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn();
  const showGoogleSignIn =
    Platform.OS !== "ios" && Boolean(config.GOOGLE_CLIENT_ID);

  const handleRegister = async () => {
    const preparedRegistration = prepareRegistration({
      email,
      password,
      firstName,
      lastName,
    });
    if ("error" in preparedRegistration) {
      Alert.alert("Error", preparedRegistration.error);
      return;
    }

    setLoading(true);
    try {
      await dispatch(register(preparedRegistration.data)).unwrap();
      // Navigation will be handled by AppNavigator based on auth state
    } catch (error: any) {
      Alert.alert(
        "Registration Failed",
        error?.message || "Failed to create account. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!config.GOOGLE_CLIENT_ID) {
      Alert.alert("Error", "Google sign-up is not configured");
      return;
    }

    try {
      const result = await googleSignIn();

      if (result.error) {
        if (result.error !== "Authentication cancelled") {
          Alert.alert("Google Sign-Up Failed", result.error);
        }
        return;
      }

      if (!result.accessToken && !result.idToken) {
        Alert.alert("Error", "No authentication token received");
        return;
      }

      await dispatch(
        googleLogin({
          idToken: result.idToken || undefined,
          accessToken: result.accessToken || undefined,
        }),
      ).unwrap();
      // Navigation will be handled by AppNavigator based on auth state
    } catch (error: any) {
      const errorMessage =
        error?.message || "Failed to sign up with Google. Please try again.";

      // Check if registration code is needed
      if (
        errorMessage.toLowerCase().includes("registration code") ||
        errorMessage.toLowerCase().includes("invite")
      ) {
        Alert.alert(
          "Registration Code Required",
          "A registration code is required to create a new account. Please contact your administrator or use email registration.",
          [{ text: "OK" }],
        );
      } else {
        Alert.alert("Google Sign-Up Failed", errorMessage);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <AuthMarketingBackground>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Start organizing rentals from one calm dashboard.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="First Name *"
            placeholderTextColor="rgba(255, 255, 255, 0.58)"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Last Name *"
            placeholderTextColor="rgba(255, 255, 255, 0.58)"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Email *"
            placeholderTextColor="rgba(255, 255, 255, 0.58)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <View
            style={[
              styles.passwordContainer,
              password.length > 0 && styles.passwordContainerWithRequirements,
            ]}
          >
            <TextInput
              style={styles.passwordInput}
              placeholder="Password *"
              placeholderTextColor="rgba(255, 255, 255, 0.58)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password-new"
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword((visible) => !visible)}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Hide password" : "Show password"
              }
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={22}
                color="rgba(255, 255, 255, 0.72)"
              />
            </TouchableOpacity>
          </View>

          {password.length > 0 && (
            <View style={styles.passwordRequirements}>
              {passwordRequirementStatuses(password).map(({ label, met }) => (
                <View
                  key={label}
                  style={[
                    styles.requirementChip,
                    met && styles.requirementChipMet,
                  ]}
                >
                  <View
                    style={[
                      styles.requirementDot,
                      met && styles.requirementDotMet,
                    ]}
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      met && styles.requirementTextMet,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading || googleLoading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Creating Account..." : "Create Account"}
            </Text>
          </TouchableOpacity>

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
                  (loading || googleLoading) && styles.buttonDisabled,
                ]}
                onPress={handleGoogleSignUp}
                disabled={loading || googleLoading}
              >
                <View style={styles.googleButtonContent}>
                  <View style={{ marginRight: 12 }}>
                    <GoogleLogo size={20} />
                  </View>
                  <Text style={styles.googleButtonText}>
                    {googleLoading ? "Signing up..." : "Sign up with Google"}
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
  title: {
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
    color: "#fff",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 28,
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
    marginBottom: 14,
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
    marginBottom: 14,
  },
  passwordContainerWithRequirements: {
    marginBottom: 10,
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
    gap: 7,
    marginBottom: 14,
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
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.45)",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 5,
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
    marginTop: 16,
    alignItems: "center",
  },
  linkText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  legalLinks: {
    marginTop: 22,
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
    marginVertical: 18,
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
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    shadowColor: "#020617",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 2,
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
