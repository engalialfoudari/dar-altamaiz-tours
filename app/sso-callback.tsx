import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useClerk, useSignIn, useSignUp } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { requestClerkToken } from "@/lib/clerkTokenCoordinator";
import { completeNativeGoogleSession } from "@/lib/nativeGoogleSession";
import { useAppLanguage } from "@/localization/provider";

export default function SsoCallbackRoute() {
  return Platform.OS === "web" ? <WebGoogleCallback /> : <NativeGoogleCallback />;
}

const API_BASE = (
  process.env["EXPO_PUBLIC_API_BASE"] ??
  "https://tours-dar-tamaiz--engalialfoudari.replit.app/api"
).replace(/\/$/, "");

export async function completeWebGoogleCallback({
  rotatingTokenNonce,
  signIn,
  signUp,
  setActive,
  getToken,
  exchange,
}: {
  rotatingTokenNonce: string;
  signIn: any;
  signUp: any;
  setActive: (params: { session: string }) => Promise<unknown>;
  getToken: () => Promise<string | null>;
  exchange: (token: string) => Promise<{ name: string }>;
}): Promise<{ name: string }> {
  await signIn.reload({ rotatingTokenNonce });
  if (signIn.firstFactorVerification.status === "transferable") {
    await signUp.create({ transfer: true });
  }
  const createdSessionId = signUp.createdSessionId ?? signIn.createdSessionId;
  if (!createdSessionId) throw new Error("Google sign-in did not create a session");

  await setActive({ session: createdSessionId });
  let token = await requestClerkToken({ sessionId: createdSessionId, getToken });
  if (!token) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    token = await requestClerkToken({ sessionId: createdSessionId, getToken });
  }
  if (!token) throw new Error("Google session token is unavailable");
  return exchange(token);
}

export async function completeExistingWebGoogleSession({
  sessionId,
  getToken,
  exchange,
}: {
  sessionId?: string | null;
  getToken: () => Promise<string | null>;
  exchange: (token: string) => Promise<{ name: string }>;
}): Promise<{ name: string }> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const token = await requestClerkToken({ sessionId, getToken });
    if (token) return exchange(token);
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error("Google did not return a valid sign-in response.");
}

export async function completeNativeGoogleCallback({
  rotatingTokenNonce,
  reloadSignIn,
  signUp,
  setActive,
  getToken,
  exchange,
}: {
  rotatingTokenNonce: string;
  reloadSignIn: (params: { rotatingTokenNonce: string }) => Promise<any>;
  signUp: any;
  setActive: (params: { session: string }) => Promise<unknown>;
  getToken: () => Promise<string | null>;
  exchange: (token: string) => Promise<{ name: string }>;
}): Promise<{ name: string }> {
  const createdSessionId = await completeNativeGoogleSession({
    rotatingTokenNonce, reloadSignIn, signUp, setActive,
  });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const token = await requestClerkToken({ sessionId: createdSessionId, getToken });
    if (token) return exchange(token);
    if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Google session token is unavailable.");
}

