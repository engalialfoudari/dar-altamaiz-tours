import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Ellipse,
  Path,
} from "react-native-svg";

const GOLD = "#D4AF37";
const BLACK = "#000000";
const NAVY = "#0A1628";
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

const GREETINGS: Record<Language, string> = {
  ar: "هلا والله! 👋 أنا تميز، مستشارك السياحي الشخصي من دار التميز للسياحة.\n\nوين تبي تسافر؟ قولي وأساعدك تلقى أحسن الباقات والعروض! ✈️",
  en: "Welcome! 👋 I'm Tamaiz, your personal travel advisor from Dar AlTamaiz Tours.\n\nWhere would you like to travel? Tell me and I'll help you find the perfect package! ✈️",
};

export function KuwaitiManIcon({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Ghitra (white headscarf) - main body */}
      <Path
        d="M50 10 Q78 12 82 38 Q76 30 50 28 Q24 30 18 38 Q22 12 50 10Z"
        fill="#F8F8F8"
      />
      {/* Ghitra right drape */}
      <Path
        d="M82 38 Q88 52 80 68 Q72 78 66 70 Q72 56 70 44 Q76 40 82 38Z"
        fill="#F8F8F8"
      />
      {/* Ghitra left tuck */}
      <Path
        d="M18 38 Q16 46 20 50 Q26 40 30 40 Q24 38 18 38Z"
        fill="#EFEFEF"
      />
      {/* Iqal outer ring (black cord) */}
      <Ellipse
        cx="50"
        cy="34"
        rx="26"
        ry="8"
        fill="none"
        stroke="#111111"
        strokeWidth="5"
      />
      {/* Iqal inner ring */}
      <Ellipse
        cx="50"
        cy="30"
        rx="22"
        ry="6"
        fill="none"
        stroke="#111111"
        strokeWidth="4"
      />
      {/* Face */}
      <Ellipse cx="50" cy="64" rx="20" ry="22" fill="#E8B88A" />
      {/* Left ear */}
      <Ellipse cx="30" cy="62" rx="3.5" ry="5" fill="#E8B88A" />
      {/* Right ear */}
      <Ellipse cx="70" cy="62" rx="3.5" ry="5" fill="#E8B88A" />
      {/* Left eyebrow */}
      <Path
        d="M38 53 Q43 51 47 52"
        stroke="#5c3a1e"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* Right eyebrow */}
      <Path
        d="M53 52 Q57 51 62 53"
        stroke="#5c3a1e"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* Left eye */}
      <Ellipse cx="42" cy="59" rx="3.2" ry="3.5" fill="#2c1810" />
      <Circle cx="43.2" cy="57.8" r="1" fill="white" />
      {/* Right eye */}
      <Ellipse cx="58" cy="59" rx="3.2" ry="3.5" fill="#2c1810" />
      <Circle cx="59.2" cy="57.8" r="1" fill="white" />
      {/* Nose */}
      <Path
        d="M47 65 Q50 68.5 53 65"
        stroke="#c48a5a"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Mustache */}
      <Path
        d="M43 70 Q50 73.5 57 70"
        stroke="#4a2c1a"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Smile */}
      <Path
        d="M44 76 Q50 81 56 76"
        stroke="#c07850"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
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
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
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
  const [language, setLanguage] = useState<Language | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWhatsAppBanner, setShowWhatsAppBanner] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const userMsgCount = useRef(0);
  const isAr = language === "ar";

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
      setMessages([]);
      setInput("");
      setLoading(false);
      setShowWhatsAppBanner(false);
      userMsgCount.current = 0;
    }
  }, [visible]);

  const startChat = (lang: Language) => {
    setLanguage(lang);
    const greeting: Message = {
      id: "greeting",
      role: "assistant",
      content: GREETINGS[lang],
    };
    setMessages([greeting]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    userMsgCount.current += 1;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
    };
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
        body: JSON.stringify({ messages: historyForApi }),
      });

      const data = await res.json() as { ok: boolean; content?: string; error?: string };
      const raw = data.content ?? (isAr ? "عذراً، صار خطأ. حاول مرة ثانية!" : "Sorry, something went wrong. Please try again!");
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
      const errMsg: Message = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: isAr ? "في مشكلة بالاتصال. تأكد من الإنترنت وحاول مرة ثانية." : "Connection issue. Please check your internet and try again.",
      };
      setMessages((prev) => [...prev, errMsg]);
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
            { paddingBottom: insets.bottom, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarWrap}>
                <KuwaitiManIcon size={38} />
              </View>
              <View>
                <Text style={styles.headerName}>
                  {isAr ? "تميز · Tamaiz" : "Tamaiz · تميز"}
                </Text>
                <Text style={styles.headerSub}>
                  {isAr ? "دار التميز للسياحة" : "Dar AlTamaiz Tours"}
                </Text>
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

          {/* Language picker */}
          {language === null ? (
            <View style={styles.langPicker}>
              <View style={styles.langIconWrap}>
                <KuwaitiManIcon size={72} />
              </View>
              <Text style={styles.langTitle}>Choose your language</Text>
              <Text style={styles.langTitle}>اختر لغتك</Text>
              <Pressable
                style={({ pressed }) => [styles.langBtn, pressed && { opacity: 0.85 }]}
                onPress={() => startChat("ar")}
              >
                <Text style={styles.langBtnText}>عربي 🇰🇼</Text>
                <Text style={styles.langBtnSub}>اللهجة الكويتية</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.langBtn, styles.langBtnAlt, pressed && { opacity: 0.85 }]}
                onPress={() => startChat("en")}
              >
                <Text style={styles.langBtnText}>English 🇬🇧</Text>
                <Text style={[styles.langBtnSub, { color: "rgba(255,255,255,0.6)" }]}>English Language</Text>
              </Pressable>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={0}
            >
              {/* Messages */}
              <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
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
                      <View style={styles.botAvatar}>
                        <KuwaitiManIcon size={28} />
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
                            msg.role === "user" ? styles.bubbleTextUser : styles.bubbleTextBot,
                            isAr && { textAlign: "right", writingDirection: "rtl" },
                          ]}
                        >
                          {msg.content}
                        </Text>
                      </View>
                      {msg.showWhatsApp && (
                        <Pressable
                          style={({ pressed }) => [styles.inlineCta, pressed && { opacity: 0.8 }]}
                          onPress={openWhatsApp}
                        >
                          <Text style={styles.inlineCtaText}>
                            {isAr ? "💬 تواصل معنا على واتساب" : "💬 Chat with us on WhatsApp"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}

                {loading && (
                  <View style={[styles.msgRow, styles.msgRowBot]}>
                    <View style={styles.botAvatar}>
                      <KuwaitiManIcon size={28} />
                    </View>
                    <TypingDots />
                  </View>
                )}
              </ScrollView>

              {/* WhatsApp banner */}
              {showWhatsAppBanner && (
                <Pressable
                  style={({ pressed }) => [styles.waBanner, pressed && { opacity: 0.85 }]}
                  onPress={openWhatsApp}
                >
                  <Text style={styles.waBannerText}>
                    {isAr
                      ? "💬 تحدث مع فريق خدمة العملاء مباشرة على واتساب"
                      : "💬 Connect directly with our team on WhatsApp"}
                  </Text>
                </Pressable>
              )}

              {/* Input area */}
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.inputBox, isAr && { textAlign: "right" }]}
                  value={input}
                  onChangeText={setInput}
                  placeholder={isAr ? "اكتب رسالتك..." : "Type your message..."}
                  placeholderTextColor="#888"
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
                    <ActivityIndicator size="small" color={BLACK} />
                  ) : (
                    <Svg width={18} height={18} viewBox="0 0 24 24">
                      <Path
                        d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                        stroke={BLACK}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
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
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: NAVY,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "88%",
    overflow: "hidden",
    borderTopWidth: 1.5,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: "rgba(212,175,55,0.35)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BLACK,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,175,55,0.2)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#111",
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headerName: {
    color: GOLD,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    color: "#888",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },

  langPicker: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  langIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#111",
    borderWidth: 2.5,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  langTitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  langBtn: {
    width: "100%",
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  langBtnAlt: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  langBtnText: {
    color: BLACK,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  langBtnSub: {
    color: "rgba(0,0,0,0.65)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },

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
  msgRowUser: {
    justifyContent: "flex-end",
  },
  msgRowBot: {
    justifyContent: "flex-start",
  },
  botAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#111",
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  bubbleUser: {
    backgroundColor: GOLD,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: "#0F1E36",
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: "rgba(212,175,55,0.15)",
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: BLACK,
    fontFamily: "Inter_700Bold",
  },
  bubbleTextBot: {
    color: "#FFFFFF",
    fontFamily: "Inter_400Regular",
  },

  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F1E36",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 5,
    borderWidth: 0.5,
    borderColor: "rgba(212,175,55,0.15)",
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: GOLD,
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

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(212,175,55,0.12)",
    backgroundColor: BLACK,
  },
  inputBox: {
    flex: 1,
    backgroundColor: "#0F1E36",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.2)",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: "#333",
  },
});
