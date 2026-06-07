import { useAuth, useSignUp } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React from "react";
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

const { gold, navy, navyMid, mutedForeground } = colors.light;

export default function SignUpPage() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const handleSignUp = async () => {
    const { error } = await signUp.password({
      emailAddress: email,
      password,
      firstName,
    });
    if (error) return;
    if (!error) await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/");
          if (url.startsWith("http")) return;
          router.replace(url as any);
        },
      });
    }
  };

  if (signUp.status === "complete" || isSignedIn) {
    return null;
  }

  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0
  ) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <View style={styles.headerSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="mail-outline" size={32} color={gold} />
          </View>
          <Text style={styles.title}>تأكيد البريد</Text>
          <Text style={styles.subtitle}>
            أرسلنا رمز التحقق إلى {email}
          </Text>
        </View>

        <Text style={styles.label}>رمز التحقق</Text>
        <TextInput
          style={styles.input}
          value={code}
          placeholder="123456"
          placeholderTextColor={mutedForeground}
          onChangeText={setCode}
          keyboardType="numeric"
          textAlign="center"
        />
        {errors.fields.code && (
          <Text style={styles.errorText}>{errors.fields.code.message}</Text>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (fetchStatus === "fetching" || !code) && styles.btnDisabled,
            pressed && styles.btnPressed,
          ]}
          onPress={handleVerify}
          disabled={fetchStatus === "fetching" || !code}
        >
          {fetchStatus === "fetching" ? (
            <ActivityIndicator color={navy} />
          ) : (
            <Text style={styles.primaryBtnText}>تأكيد</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => signUp.verifications.sendEmailCode()}
          style={styles.textBtn}
        >
          <Text style={styles.textBtnText}>إعادة إرسال الرمز</Text>
        </Pressable>

        <View nativeID="clerk-captcha" />
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
            <Ionicons name="person-add-outline" size={32} color={gold} />
          </View>
          <Text style={styles.title}>إنشاء حساب</Text>
          <Text style={styles.subtitle}>انضم إلى دار التمايز</Text>
        </View>

        <Text style={styles.label}>الاسم الأول</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          placeholder="محمد"
          placeholderTextColor={mutedForeground}
          onChangeText={setFirstName}
          textAlign="right"
        />

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
        {errors.fields.emailAddress && (
          <Text style={styles.errorText}>{errors.fields.emailAddress.message}</Text>
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
          onPress={handleSignUp}
          disabled={!email || !password || fetchStatus === "fetching"}
        >
          {fetchStatus === "fetching" ? (
            <ActivityIndicator color={navy} />
          ) : (
            <Text style={styles.primaryBtnText}>إنشاء حساب</Text>
          )}
        </Pressable>

        <View style={styles.linkRow}>
          <Text style={styles.linkText}>لديك حساب بالفعل؟ </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Text style={styles.linkAction}>تسجيل الدخول</Text>
            </Pressable>
          </Link>
        </View>

        <View nativeID="clerk-captcha" />
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
    marginBottom: 28,
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