function NativeGoogleCallback() {
  const { locale } = useAppLanguage();
  const copy = locale === "ar" ? {
    working: "جارٍ تسجيل دخولك", completing: "جارٍ إكمال تسجيل الدخول باستخدام Google…",
    failed: "تعذر تسجيل الدخول باستخدام Google", back: "العودة إلى الحساب",
    welcome: "مرحباً، ", success: "تم تسجيل دخولك بنجاح.", continue: "متابعة",
  } : locale === "tr" ? {
    working: "Giriş yapılıyor", completing: "Google ile girişiniz tamamlanıyor…",
    failed: "Google ile giriş başarısız", back: "Hesaba dön",
    welcome: "Hoş geldiniz, ", success: "Başarıyla giriş yaptınız.", continue: "Devam",
  } : {
    working: "Signing you in", completing: "Completing your Google sign-in…",
    failed: "Google sign-in failed", back: "Return to Account",
    welcome: "Welcome, ", success: "You’re signed in successfully.", continue: "Continue",
  };
  const router = useRouter();
  const params = useLocalSearchParams<{ rotating_token_nonce?: string | string[] }>();
  const { client, setActive } = useClerk();
  const { signUp } = useSignUp();
  const { getToken } = useAuth();
  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const [error, setError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const nonceValue = params.rotating_token_nonce;
  const rotatingTokenNonce = Array.isArray(nonceValue) ? nonceValue[0] ?? "" : nonceValue ?? "";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!signUp || startedRef.current) return;
    if (!rotatingTokenNonce) {
      // Router params can arrive after the callback screen mounts. Do not
      // consume its one completion attempt before the proof is available.
      const timer = setTimeout(() => {
        startedRef.current = true;
        setError("Google did not return a valid sign-in response.");
      }, 3_000);
      return () => clearTimeout(timer);
    }
    startedRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    const deadline = setTimeout(() => {
      controller.abort();
      if (mountedRef.current) setError("Google sign-in could not be completed. Please try again.");
    }, 30_000);
    void completeNativeGoogleCallback({
      rotatingTokenNonce,
      reloadSignIn: (reloadParams) => client.signIn.reload(reloadParams),
      signUp,
      setActive: async ({ session }) => {
        await setActive({ session });
      },
      getToken,
      exchange: async (token) => {
        if (controller.signal.aborted) throw new Error("Google sign-in was interrupted.");
        const response = await fetch(`${API_BASE}/auth/clerk/exchange`, {
          method: "POST",
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false || !data.user?.name) {
          throw new Error(data.error || "DT Tours could not verify this Google account");
        }
        return { name: String(data.user.name) };
      },
    }).then(({ name }) => {
      if (mountedRef.current && !controller.signal.aborted) setCustomerName(name);
    }).catch((callbackError: unknown) => {
      if (!mountedRef.current || controller.signal.aborted) return;
      setError(
        callbackError instanceof Error
          ? callbackError.message
          : "Google sign-in could not be completed.",
      );
    }).finally(() => clearTimeout(deadline));
  }, [client.signIn, getToken, rotatingTokenNonce, router, setActive, signUp]);

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <View style={[styles.icon, error && styles.errorIcon]}>
          {error || customerName ? (
            <Ionicons name={error ? "alert-outline" : "checkmark-outline"} size={28} color={error ? "#B42318" : "#147A4B"} />
          ) : (
            <ActivityIndicator color="#147A4B" />
          )}
        </View>
        <Text style={styles.title}>{error ? copy.failed : customerName ? `${copy.welcome}${customerName}` : copy.working}</Text>
        <Text style={styles.message}>
          {error || (customerName ? copy.success : copy.completing)}
        </Text>
        {(!!error || !!customerName) && (
          <Pressable
            testID={error ? "native-sso-return" : "native-sso-continue"}
            style={styles.button}
            onPress={() => router.replace(customerName && !error
              ? { pathname: "/", params: { postAuth: "home" } }
              : "/")}
          >
            <Text style={styles.buttonText}>{error ? copy.back : copy.continue}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function WebGoogleCallback() {
  const router = useRouter();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { setActive } = useClerk();
  const { getToken, sessionId } = useAuth();
  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  const exchangeControllerRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<"working" | "success" | "error">("working");
  const [message, setMessage] = useState("Completing your Google sign-in…");
  const [customerName, setCustomerName] = useState("");
  const [language] = useState<"ar" | "en">(() => {
    if (typeof window === "undefined") return "en";
    try {
      return window.sessionStorage.getItem("dt-auth-language") === "ar" ? "ar" : "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      exchangeControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!signIn || !signUp || startedRef.current) return;
    startedRef.current = true;
    const controller = new AbortController();
    exchangeControllerRef.current = controller;
    const rotatingTokenNonce =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("rotating_token_nonce") ?? ""
        : "";
    const exchange = async (token: string) => {
        const response = await fetch(`${API_BASE}/auth/clerk/exchange`, {
          method: "POST",
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false || !data.user?.name) {
          throw new Error(data.error || "DT Tours could not verify this Google account");
        }
        return { name: String(data.user.name) };
      };
    const completion = rotatingTokenNonce
      ? completeWebGoogleCallback({
          rotatingTokenNonce,
          signIn,
          signUp,
          setActive: async ({ session }) => {
            await setActive({ session });
          },
          getToken,
          exchange,
        })
      : completeExistingWebGoogleSession({ sessionId, getToken, exchange });

    void completion.then(({ name }) => {
      if (!mountedRef.current) return;
      setCustomerName(name);
      setStatus("success");
      setMessage(
        language === "ar"
          ? "تم تسجيل دخولك بنجاح. تابع لاستكشاف الرحلات والفنادق والباقات السياحية."
          : "You’re signed in successfully. Continue to explore flights, hotels, and travel packages.",
      );
      try {
        window.sessionStorage.removeItem("dt-auth-welcome");
        window.sessionStorage.removeItem("dt-auth-language");
      } catch {}
    }).catch((error: unknown) => {
      if (!mountedRef.current) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Google sign-in could not be completed.");
    });
  }, [getToken, sessionId, setActive, signIn, signUp]);

  useEffect(() => {
    if (status !== "success") return;
    const timer = setTimeout(() => {
      router.replace({ pathname: "/", params: { postAuth: "home" } });
    }, 3_000);
    return () => clearTimeout(timer);
  }, [router, status]);

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <View style={[styles.icon, status === "error" && styles.errorIcon]}>
          {status === "working" ? (
            <ActivityIndicator color="#147A4B" />
          ) : (
            <Ionicons
              name={status === "success" ? "checkmark-outline" : "alert-outline"}
              size={28}
              color={status === "success" ? "#147A4B" : "#B42318"}
            />
          )}
        </View>
        <Text style={styles.title}>
          {status === "success"
            ? language === "ar"
              ? `مرحباً، ${customerName}`
              : `Welcome, ${customerName}`
            : status === "error"
              ? "Google sign-in failed"
              : "Signing you in"}
        </Text>
        <Text style={styles.message}>{message}</Text>
        {status !== "working" && (
          <Pressable
            testID="web-sso-continue"
            style={styles.button}
            onPress={() => router.replace(
              status === "success"
                ? { pathname: "/", params: { postAuth: "home" } }
                : "/",
            )}
          >
            <Text style={styles.buttonText}>
              {status === "success"
                ? language === "ar" ? "متابعة" : "Continue"
                : "Return to Account"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A1628",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 430,
    alignItems: "center",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  icon: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#ECFDF3",
  },
  errorIcon: {
    backgroundColor: "#FEF3F2",
  },
  title: {
    marginTop: 18,
    color: "#0A192F",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    marginTop: 10,
    color: "#64748B",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  button: {
    width: "100%",
    marginTop: 24,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#0A3156",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
