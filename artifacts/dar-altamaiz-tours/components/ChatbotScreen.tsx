import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
const ESCALATE_AFTER_MESSAGES = 8;

type Language = "ar" | "en";
type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  showWhatsApp?: boolean;
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
    return `السلام عليكم ورحمة الله وبركاته، حياكم الله، معاكم أحمد مُساعدكم الشخصي في تطبيق دار التميز تورز 👋\nشلون أقدر اساعدكم اليوم يا ${name}؟`;
  }
  return `Assalamu Alaikum, welcome! I'm Ahmad, your personal travel assistant at Dar AlTamaiz Tours 👋\nHow can I help you today, ${name}?`;
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
  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const userMsgCount = useRef(0);
  const isAr = language === "ar";

  const headerTitle = isAr ? "أحمد - دار التميز تورز" : "Ahmed - D.T. Tours";
  const headerSub = isAr ? "مُساعدك الشخصي للسياحة" : "Your Personal Travel Assistant";

  const sheetMaxHeight =
    kbHeight > 0
      ? screenHeight - kbHeight - insets.top - 8
      : screenHeight * 0.9;
  const sheetMarginBottom = Platform.OS === "android" ? kbHeight : 0;

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

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(600);
      setLanguage(null);
      setUserName("");
      setNameError(false);
      setMessages([]);
      setInput("");
      setLoading(false);
      setShowWhatsAppBanner(false);
      setKbHeight(0);
      userMsgCount.current = 0;
    }
  }, [visible]);

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

    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyForApi,
          userName: userName.trim(),
          language: language ?? "ar",
        }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        content?: string;
        error?: string;
      };
      const raw =
        data.content ??
        (isAr ? "عذراً، صار خطأ. حاول مرة ثانية!" : "Sorry, something went wrong. Please try again!");
      const hasEscalation = raw.includes(WHATSAPP_SIGNAL);
      const clean = raw.replace(WHATSAPP_SIGNAL, "").trimEnd();

      const botMsg: Message = {
        id: `b_${Date.now()}`,
        role: "assistant",
        content: clean,
        showWhatsApp: hasEscalation,
      };
      setMessages((prev) => [...prev, botMsg]);

      if (hasEscalation || userMsgCount.current >= ESCALATE_AFTER_MESSAGES) {
        setShowWhatsAppBanner(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: isAr
            ? "في مشكلة بالاتصال. تأكد من الإنترنت وحاول مرة ثانية."
            : "Connection issue. Please check your internet and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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
              maxHeight: sheetMaxHeight,
              marginBottom: sheetMarginBottom,
              paddingBottom: insets.bottom,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {/* Bespoke double-ring avatar */}
              <View style={styles.avatarOuter}>
                <View style={styles.avatarInner}>
                  <TamaizAvatar size={34} />
                </View>
              </View>
              <View>
                <Text style={styles.headerName}>{headerTitle}</Text>
                <Text style={styles.headerSub}>{headerSub}</Text>
              </View>
            </View>
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

          {/* ── Language & Name picker ── */}
          {language === null ? (
            <ScrollView
              contentContainerStyle={styles.langPicker}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Branded avatar cluster */}
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

              {/* Name input */}
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
                  <Text style={styles.nameError}>
                    ✱ الاسم مطلوب · Name is required
                  </Text>
                )}
              </View>

              {/* Language buttons — side by side */}
              <Text style={styles.langPrompt}>اختر لغتك / Choose your language</Text>
              <View style={styles.langBtnRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.langBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => startChat("ar")}
                >
                  <Text style={styles.langBtnText}>عربي 🇰🇼</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.langBtn,
                    pressed && { opacity: 0.8 },
                  ]}
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
                          msg.role === "user"
                            ? styles.bubbleUser
                            : styles.bubbleBot,
                        ]}
                      >
                        <Text
                          style={[
                            styles.bubbleText,
                            msg.role === "user"
                              ? styles.bubbleTextUser
                              : styles.bubbleTextBot,
                            isAr && {
                              textAlign: "right",
                              writingDirection: "rtl",
                            },
                          ]}
                        >
                          {msg.content}
                        </Text>
                      </View>
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

              {/* Input bar — no gold anywhere */}
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
  /* Double-ring avatar in header */
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
  closeBtn: {
    padding: 6,
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

  /* Branded avatar cluster */
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
    marginTop: -8,
  },

  langTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  langTitleSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: -6,
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
  /* Side-by-side language buttons */
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

  /* ── Input bar — zero gold ── */
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
