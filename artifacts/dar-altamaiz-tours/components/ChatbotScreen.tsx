import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

const GOLD = "#D4AF37";
const BLACK = "#000000";
const NAVY_BG = "#0A1628";
const NAVY = "#001F5B";
const WHATSAPP_URL = "https://wa.me/96590087797";
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  "https://d7b44d10-cfb5-4168-8f9f-8b2a418e4057-00-3rf50yqp3upmp.sisko.replit.dev/api";

const WHATSAPP_SIGNAL = "[WHATSAPP]";
const GOODBYE_SIGNAL = "[GOODBYE]";
const HOTEL_SIGNAL = "[HOTEL]";
const FLIGHT_SIGNAL_RE = /\[FLIGHT:([^\]]+)\]/;
const ESCALATE_AFTER_MESSAGES = 8;
const STORAGE_KEY = "dtours_chat_v1";
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const BOT_NAME = "D.T. Tours Ai";

function buildFlightRedirectUrl(token: string, apiBase: string): string {
  const parts = token.split("|");
  const [fromId, fromLabel, toId, toLabel, dep, ret, adults] = parts;
  const params = new URLSearchParams({
    from: fromLabel ?? "",
    from_id: fromId ?? "",
    to: toLabel ?? "",
    to_id: toId ?? "",
    dep: dep ?? "",
    ret: ret ?? "",
    adults: adults ?? "1",
  });
  return `${apiBase}/flight-redirect?${params.toString()}`;
}

type Language = "ar" | "en";
type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  showWhatsApp?: boolean;
  flightToken?: string;
  showHotel?: boolean;
}

interface SavedSession {
  messages: Message[];
  language: Language;
  userName: string;
  savedAt: number;
}

const ROBOT_IMAGE = require("../assets/images/tamaiz-robot.png");

function TamaizAvatar({ size = 36 }: { size?: number }) {
  return (
    <Image
      source={ROBOT_IMAGE}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="cover"
    />
  );
}

export function KuwaitiManIcon({ size = 36 }: { size?: number }) {
  return <TamaizAvatar size={size} />;
}

function buildGreeting(lang: Language, name: string): string {
  if (lang === "ar") {
    return `السلام عليكم ورحمة الله وبركاته، حياكم الله 👋\nمعاكم ${BOT_NAME} مُساعدكم الشخصي في دار التميز تورز.\nشلون أقدر اساعدكم اليوم يا ${name}؟`;
  }
  return `Assalamu Alaikum, welcome! 👋\nI'm ${BOT_NAME}, your personal travel assistant at Dar AlTamaiz Tours.\nHow can I help you today, ${name}?`;
}

