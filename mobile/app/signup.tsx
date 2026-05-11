import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/hooks/useAuth";

export default function SignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signUp(email, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>&#x2709;&#xFE0F;</Text>
          <Text style={styles.heading}>Check your email</Text>
          <Text style={styles.subheading}>
            We sent a confirmation link to {email}. Tap it to activate your account.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => { router.dismiss(); router.push("/login"); }}
          >
            <Text style={styles.buttonText}>Go to Login</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.form}>
        <Text style={styles.heading}>Create account</Text>
        <Text style={styles.subheading}>Join the community and share your recipes</Text>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
          placeholderTextColor="#A8A29E"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          placeholder="At least 6 characters"
          placeholderTextColor="#A8A29E"
        />

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Creating account..." : "Sign Up"}
          </Text>
        </Pressable>

        <Pressable onPress={() => { router.dismiss(); router.push("/login"); }}>
          <Text style={styles.switchText}>
            Already have an account? <Text style={styles.switchLink}>Log in</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF9F6",
  },
  form: {
    padding: 20,
    gap: 10,
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 8,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1B4332",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subheading: {
    fontSize: 15,
    color: "#78716C",
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#44403C",
    marginTop: 4,
  },
  input: {
    backgroundColor: "#F3F1EC",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#1C1917",
    height: 48,
  },
  button: {
    backgroundColor: "#2D6A4F",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
  },
  switchText: {
    textAlign: "center",
    color: "#78716C",
    marginTop: 20,
    fontSize: 14,
  },
  switchLink: {
    color: "#2D6A4F",
    fontWeight: "600",
  },
});
