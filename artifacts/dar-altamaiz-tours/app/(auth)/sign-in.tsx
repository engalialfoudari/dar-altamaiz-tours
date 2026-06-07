import { useSignIn, useSSO } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";

WebBrowser.maybeCompleteAuthSession();

const { gold, navy, navyMid, navyLight, mutedForeground } = colors.light;

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignInPage() {
  useWarmUpBrowser();

  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [verifyCode, setVerifyCode] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const handleSignIn = async () => {
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) return;

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            return;
          }
          router.replace(url as any);
        },
      });
    }
  };

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code: verifyCode });
    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            return;
          }
          router.replace(url as any);
        },
      });
    }
  };

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId) {
        setActive!({
          session: createdSessionId,
          navigate: async ({ decorateUrl }) => {
            router.replace(decorateUrl("/") as any);
          },
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  if (signIn.status === "needs_client_trust") {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>تأكيد الهوية</Text>
        <Text style={styles.subtitle}>أدخل الرمز الذي أرسلناه إلى بريدك</Text>
        <TextInput
          style={styles.input}
          value={verifyCode}
          placeholder="رمز التحقق"
          placeholderTextColor={mutedForeground}
          onChangeText={setVerifyCode}
          keyboardType="numeric"
          textAlign="right"
        />
        {errors.fields.code && (
          <Text style={styles.errorText}>{errors.fields.code.message}</Text>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (fetchStatus === "fetching" || !verifyCode) && styles.btnDisabled,
            pressed && styles.btnPressed,
          ]}
          onPress={handleVerify}
          disabled={fetchStatus === "fetching" || !verifyCode}
        >
          {fetchStatus === "fetching" ? (
            <ActivityIndicator color={navy} />
          ) : (
            <Text style={styles.primaryBtnText}>تحقق</Text>
          )}
        </Pressable>
        <Pressable onPress={() => signIn.mfa.sendEmailCode()} style={styles.textBtn}>
          <Text style={styles.textBtnText}>إعادة إرسال الرمز</Text>
        </Pressable>
        <Pressable onPress={() => signIn.reset()} style={styles.textBtn}>
          <Text style={styles.textBtnText}>ابدأ من جديد</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={gold} />
        </Pressable>

        <View style={styles.headerSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="airplane" size={32} color={gold} />
          </View>
          <Text style={styles.title}>تسجيل الدخول</Text>
          <Text style={styles.subtitle}>مرحباً بعودتك إلى دار التمايز</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.googleBtn, pressed && styles.btnPressed]}
          onPress={handleGoogleSignIn}
        >
          <Ionicons name="logo-google" size={18} color="#FFFFFF" />
          <Text style={styles.googleBtnText}>المتابعة باستخدام Google</Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>أو</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.label}>البريد الإلكتروني</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          value={email}
          placeholder="example@email.com"
          placeholderTextColor={mutedForeground}
          onChangeText={setEmail}
          keyboardType="email-address"
          textAlign="right"
        />
        {errors.fields.identifier && (
          <Text style={styles.errorText}>{errors.fields.identifier.message}</Text>
        )}

        <Text style={styles.label}>كلمة المرور</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={password}
            placeholder="••••••••"
            placeholderTextColor={mutedForeground}
            secureTextEntry={!showPassword}
            onChangeText={setPassword}
            textAlign="right"
          />
          <Pressable
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={mutedForeground}
            />
          </Pressable>
        </View>
        {errors.fields.password && (
          <Text style={styles.errorText}>{errors.fields.password.message}</Text>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (!email || !password || fetchStatus === "fetching") && styles.btnDisabled,
            pressed && styles.btnPressed,
          ]}
          onPress={handleSignIn}
          disabled={!email || !password || fetchStatus === "fetching"}
        >
          {fetchStatus === "fetching" ? (
            <ActivityIndicator color={navy} />
          ) : (
            <Text style={styles.primaryBtnText}>تسجيل الدخول</Text>
          )}
        </Pressable>

        <View style={styles.linkRow}>
          <Text style={styles.linkText}>ليس لديك حساب؟ </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable>
              <Text style={styles.linkAction}>إنشاء حساب</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy,
    paddingHorizontal: 24,
  },
  backBtn: {
    marginBottom: 16,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(201,168,76,0.12)",
    borderWidth: 2,
    borderColor: gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    color: mutedForeground,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#4285F4",
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  googleBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: navyMid,
  },
  dividerText: {
    color: mutedForeground,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  label: {
    color: mutedForeground,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
    textAlign: "right",
  },
  input: {
    backgroundColor: navyMid,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  passwordContainer: {
    position: "relative",
    marginBottom: 16,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 48,
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 14,
  },
  primaryBtn: {
    backgroundColor: gold,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPressed: {
    opacity: 0.8,
  },
  primaryBtnText: {
    color: navy,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  textBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  textBtnText: {
    color: gold,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  linkText: {
    color: mutedForeground,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  linkAction: {
    color: gold,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  errorText: {
    color: colors.light.destructive,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: -12,
    marginBottom: 12,
    textAlign: "right",
  },
});