function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, {
            toValue: -6,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.in(Easing.quad),
          }),
          Animated.delay(450 - i * 150),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.typingBubble}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { transform: [{ translateY: dot }] }]}
        />
      ))}
    </View>
  );
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ChatbotScreen({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [language, setLanguage] = useState<Language | null>(null);
  const [userName, setUserName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWhatsAppBanner, setShowWhatsAppBanner] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Email summary state
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailDeclined, setEmailDeclined] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const userMsgCount = useRef(0);
  const hasCheckedSession = useRef(false);

  const isAr = language === "ar";
  const headerSub = isAr ? "مُساعدك الشخصي للسياحة" : "Your Personal Travel Assistant";

  const sheetMaxHeight =
    kbHeight > 0
      ? screenHeight - kbHeight - insets.top - 8
      : screenHeight * 0.9;
  const sheetMarginBottom = Platform.OS === "android" ? kbHeight : 0;

  // ── Keyboard listeners (Android) ──
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setKbHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKbHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // ── Session load & reset on visibility ──
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      if (!hasCheckedSession.current) {
        hasCheckedSession.current = true;
        loadSavedSession();
      }
    } else {
      hasCheckedSession.current = false;
      slideAnim.setValue(600);
      setLanguage(null);
      setUserName("");
      setNameError(false);
      setMessages([]);
      setInput("");
      setLoading(false);
      setShowWhatsAppBanner(false);
      setKbHeight(0);
      setShowEmailPrompt(false);
      setEmailInput("");
      setEmailSent(false);
      setEmailError(null);
      setEmailDeclined(false);
      setSessionLoading(false);
      userMsgCount.current = 0;
    }
  }, [visible]);

  // ── Auto-save whenever messages or language changes ──
  useEffect(() => {
    if (language && userName.trim() && messages.length > 0) {
      const session: SavedSession = {
        messages,
        language,
        userName: userName.trim(),
        savedAt: Date.now(),
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session)).catch(() => {});
    }
  }, [messages, language, userName]);

  // ── Load saved session ──
  const loadSavedSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw) as SavedSession;
        if (Date.now() - session.savedAt < ONE_MONTH_MS) {
          setUserName(session.userName);
          setLanguage(session.language);
          setMessages(session.messages);
          userMsgCount.current = session.messages.filter((m) => m.role === "user").length;
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // Ignore storage errors silently
    } finally {
      setSessionLoading(false);
    }
  }, []);

  // ── Clear chat ──
  const clearChat = useCallback(() => {
    Alert.alert(
      isAr ? "مسح المحادثة" : "Clear Chat",
      isAr
        ? "هل تريد مسح كل المحادثة وتبدأ من جديد؟"
        : "Clear the entire chat and start over?",
      [
        { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isAr ? "مسح" : "Clear",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
            setLanguage(null);
            setUserName("");
            setNameError(false);
            setMessages([]);
            setInput("");
            setLoading(false);
            setShowWhatsAppBanner(false);
            setShowEmailPrompt(false);
            setEmailInput("");
            setEmailSent(false);
            setEmailError(null);
            setEmailDeclined(false);
            userMsgCount.current = 0;
          },
        },
      ]
    );
  }, [isAr]);

  // ── Start chat ──
  const startChat = (lang: Language) => {
    const name = userName.trim();
    if (!name) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setLanguage(lang);
    const greeting: Message = {
      id: "greeting",
      role: "assistant",
      content: buildGreeting(lang, name),
    };
    setMessages([greeting]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Send message ──
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    userMsgCount.current += 1;

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: text };
    const historyForApi: Array<{ role: Role; content: string }> = [
      ...messages
        .filter((m) => m.id !== "greeting")
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: historyForApi,
          userName: userName.trim(),
          language: language ?? "ar",
        }),
      });

      clearTimeout(timeoutId);

      const data = (await res.json()) as {
        ok: boolean;
        content?: string;
        error?: string;
      };
      const raw =
        data.content ??
        (isAr ? "عذراً، صار خطأ. حاول مرة ثانية!" : "Sorry, something went wrong. Please try again!");

      const hasEscalation = raw.includes(WHATSAPP_SIGNAL);
      const hasGoodbye = raw.includes(GOODBYE_SIGNAL);
      const hasHotel = raw.includes(HOTEL_SIGNAL);
      const flightMatch = FLIGHT_SIGNAL_RE.exec(raw);
      const flightToken = flightMatch ? flightMatch[1] : undefined;
      const clean = raw
        .replace(WHATSAPP_SIGNAL, "")
        .replace(GOODBYE_SIGNAL, "")
        .replace(HOTEL_SIGNAL, "")
        .replace(FLIGHT_SIGNAL_RE, "")
        .trimEnd();

      const botMsg: Message = {
        id: `b_${Date.now()}`,
        role: "assistant",
        content: clean,
        showWhatsApp: hasEscalation,
        flightToken,
        showHotel: hasHotel,
      };
      setMessages((prev) => [...prev, botMsg]);

      if (hasEscalation || userMsgCount.current >= ESCALATE_AFTER_MESSAGES) {
        setShowWhatsAppBanner(true);
      }

      if (hasGoodbye && !showEmailPrompt && !emailDeclined) {
        setShowEmailPrompt(true);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort =
        err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: isAbort
            ? isAr
              ? "الرد يأخذ وقت أطول من المعتاد. حاول مرة ثانية 🔄"
              : "Response is taking longer than usual. Please try again 🔄"
            : isAr
              ? "ما قدرت أتصل بالخادم. تأكد من الإنترنت وحاول مرة ثانية."
              : "Couldn't reach the server. Check your internet and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // ── Send email summary ──
  const sendEmailSummary = async () => {
    const email = emailInput.trim();
    if (!email) return;
    setEmailSending(true);
    setEmailError(null);
    try {
      const messagesToSend = messages
        .filter((m) => m.content?.trim())
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_BASE}/chat/email-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesToSend,
          userEmail: email,
          userName: userName.trim(),
          language: language ?? "ar",
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setEmailSent(true);
      } else {
        setEmailError(
          isAr ? "فشل إرسال الإيميل. حاول مرة ثانية." : "Failed to send. Please try again."
        );
      }
    } catch {
      setEmailError(
        isAr ? "فشل إرسال الإيميل. تأكد من الإنترنت." : "Send failed. Check your internet."
      );
    } finally {
      setEmailSending(false);
    }
  };

  const openWhatsApp = () => Linking.openURL(WHATSAPP_URL).catch(() => {});

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetMaxHeight,
              marginBottom: sheetMarginBottom,
              paddingBottom: insets.bottom,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarOuter}>
                <View style={styles.avatarInner}>
                  <TamaizAvatar size={34} />
                </View>
              </View>
              <View>
                <Text style={styles.headerName}>{BOT_NAME}</Text>
                <Text style={styles.headerSub}>{headerSub}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              {language !== null && (
                <Pressable
                  onPress={clearChat}
                  hitSlop={10}
                  style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.clearBtnText}>
                    {isAr ? "مسح" : "Clear"}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24">
                  <Path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="#aaa"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            </View>
          </View>

          {/* ── Loading session ── */}
          {sessionLoading ? (
            <View style={styles.sessionLoadingWrap}>
              <ActivityIndicator size="large" color={GOLD} />
            </View>
          ) : language === null ? (
            /* ── Language & Name picker ── */
            <ScrollView
              contentContainerStyle={styles.langPicker}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.avatarCluster}>
                <View style={styles.avatarHalo} />
                <View style={styles.avatarOuterLg}>
                  <View style={styles.avatarInnerLg}>
                    <TamaizAvatar size={76} />
                  </View>
                </View>
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarBadgeText}>AI</Text>
                </View>
              </View>
              <Text style={styles.avatarBrand}>تميز · TAMAIZ</Text>

              <Text style={styles.langTitle}>مرحباً بكم 👋</Text>
              <Text style={styles.langTitleSub}>Welcome to Dar AlTamaiz Tours</Text>

              <View style={styles.nameFieldWrap}>
                <Text style={styles.nameLabel}>( الاسم / Name )</Text>
                <TextInput
                  style={[styles.nameInput, nameError && styles.nameInputError]}
                  value={userName}
                  onChangeText={(t) => {
                    setUserName(t);
                    if (t.trim()) setNameError(false);
                  }}
                  placeholder="أدخل اسمك / Enter your name"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  returnKeyType="done"
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={40}
                />
                {nameError && (
                  <Text style={styles.nameError}>✱ الاسم مطلوب · Name is required</Text>
                )}
              </View>

              <Text style={styles.langPrompt}>اختر لغتك / Choose your language</Text>
              <View style={styles.langBtnRow}>
                <Pressable
                  style={({ pressed }) => [styles.langBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => startChat("ar")}
                >
                  <Text style={styles.langBtnText}>عربي 🇰🇼</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.langBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => startChat("en")}
                >
                  <Text style={styles.langBtnText}>English 🇬🇧</Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            /* ── Chat view ── */
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 0}
            >
              <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() =>
                  scrollRef.current?.scrollToEnd({ animated: true })
                }
              >
                {messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.msgRow,
                      msg.role === "user" ? styles.msgRowUser : styles.msgRowBot,
                    ]}
                  >
                    {msg.role === "assistant" && (
                      <View style={styles.botAvatarWrap}>
                        <TamaizAvatar size={26} />
                      </View>
                    )}
                    <View style={{ maxWidth: "78%" }}>
                      <View
                        style={[
                          styles.bubble,
                          msg.role === "user" ? styles.bubbleUser : styles.bubbleBot,
                        ]}
                      >
                        <Text
                          style={[
                            styles.bubbleText,
                            msg.role === "user"
                              ? styles.bubbleTextUser
                              : styles.bubbleTextBot,
                            isAr && { textAlign: "right", writingDirection: "rtl" },
                          ]}
                        >
                          {msg.content}
                        </Text>
                      </View>
                      {msg.flightToken && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.flightCta,
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() =>
                            Linking.openURL(
                              buildFlightRedirectUrl(msg.flightToken!, API_BASE)
                            ).catch(() => {})
                          }
                        >
                          <Text style={styles.flightCtaText}>
                            {isAr ? "✈️ ابحث عن رحلتك الآن" : "✈️ Search My Flight Now"}
                          </Text>
                        </Pressable>
                      )}
                      {msg.showHotel && !msg.flightToken && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.flightCta,
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() =>
                            Linking.openURL("https://dt-tours.com").catch(() => {})
                          }
                        >
                          <Text style={styles.flightCtaText}>
                            {isAr ? "🏨 شوف الفنادق المتاحة" : "🏨 View Available Hotels"}
                          </Text>
                        </Pressable>
                      )}
                      {msg.showWhatsApp && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.inlineCta,
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={openWhatsApp}
                        >
                          <Text style={styles.inlineCtaText}>
                            {isAr
                              ? "💬 تواصل معنا على واتساب"
                              : "💬 Chat with us on WhatsApp"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}

                {loading && (
                  <View style={[styles.msgRow, styles.msgRowBot]}>
                    <View style={styles.botAvatarWrap}>
                      <TamaizAvatar size={26} />
                    </View>
                    <TypingDots />
                  </View>
                )}

                {/* ── Email summary prompt ── */}
                {showEmailPrompt && !emailDeclined && (
                  <View style={styles.emailPromptCard}>
                    {emailSent ? (
                      <Text style={styles.emailSentText}>
                        {isAr
                          ? "✅ تم إرسال الملخص على إيميلك بنجاح!"
                          : "✅ Summary sent to your email!"}
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.emailPromptTitle}>
                          {isAr
                            ? "📧 هل تريد ملخص المحادثة؟"
                            : "📧 Want a chat summary?"}
                        </Text>
                        <Text style={styles.emailPromptSub}>
                          {isAr
                            ? "نرسله على إيميلك مباشرة من info@dt-tour.com"
                            : "We'll send it to your email from info@dt-tour.com"}
                        </Text>

                        <TextInput
                          style={styles.emailInput}
                          value={emailInput}
                          onChangeText={setEmailInput}
                          placeholder={isAr ? "بريدك الإلكتروني" : "Your email address"}
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          maxLength={100}
                        />

                        {emailError && (
                          <Text style={styles.emailErrorText}>{emailError}</Text>
                        )}

                        <View style={styles.emailBtnRow}>
                          <Pressable
                            style={({ pressed }) => [
                              styles.emailSendBtn,
                              (!emailInput.trim() || emailSending) && styles.emailSendBtnDisabled,
                              pressed && emailInput.trim() && { opacity: 0.8 },
                            ]}
                            onPress={sendEmailSummary}
                            disabled={!emailInput.trim() || emailSending}
                          >
                            {emailSending ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.emailSendBtnText}>
                                {isAr ? "إرسال" : "Send"}
                              </Text>
                            )}
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [
                              styles.emailDeclineBtn,
                              pressed && { opacity: 0.7 },
                            ]}
                            onPress={() => setEmailDeclined(true)}
                          >
                            <Text style={styles.emailDeclineBtnText}>
                              {isAr ? "لا شكراً" : "No thanks"}
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </ScrollView>

              {showWhatsAppBanner && (
                <Pressable
                  style={({ pressed }) => [
                    styles.waBanner,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={openWhatsApp}
                >
                  <Text style={styles.waBannerText}>
                    {isAr
                      ? "💬 تحدث مع فريق خدمة العملاء مباشرة على واتساب"
                      : "💬 Connect directly with our team on WhatsApp"}
                  </Text>
                </Pressable>
              )}

              {/* ── Input bar ── */}
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.inputBox, isAr && { textAlign: "right" }]}
                  value={input}
                  onChangeText={setInput}
                  placeholder={isAr ? "اكتب رسالتك..." : "Type your message..."}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  multiline
                  maxLength={500}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  blurOnSubmit={false}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.sendBtn,
                    (!input.trim() || loading) && styles.sendBtnDisabled,
                    pressed && input.trim() && { opacity: 0.8 },
                  ]}
                  onPress={handleSend}
                  disabled={!input.trim() || loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={{ alignItems: "center" }}>
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 13,
                          fontFamily: "Inter_700Bold",
                          lineHeight: 16,
                        }}
                      >
                        إرسال
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.65)",
                          fontSize: 9.5,
                          fontFamily: "Inter_400Regular",
                          lineHeight: 13,
                          letterSpacing: 0.3,
                        }}
                      >
                        Send
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: NAVY_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
    borderTopWidth: 1.5,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: "rgba(212,175,55,0.3)",
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#060E1E",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,31,91,0.8)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  avatarOuter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: GOLD,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A1628",
  },
  avatarInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
    backgroundColor: "#111",
  },
  headerName: {
    color: GOLD,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  headerSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  clearBtnText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  closeBtn: {
    padding: 6,
  },

  /* ── Session loading ── */
  sessionLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Welcome / Lang picker ── */
  langPicker: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 14,
    flexGrow: 1,
  },
  avatarCluster: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  avatarHalo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.18)",
    backgroundColor: "transparent",
  },
  avatarOuterLg: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2.5,
    borderColor: GOLD,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A1628",
  },
  avatarInnerLg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    backgroundColor: "#111",
  },
  avatarBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: NAVY,
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadgeText: {
    color: GOLD,
    fontSize: 8,
    fontFamily: "Inter_700Bold",
  },
  avatarBrand: {
    color: GOLD,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: -6,
  },
  langTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  langTitleSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  nameFieldWrap: {
    width: "100%",
    gap: 6,
  },
  nameLabel: {
    color: GOLD,
    fontSize: 12.5,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  nameInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1.5,
    borderColor: "rgba(0,31,91,0.9)",
    textAlign: "center",
  },
  nameInputError: {
    borderColor: "#FF6B6B",
    backgroundColor: "rgba(255,107,107,0.06)",
  },
  nameError: {
    color: "#FF8080",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  langPrompt: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  langBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  langBtn: {
    flex: 1,
    backgroundColor: NAVY,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  langBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },

  /* ── Chat messages ── */
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 8,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowBot: { justifyContent: "flex-start" },
  botAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: GOLD,
    overflow: "hidden",
    flexShrink: 0,
    backgroundColor: "#111",
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  bubbleUser: {
    backgroundColor: NAVY,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: "#0D1C35",
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: "rgba(0,31,91,0.6)",
  },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: "#FFFFFF", fontFamily: "Inter_700Bold" },
  bubbleTextBot: { color: "#FFFFFF", fontFamily: "Inter_400Regular" },

  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1C35",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 5,
    borderWidth: 0.5,
    borderColor: "rgba(0,31,91,0.5)",
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: NAVY,
  },

  flightCta: {
    marginTop: 8,
    backgroundColor: "#0A1628",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: "#D4AF37",
    flexDirection: "row",
    alignItems: "center",
  },
  flightCtaText: {
    color: "#D4AF37",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  inlineCta: {
    marginTop: 8,
    backgroundColor: "#25D366",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  inlineCtaText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  waBanner: {
    backgroundColor: "#1A3A2A",
    borderTopWidth: 1,
    borderColor: "#25D366",
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  waBannerText: {
    color: "#25D366",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },

  /* ── Email summary card ── */
  emailPromptCard: {
    backgroundColor: "#0D1C35",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)",
    padding: 14,
    gap: 10,
    marginTop: 6,
  },
  emailPromptTitle: {
    color: GOLD,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emailPromptSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  emailInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: "rgba(0,31,91,0.8)",
    textAlign: "center",
  },
  emailErrorText: {
    color: "#FF8080",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  emailSentText: {
    color: "#4CAF50",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    paddingVertical: 4,
  },
  emailBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  emailSendBtn: {
    flex: 1,
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GOLD,
  },
  emailSendBtnDisabled: {
    opacity: 0.4,
  },
  emailSendBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  emailDeclineBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emailDeclineBtnText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  /* ── Input bar ── */
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,31,91,0.7)",
    backgroundColor: "#060E1E",
  },
  inputBox: {
    flex: 1,
    backgroundColor: "#0D1C35",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "rgba(0,31,91,0.8)",
  },
  sendBtn: {
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
    flexShrink: 0,
    minWidth: 52,
  },
  sendBtnDisabled: {
    backgroundColor: "#0e1e3a",
    opacity: 0.55,
  },
});
