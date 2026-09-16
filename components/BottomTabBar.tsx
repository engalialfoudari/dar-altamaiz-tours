import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { t, LangCode } from "@/constants/i18n";

const { navy, navyMid, mutedForeground } = colors.light;
const ACTIVE_BLUE = "#4A8FE7";

export type TabKey = "home" | "trips" | "bookings" | "settings" | "requests" | "profile";

export interface Tab {
  key: TabKey;
  labelEn: string;
  url: string;
  isNative?: boolean;
}

export const TABS: Tab[] = [
  {
    key: "home",
    labelEn: "Home",
    url: "https://dt-tours.com/",
    isNative: true,
  },
  {
    key: "trips",
    labelEn: "Packages",
    url: "https://dt-tours.com/index.php/tours/search/",
  },
  {
    key: "bookings",
    labelEn: "Bookings",
    url: "https://dt-tours.com/index.php/general/my_booking",
  },
  {
    key: "settings",
    labelEn: "Contact",
    url: "https://dt-tours.com/general/contact_us/",
  },
  {
    key: "profile",
    labelEn: "My Account",
    url: "",
    isNative: true,
  },
];

function IconHome({ size, color, active }: { size: number; color: string; active: boolean }) {
  const sw = active ? 2.2 : 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? `${color}22` : "none"}
      />
      <Path
        d="M9 22V12h6v10"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconPalmTree({ size, color, active }: { size: number; color: string; active: boolean }) {
  const sw = active ? 2.2 : 1.6;
  const fill = active ? `${color}22` : "none";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22 Q11.5 17 11 13 Q10.5 10.5 10 9"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Path d="M9 22h6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Path
        d="M10 9 Q7 8 4 10"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        fill={fill}
      />
      <Path
        d="M10 9 Q8 5 5 3"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        fill={fill}
      />
      <Path
        d="M10 9 Q11 5 12 2"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        fill={fill}
      />
      <Path
        d="M10 9 Q13 5 16 4"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        fill={fill}
      />
      <Path
        d="M10 9 Q14 9 17 11"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        fill={fill}
      />
      <Circle cx="10" cy="10" r={active ? 1.2 : 0.9} fill={color} />
    </Svg>
  );
}

function IconBriefcase({ size, color, active }: { size: number; color: string; active: boolean }) {
  const sw = active ? 2.2 : 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="2"
        y="7"
        width="20"
        height="14"
        rx="2"
        ry="2"
        stroke={color}
        strokeWidth={sw}
        fill={active ? `${color}22` : "none"}
      />
      <Path
        d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconPhone({ size, color, active }: { size: number; color: string; active: boolean }) {
  const sw = active ? 2.2 : 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? `${color}22` : "none"}
      />
    </Svg>
  );
}

function IconUsers({ size, color, active }: { size: number; color: string; active: boolean }) {
  const sw = active ? 2.2 : 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="9"
        cy="7"
        r="4"
        stroke={color}
        strokeWidth={sw}
        fill={active ? `${color}22` : "none"}
      />
      <Path
        d="M23 21v-2a4 4 0 00-3-3.87"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 3.13a4 4 0 010 7.75"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconProfile({ size, color, active }: { size: number; color: string; active: boolean }) {
  const sw = active ? 2.2 : 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={sw} fill={active ? `${color}22` : "none"} />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}

function TabIcon({ tabKey, size, color, active }: { tabKey: TabKey; size: number; color: string; active: boolean }) {
  switch (tabKey) {
    case "home":      return <IconHome size={size} color={color} active={active} />;
    case "trips":     return <IconPalmTree size={size} color={color} active={active} />;
    case "bookings":  return <IconBriefcase size={size} color={color} active={active} />;
    case "settings":  return <IconPhone size={size} color={color} active={active} />;
    case "requests":  return <IconUsers size={size} color={color} active={active} />;
    case "profile":   return <IconProfile size={size} color={color} active={active} />;
  }
}

interface BottomTabBarProps {
  activeTab: TabKey;
  onTabPress: (tab: Tab) => void;
  activeLang?: LangCode;
}

export function shouldHideBottomTabBarForWeb({
  layoutHeight,
  visibleHeight,
  fullViewportHeight,
  activeTagName,
  activeContentEditable,
  iframeReportedOpen,
}: {
  layoutHeight: number;
  visibleHeight: number;
  fullViewportHeight: number;
  activeTagName?: string;
  activeContentEditable?: boolean;
  iframeReportedOpen?: boolean;
}) {
  if (iframeReportedOpen) return true;
  const textFieldFocused = activeTagName === "INPUT"
    || activeTagName === "TEXTAREA"
    || activeContentEditable === true;
  const iframeFocused = activeTagName === "IFRAME";
  const keyboardHeight = Math.max(
    layoutHeight - visibleHeight,
    fullViewportHeight - visibleHeight,
  );
  return keyboardHeight > 120 && (textFieldFocused || iframeFocused);
}

