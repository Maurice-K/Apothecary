import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/hooks/useAuth";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#FAF9F6" },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="login"
          options={{
            headerShown: true,
            title: "Log In",
            presentation: "modal",
            headerStyle: { backgroundColor: "#FAF9F6" },
            headerTintColor: "#1B4332",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="signup"
          options={{
            headerShown: true,
            title: "Sign Up",
            presentation: "modal",
            headerStyle: { backgroundColor: "#FAF9F6" },
            headerTintColor: "#1B4332",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="recipe/[id]"
          options={{
            headerShown: true,
            title: "Recipe",
            headerStyle: { backgroundColor: "#FAF9F6" },
            headerTintColor: "#1B4332",
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </AuthProvider>
  );
}
