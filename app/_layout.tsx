import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { Ionicons } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CartProvider } from "@/lib/cartContext";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useUpdates } from "expo-updates";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnimatedSplash } from "@/components/AnimatedSplash";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkToast } from "@/components/NetworkToast";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";
import { NotificationRescueModal } from "@/components/NotificationRescueModal";
import {
  requestNotificationPermissions,
  scheduleRetentionNotifications,
} from "@/utils/notifications";
import { registerPushToken } from "@/utils/pushTokenLink";
import {
  parseClerkRuntimeConfig,
  type ClerkRuntimeConfig,
} from "@/utils/clerkRuntimeConfig";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const bundledClerkPublishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const bundledClerkProxyUrl =
  process.env.EXPO_PUBLIC_CLERK_PROXY_URL ?? "";

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? "https://dt-tour.com/api").replace(/\/$/, "");
const WEB_PAGE_TITLE = "DT Tours App - Your next trip starts here !";

function reportError(errorType: string, message: string, stack?: string, context?: Record<string, unknown>): void {
  fetch(`${API_BASE}/logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ errorType, message: message.slice(0, 2000), stack, context }),
  }).catch(() => {});
}


async function checkAndApplyUpdate() {
  if (__DEV__) return;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch { }
}

const CLERK_CONFIG_RETRY_DELAYS_MS = [1500, 3000, 5000, 8000, 10000] as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchClerkRuntimeConfig(): Promise<ClerkRuntimeConfig> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= CLERK_CONFIG_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}/auth/clerk-config`);
      if (!response.ok) {
        const error = new Error(`Authentication configuration returned HTTP ${response.status}`);
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (!retryable) throw error;
        lastError = error;
      } else {
        return parseClerkRuntimeConfig(await response.json());
      }
    } catch (error) {
      lastError = error;
    }

    const retryDelay = CLERK_CONFIG_RETRY_DELAYS_MS[attempt];
    if (retryDelay !== undefined) {
      await delay(retryDelay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to load authentication configuration");
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="hotel-payment-return" options={{ headerShown: false }} />
    </Stack>
  );
}

function AuthStartupFallback({
  loading,
  onRetry,
}: {
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <View style={styles.authStartup}>
      {loading ? (
        <ActivityIndicator size="large" color="#DDBA35" />
      ) : (
        <>
          <Text style={styles.authStartupTitle}>Unable to start sign in</Text>
          <Text style={styles.authStartupMessage}>
            Please check your connection and try again.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.authStartupButton,
              pressed && styles.authStartupButtonPressed,
            ]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry sign in setup"
            testID="clerk-config-retry"
          >
            <Text style={styles.authStartupButtonText}>Try Again</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Ionicons.font,
  });
  const [appReady, setAppReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [clerkConfig, setClerkConfig] = useState<ClerkRuntimeConfig | null>(() => {
    if (
      Platform.OS === "web" &&
      bundledClerkPublishableKey
    ) {
      return {
        publishableKey: bundledClerkPublishableKey,
        proxyUrl: bundledClerkProxyUrl,
      };
    }
    return null;
  });
  const [clerkConfigLoading, setClerkConfigLoading] = useState(!clerkConfig);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const handleError = useCallback((error: Error, componentStack: string) => {
    reportError("js_error", error.message, `${error.stack ?? ""}\n\nComponent Stack:\n${componentStack}`, { type: "react_error_boundary" });
  }, []);

  const loadClerkConfig = useCallback(async () => {
    setClerkConfigLoading(true);
    try {
      if (
        Platform.OS === "web" &&
        bundledClerkPublishableKey
      ) {
        setClerkConfig({
          publishableKey: bundledClerkPublishableKey,
          proxyUrl: bundledClerkProxyUrl,
        });
        return;
      }

      setClerkConfig(await fetchClerkRuntimeConfig());
    } catch (error) {
      setClerkConfig(null);
      reportError(
        "clerk_config",
        error instanceof Error ? error.message : "Failed to load authentication configuration",
        undefined,
        { platform: Platform.OS },
      );
    } finally {
      setClerkConfigLoading(false);
    }
  }, []);

  const { isUpdatePending } = useUpdates();
  useEffect(() => {
    if (!__DEV__ && isUpdatePending) {
      Updates.reloadAsync().catch(() => {});
    }
  }, [isUpdatePending]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().finally(() => {
        setAppReady(true);
      });
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    checkAndApplyUpdate();
    loadClerkConfig();

    async function initNotifications() {
      // Android 8+ requires a notification channel to exist before any push
      // can appear. Without this, FCM delivers the message but the OS drops
      // it silently. Must be called before registering the token.
      if (Platform.OS === "android") {
        try {
          const N = require("expo-notifications");
          await N.setNotificationChannelAsync("default", {
            name: "الإشعارات",
            importance: N.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#D4AF37",
            sound: "default",
            enableVibrate: true,
          });
        } catch { /* non-fatal — channel creation failure should not block the app */ }
      }
      await requestNotificationPermissions();
      await scheduleRetentionNotifications();
      await registerPushToken();
    }
    initNotifications();

    const subscription = AppState.addEventListener(
      "change",
      async (nextState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          await scheduleRetentionNotifications();
          await registerPushToken();
          checkAndApplyUpdate();
        }
        appState.current = nextState;
      }
    );

    return () => subscription.remove();
  }, [loadClerkConfig]);

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      reportError("unhandled_rejection", String(event.reason ?? "Unhandled Promise Rejection"), undefined, { type: "unhandled_rejection" });
    };
    if (typeof globalThis !== "undefined" && "addEventListener" in globalThis) {
      (globalThis as any).addEventListener("unhandledrejection", handler);
      return () => (globalThis as any).removeEventListener("unhandledrejection", handler);
    }
  }, []);

  if (!appReady) {
    return (
      <Head>
        <title>{WEB_PAGE_TITLE}</title>
      </Head>
    );
  }

  if (!clerkConfig) {
    return (
      <SafeAreaProvider>
        <StatusBar hidden style="light" />
        <AuthStartupFallback
          loading={clerkConfigLoading}
          onRetry={loadClerkConfig}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <>
      <Head>
        <title>{WEB_PAGE_TITLE}</title>
      </Head>
      <ErrorBoundary onError={handleError}>
        <ClerkProvider
          publishableKey={clerkConfig.publishableKey}
          tokenCache={tokenCache}
          proxyUrl={clerkConfig.proxyUrl}
        >
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <CartProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <StatusBar hidden style="light" />
              <RootLayoutNav />
              {showSplash && (
                <AnimatedSplash onAnimationEnd={() => setShowSplash(false)} />
              )}
              <NotificationPermissionBanner />
              <NotificationRescueModal />
              <NetworkToast />
            </GestureHandlerRootView>
            </CartProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
        </ClerkProvider>
      </ErrorBoundary>
    </>
  );
}

const styles = StyleSheet.create({
  authStartup: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
    backgroundColor: "#07182F",
  },
  authStartupTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  authStartupMessage: {
    color: "#A7B2C4",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  authStartupButton: {
    minWidth: 200,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: "#DDBA35",
  },
  authStartupButtonPressed: {
    opacity: 0.9,
  },
  authStartupButtonText: {
    color: "#07182F",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