export function BottomTabBar({ activeTab, onTabPress, activeLang = "en" }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const tr = t(activeLang).tabs;
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const iframeKeyboardOpen = useRef(false);
  const fullViewportHeight = useRef(0);

  useEffect(() => {
    if (Platform.OS !== "web") {
      const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
        setKeyboardOpen(true);
      });
      const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
        setKeyboardOpen(false);
      });
      return () => {
        showSubscription.remove();
        hideSubscription.remove();
      };
    }
    if (typeof window === "undefined") return;

    const visualViewport = window.visualViewport;
    fullViewportHeight.current = Math.max(window.innerHeight, visualViewport?.height ?? 0);
    const updateKeyboardState = () => {
      // Safari may resize either the layout viewport or only visualViewport
      // when its on-screen keyboard opens. A large viewport delta is
      // unambiguous and avoids reacting to the small URL-bar movement.
      const layoutHeight = window.innerHeight;
      const visibleHeight = visualViewport?.height ?? layoutHeight;
      const activeElement = document.activeElement as HTMLElement | null;
      // Safari exposes a focused field inside a cross-origin iframe as the
      // iframe itself. Treat that as a valid focus signal, otherwise the
      // viewport shrink is ignored and the tab bar stays over the keyboard.
      const keyboardHeight = Math.max(
        layoutHeight - visibleHeight,
        fullViewportHeight.current - visibleHeight,
      );

      if (keyboardHeight <= 120) {
        fullViewportHeight.current = Math.max(
          fullViewportHeight.current,
          layoutHeight,
          visibleHeight,
        );
      }
      setKeyboardOpen(shouldHideBottomTabBarForWeb({
        layoutHeight,
        visibleHeight,
        fullViewportHeight: fullViewportHeight.current,
        activeTagName: activeElement?.tagName,
        activeContentEditable: activeElement?.isContentEditable,
        iframeReportedOpen: iframeKeyboardOpen.current,
      }));
    };

    const handleKeyboardMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== "dt-tours-keyboard") return;
      iframeKeyboardOpen.current = data.open === true;
      // A message can arrive before visualViewport emits its resize event.
      // Re-evaluate immediately so the bar never flashes over the keyboard.
      updateKeyboardState();
    };

    updateKeyboardState();
    window.addEventListener("resize", updateKeyboardState);
    window.addEventListener("blur", updateKeyboardState);
    window.addEventListener("message", handleKeyboardMessage);
    document.addEventListener("focusin", updateKeyboardState);
    document.addEventListener("focusout", updateKeyboardState);
    visualViewport?.addEventListener("resize", updateKeyboardState);
    return () => {
      window.removeEventListener("resize", updateKeyboardState);
      window.removeEventListener("blur", updateKeyboardState);
      window.removeEventListener("message", handleKeyboardMessage);
      document.removeEventListener("focusin", updateKeyboardState);
      document.removeEventListener("focusout", updateKeyboardState);
      visualViewport?.removeEventListener("resize", updateKeyboardState);
    };
  }, []);

  if (keyboardOpen) return null;

  const iconSize = isTablet ? 24 : 20;
  const labelSize = isTablet ? 10 : 8;
  const tabHeight = isTablet ? 68 : 56;

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
          height: tabHeight + (insets.bottom > 0 ? insets.bottom : 6),
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const iconColor = isActive ? ACTIVE_BLUE : mutedForeground;
        const label = tr[tab.key];
        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onTabPress(tab);
            }}
            hitSlop={4}
            testID={`tab-${tab.key}`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}
          >
            {isActive && (
              <View style={[styles.activeIndicator, isTablet && { width: 32, height: 3 }]} />
            )}
            <TabIcon tabKey={tab.key} size={iconSize} color={iconColor} active={isActive} />
            <Text
              style={[
                styles.label,
                { fontSize: labelSize },
                isActive && styles.labelActive,
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: navy,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: navyMid,
    paddingTop: 6,
    // The native Profile screen is an absolute overlay, but the app tabs
    // must remain reachable so customers can leave Account with one tap.
    zIndex: 30,
    elevation: 30,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabPressed: {
    opacity: 0.65,
  },
  activeIndicator: {
    position: "absolute",
    top: -7,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: ACTIVE_BLUE,
  },
  label: {
    color: mutedForeground,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
    textAlign: "center",
  },
  labelActive: {
    color: ACTIVE_BLUE,
    fontFamily: "Inter_600SemiBold",
  },
});
