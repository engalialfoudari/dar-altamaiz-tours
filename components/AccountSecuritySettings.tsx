import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { useClerk } from "@clerk/expo";

type Clerk = ReturnType<typeof useClerk>;
type Props = {
  user: Clerk["user"];
  session: Clerk["session"];
  language: string;
  onEmailChanged: (email: string) => Promise<void>;
};
type Action = "email" | "password";
type Stage = "edit" | "session-code" | "second-factor" | "new-email-code";
const copy = {
  en: {
    title: "Account security", email: "Change email", password: "Change password",
    addPassword: "Set a password", current: "Current password", next: "New password",
    confirm: "Confirm new password", newEmail: "New email address", code: "Verification code",
    send: "Continue", verify: "Verify & continue", cancel: "Cancel",
    sent: "Enter the code sent to your current account email.",
    newSent: "Enter the code sent to your new email address.",
    mfa: "Enter your two-factor verification code.",
    successEmail: "Your account email has been changed.", successPassword: "Your password has been changed.",
    mismatch: "The new passwords do not match.", required: "Complete all fields.",
    unavailable: "Account security is not ready. Please sign in again.",
    failed: "Could not save the change. Please try again.",
  },
  ar: {
    title: "أمان الحساب", email: "تغيير البريد الإلكتروني", password: "تغيير كلمة المرور",
    addPassword: "إضافة كلمة مرور", current: "كلمة المرور الحالية", next: "كلمة المرور الجديدة",
    confirm: "تأكيد كلمة المرور الجديدة", newEmail: "البريد الإلكتروني الجديد", code: "رمز التحقق",
    send: "متابعة", verify: "تحقق ومتابعة", cancel: "إلغاء",
    sent: "أدخل الرمز المرسل إلى بريد حسابك الحالي.", newSent: "أدخل الرمز المرسل إلى بريدك الجديد.",
    mfa: "أدخل رمز التحقق بخطوتين.",
    successEmail: "تم تغيير بريد حسابك.", successPassword: "تم تغيير كلمة المرور.",
    mismatch: "كلمتا المرور الجديدتان غير متطابقتين.", required: "أكمل جميع الحقول.",
    unavailable: "أمان الحساب غير جاهز. يرجى تسجيل الدخول مجدداً.", failed: "تعذّر حفظ التغيير. حاول مجدداً.",
  },
  tr: {
    title: "Hesap güvenliği", email: "E-postayı değiştir", password: "Şifreyi değiştir",
    addPassword: "Şifre oluştur", current: "Mevcut şifre", next: "Yeni şifre",
    confirm: "Yeni şifreyi onayla", newEmail: "Yeni e-posta adresi", code: "Doğrulama kodu",
    send: "Devam", verify: "Doğrula ve devam et", cancel: "İptal",
    sent: "Mevcut hesap e-postanıza gönderilen kodu girin.", newSent: "Yeni e-posta adresinize gönderilen kodu girin.",
    mfa: "İki adımlı doğrulama kodunuzu girin.",
    successEmail: "Hesap e-postanız değiştirildi.", successPassword: "Şifreniz değiştirildi.",
    mismatch: "Yeni şifreler eşleşmiyor.", required: "Tüm alanları doldurun.",
    unavailable: "Hesap güvenliği hazır değil. Lütfen yeniden giriş yapın.", failed: "Değişiklik kaydedilemedi. Tekrar deneyin.",
  },
};

