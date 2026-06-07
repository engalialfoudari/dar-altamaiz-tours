import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";

const { gold, navy, navyMid, navyLight, mutedForeground } = colors.light;

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  labelAr: string;
  labelEn: string;
  url: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    icon: "person-outline",
    labelAr: "حسابي",
    labelEn: "My Account",
    url: "https://dt-tours.com/index.php/general/my_booking",
  },
  {
    icon: "ticket-outline",
    labelAr: "حجوزاتي",
    labelEn: "My Bookings",
    url: "https://dt-tours.com/index.php/general/my_booking",
  },
  {
    icon: "sunny-outline",
    labelAr: "العطلات",
    labelEn: "Holidays",
    url: "https://dt-tours.com/index.php/tours/search/",
  },
  {
    icon: "help-circle-outline",
    labelAr: "تواصل معنا",
    labelEn: "Contact Us",
    url: "https://dt-tours.com/general/contact_us/",
  },
];

interface ProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
  onLanguageChange: (lang: "EN" | "AR") => void;
  currentLang: "EN" | "AR";
}

export function ProfileDrawer({
  visible,
  onClose,
  onNavigate,
  onLanguageChange,
  currentLang,
}: ProfileDrawerProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const drawerWidth = Math.min(width * (isTablet ? 0.45 : 0.78), 380);

  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const translateX = useRef(new Animated.Value(drawerWidth)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    translateX.setValue(drawerWidth);
  }, [drawerWidth]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 160,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: drawerWidth,
          useNativeDriver: true,
          damping: 22,
          stiffness: 160,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  const handleNavigate = (url: string) => {
    onNavigate(url);
    onClose();
  };

  const handleLogin = () => {
    onClose();
    router.push("/(auth)/sign-in");
  };

  const handleLogout = async () => {
    onClose();
    await signOut();
  };

  if (!mounted && !visible) return null;

  const isAr = currentLang === "AR";

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.emailAddresses[0]?.emailAddress || (isAr ? "مستخدم" : "User")
    : isAr ? "ضيف" : "Guest";

  const avatarUrl = user?.imageUrl;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: visible ? "auto" : "none" }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.backdrop, StyleSheet.absoluteFill, { opacity: backdropOpacity }]} />
      </Pressable>

      <Animated.View
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            transform: [{ translateX }],
            paddingTop: insets.top + 16,
          },
        ]}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileSection}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={32} color={gold} />
              </View>
            )}
            <Text style={[styles.profileName, isTablet && { fontSize: 20 }]}>
              {displayName}
            </Text>
            {isSignedIn ? (
              <Text style={[styles.profileSub, isTablet && { fontSize: 14 }]}>
                {user?.emailAddresses[0]?.emailAddress}
              </Text>
            ) : (
              <Text style={[styles.profileSub, isTablet && { fontSize: 14 }]}>
                {isAr ? "سجّل الدخول للمزيد من المميزات" : "Sign in for more features"}
              </Text>
            )}
            {isSignedIn ? (
              <Pressable
                style={({ pressed }) => [styles.logoutBtn, pressed && styles.loginBtnPressed]}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={16} color={gold} />
                <Text style={[styles.logoutBtnText, isTablet && { fontSize: 15 }]}>
                  {isAr ? "تسجيل الخروج" : "Sign Out"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.loginBtn, pressed && styles.loginBtnPressed]}
                onPress={handleLogin}
              >
                <Ionicons name="log-in-outline" size={16} color={navy} />
                <Text style={[styles.loginBtnText, isTablet && { fontSize: 15 }]}>
                  {isAr ? "تسجيل الدخول" : "Sign In"}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.menuSection}>
            {MENU_ITEMS.map((item) => (
              <Pressable
                key={item.labelEn}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={() => handleNavigate(item.url)}
              >
                <Ionicons name={item.icon} size={isTablet ? 22 : 20} color={gold} />
                <Text style={[styles.menuLabel, isTablet && { fontSize: 16 }]}>
                  {isAr ? item.labelAr : item.labelEn}
                </Text>
                <Ionicons
                  name={isAr ? "chevron-back-outline" : "chevron-forward-outline"}
                  size={16}
                  color={mutedForeground}
                  style={styles.chevron}
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.langSection}>
            <Text style={styles.langSectionTitle}>
              {isAr ? "اللغة / Language" : "Language / اللغة"}
            </Text>
            <View style={styles.langRow}>
              <Pressable
                style={[
                  styles.langOption,
                  currentLang === "EN" && styles.langOptionActive,
                ]}
                onPress={() => onLanguageChange("EN")}
              >
                <Text style={[
                  styles.langOptionText,
                  currentLang === "EN" && styles.langOptionTextActive,
                ]}>
                  🇬🇧  English
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.langOption,
                  currentLang === "AR" && styles.langOptionActive,
                ]}
                onPress={() => onLanguageChange("AR")}
              >
                <Text style={[
                  styles.langOptionText,
                  currentLang === "AR" && styles.langOptionTextActive,
                ]}>
                  🇸🇦  العربية
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            onPress={onClose}
          >
            <Ionicons name="close-outline" size={18} color={mutedForeground} />
            <Text style={styles.closeBtnText}>
              {isAr ? "إغلاق" : "Close"}
            </Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  drawer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: navy,
    borderLeftWidth: 1,
    borderLeftColor: navyMid,
    shadowColor: "#000",
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 24,
  },
  profileSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 8,
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: gold,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(201,168,76,0.12)",
    borderWidth: 2,
    borderColor: gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  profileName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
    textAlign: "center",
  },
  profileSub: {
    color: mutedForeground,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  loginBtn: {
    backgroundColor: gold,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loginBtnPressed: {
    opacity: 0.8,
  },
  loginBtnText: {
    color: navy,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: gold,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoutBtnText: {
    color: gold,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  divider: {
    height: 1,
    backgroundColor: navyMid,
    marginHorizontal: 20,
    marginVertical: 6,
  },
  menuSection: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 12,
  },
  menuItemPressed: {
    backgroundColor: navyLight,
  },
  menuLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  chevron: {
    marginLeft: "auto",
  },
  langSection: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  langSectionTitle: {
    color: mutedForeground,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  langRow: {
    flexDirection: "row",
    gap: 8,
  },
  langOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#132040",
    alignItems: "center",
    backgroundColor: "#0A1628",
  },
  langOptionActive: {
    borderColor: gold,
    backgroundColor: "#132040",
  },
  langOptionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  langOptionTextActive: {
    color: gold,
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 20,
    marginTop: 4,
    paddingVertical: 14,
  },
  closeBtnText: {
    color: mutedForeground,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