export function AccountSecuritySettings({ user, session, language, onEmailChanged }: Props) {
  const t = copy[language === "ar" ? "ar" : language === "tr" ? "tr" : "en"];
  const identity = `${user?.id ?? ""}:${session?.id ?? ""}`;
  const current = useRef(identity);
  current.current = identity;
  const [action, setAction] = useState<Action | null>(null);
  const [stage, setStage] = useState<Stage>("edit");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef<symbol | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pendingEmail = useRef<Awaited<ReturnType<NonNullable<Clerk["user"]>["createEmailAddress"]>> | null>(null);
  const secondStrategy = useRef<"totp" | "backup_code">("totp");
  function reset() {
    setAction(null); setStage("edit"); setEmail(""); setPassword("");
    setNextPassword(""); setConfirmation(""); setCode(""); pendingEmail.current = null;
  }
  useEffect(() => {
    current.current = identity;
    lock.current = null;
    reset(); setBusy(false); setMessage(""); setError("");
    return () => { current.current = ""; };
  }, [identity]);

  async function run(operation: (valid: () => boolean) => Promise<void>) {
    if (lock.current) return;
    const started = identity;
    const valid = () => current.current === started;
    const operationKey = Symbol();
    lock.current = operationKey; setBusy(true); setError(""); setMessage("");
    try { await operation(valid); }
    catch (failure) {
      if (valid()) {
        const detail = failure as { errors?: Array<{ longMessage?: string; message?: string }>; message?: string };
        setError(detail.errors?.[0]?.longMessage || detail.errors?.[0]?.message || detail.message || t.failed);
      }
    } finally {
      if (lock.current === operationKey) lock.current = null;
      if (valid()) setBusy(false);
    }
  }

  async function save(valid: () => boolean) {
    if (!user || !valid()) return;
    if (action === "password") {
      await user.updatePassword({
        newPassword: nextPassword,
        ...(user.passwordEnabled ? { currentPassword: password } : {}),
        signOutOfOtherSessions: true,
      });
      if (valid()) { reset(); setMessage(t.successPassword); }
    } else {
      const address = await user.createEmailAddress({ email: email.trim() });
      if (!valid()) return;
      pendingEmail.current = address;
      await address.prepareVerification({ strategy: "email_code" });
      if (valid()) { setStage("new-email-code"); setCode(""); }
    }
  }

  async function verified(status: string, factors: Array<{ strategy: string }> | null, valid: () => boolean) {
    if (!valid()) return;
    if (status === "complete") { await save(valid); return; }
    if (status === "needs_second_factor") {
      if (factors?.some((factor) => factor.strategy === "totp")) secondStrategy.current = "totp";
      else if (factors?.some((factor) => factor.strategy === "backup_code")) secondStrategy.current = "backup_code";
      else throw new Error(t.unavailable);
      setStage("second-factor"); setCode(""); return;
    }
    throw new Error(t.unavailable);
  }

  function submit() {
    void run(async (valid) => {
      if (!user || !session) throw new Error(t.unavailable);
      if (stage === "new-email-code") {
        if (!code.trim() || !pendingEmail.current) throw new Error(t.required);
        const address = await pendingEmail.current.attemptVerification({ code: code.trim() });
        if (!valid()) return;
        if (address.verification.status !== "verified") throw new Error(t.failed);
        const previousId = user.primaryEmailAddressId;
        await user.update({ primaryEmailAddressId: address.id });
        if (!valid()) return;
        try { await onEmailChanged(address.emailAddress); }
        catch (failure) {
          // If local synchronization rejects a conflicting email, retain the
          // original sign-in email rather than reporting a partial success.
          if (valid() && previousId) await user.update({ primaryEmailAddressId: previousId });
          throw failure;
        }
        if (valid()) { reset(); setMessage(t.successEmail); }
        return;
      }
      if (stage === "session-code" || stage === "second-factor") {
        if (!code.trim()) throw new Error(t.required);
        const proof = stage === "second-factor"
          ? await session.attemptSecondFactorVerification({ strategy: secondStrategy.current, code: code.trim() })
          : await session.attemptFirstFactorVerification({ strategy: "email_code", code: code.trim() });
        await verified(proof.status, proof.supportedSecondFactors, valid);
        return;
      }
      if ((user.passwordEnabled && !password) || (action === "email" ? !email.trim() : !nextPassword || !confirmation)) {
        throw new Error(t.required);
      }
      if (action === "password" && nextPassword !== confirmation) throw new Error(t.mismatch);
      const verification = await session.startVerification({ level: "first_factor" });
      if (!valid()) return;
      if (verification.status === "complete") { await save(valid); return; }
      if (user.passwordEnabled) {
        const proof = await session.attemptFirstFactorVerification({ strategy: "password", password });
        await verified(proof.status, proof.supportedSecondFactors, valid);
      } else {
        const factor = verification.supportedFirstFactors?.find((item) => item.strategy === "email_code");
        if (!factor || factor.strategy !== "email_code") throw new Error(t.unavailable);
        await session.prepareFirstFactorVerification({ strategy: "email_code", emailAddressId: factor.emailAddressId });
        if (valid()) { setStage("session-code"); setCode(""); }
      }
    });
  }

  const direction = language === "ar" ? styles.rtl : undefined;
  const field = (label: string, value: string, setter: (value: string) => void, id: string, secure = false) =>
    <View style={styles.field}><Text style={[styles.label, direction]}>{label}</Text>
      <TextInput testID={id} accessibilityLabel={label} style={[styles.input, direction]}
        value={value} onChangeText={setter} secureTextEntry={secure} editable={!busy}
        autoCapitalize="none" autoCorrect={false} keyboardType={id === "account-new-email" ? "email-address" : "default"} /></View>;
  return <View style={styles.card} testID="account-security-settings">
    <Text style={[styles.title, direction]}>{t.title}</Text>
    {!action ? <>
      <Pressable testID="account-change-email" disabled={busy} style={styles.choice} onPress={() => { reset(); setAction("email"); setError(""); setMessage(""); }}>
        <Text style={[styles.choiceText, direction]}>{t.email}</Text>
      </Pressable>
      <Pressable testID="account-change-password" disabled={busy} style={styles.choice} onPress={() => { reset(); setAction("password"); setError(""); setMessage(""); }}>
        <Text style={[styles.choiceText, direction]}>{user?.passwordEnabled ? t.password : t.addPassword}</Text>
      </Pressable>
    </> : <>
      {stage === "edit" ? <>
        {action === "email" && field(t.newEmail, email, setEmail, "account-new-email")}
        {user?.passwordEnabled && field(t.current, password, setPassword, "account-current-password", true)}
        {action === "password" && <>
          {field(t.next, nextPassword, setNextPassword, "account-new-password", true)}
          {field(t.confirm, confirmation, setConfirmation, "account-confirm-password", true)}
        </>}
      </> : <>
        <Text style={[styles.note, direction]}>{stage === "new-email-code" ? t.newSent : stage === "second-factor" ? t.mfa : t.sent}</Text>
        {field(t.code, code, setCode, "account-security-code")}
      </>}
      <Pressable testID="account-security-submit" accessibilityRole="button" disabled={busy}
        style={[styles.button, busy && styles.disabled]} onPress={submit}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{stage === "edit" ? t.send : t.verify}</Text>}
      </Pressable>
      <Pressable testID="account-security-cancel" disabled={busy} style={styles.choice} onPress={() => { reset(); setError(""); }}>
        <Text style={styles.choiceText}>{t.cancel}</Text>
      </Pressable>
    </>}
    {!!error && <Text accessibilityRole="alert" style={[styles.error, direction]}>{error}</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={[styles.note, direction]}>{message}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { marginTop: 14, padding: 16, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E3E8F2" },
  title: { color: "#0A192F", fontSize: 14, fontWeight: "800", marginBottom: 8 },
  choice: { minHeight: 44, justifyContent: "center" },
  choiceText: { color: "#003580", fontSize: 13, fontWeight: "700" },
  field: { marginVertical: 7 }, label: { color: "#334155", fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#D7E5FA", borderRadius: 10, minHeight: 44, paddingHorizontal: 12, color: "#202A36" },
  button: { backgroundColor: "#003580", minHeight: 44, borderRadius: 10, justifyContent: "center", alignItems: "center", marginTop: 12 },
  buttonText: { color: "#FFFFFF", fontWeight: "800" }, disabled: { opacity: 0.6 },
  note: { color: "#64748B", fontSize: 12, lineHeight: 18, marginTop: 8 },
  error: { color: "#B42318", fontSize: 12, marginTop: 8 }, rtl: { textAlign: "right", writingDirection: "rtl" },
});