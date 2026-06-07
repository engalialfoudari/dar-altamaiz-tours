import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";

const { gold, navy, navyMid, mutedForeground } = colors.light;

export type TabKey = "home" | "trips" | "bookings" | "settings";

export interface Tab {
  key: TabKey;
  labelAr: string;
  labelEn: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  url: string;
}

export const TABS: Tab[] = [
  {
    key: "home",
    labelAr: "الرئيسية",
    labelEn: "Home",
    icon: "home-outline",
    activeIcon: "home",
    url: "https://dt-tours.com/",
  },
  {
    key: "trips",
    labelAr: "الرحلات",
    labelEn: "Trips",
    icon: "compass-outline",
    activeIcon: "compass",
    url: "https://dt-tours.com/index.php/tours/search/",
  },
  {
    key: "bookings",
    labelAr: "حجوزاتي",
    labelEn: "Bookings",
    icon: "ticket-outline",
    activeIcon: "ticket",
    url: "https://dt-tours.com/index.php/general/my_booking",
  },
  {
    key: "settings",
    labelAr: "الإعدادات",
    labelEn: "Contact",
    icon: "call-outline",
    activeIcon: "call",
    url: "https://dt-tours.com/general/contact_us/",
  },
];

interface BottomTabBarProps {
  activeTab: TabKey;
  onTabPress: (tab: Tab) => void;
  currentLang: "EN" | "AR";
}

export function BottomTabBar({ activeTab, onTabPress, currentLang }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const iconSize = isTablet ? 26 : 22;
  const labelSize = isTablet ? 12 : 10;
  const tabHeight = isTablet ? 68 : 54;

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
        const label = currentLang === "AR" ? tab.labelAr : tab.labelEn;
        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              styles.tab,
              pressed && styles.tabPressed,
            ]}
            onPress={() => onTabPress(tab)}
            hitSlop={4}
          >
            {isActive && <View style={[styles.activeIndicator, isTablet && { width: 36, height: 3 }]} />}
            <Ionicons
              name={isActive ? tab.activeIcon : tab.icon}
              size={iconSize}
              color={isActive ? gold : mutedForeground}
            />
            <Text
              style={[
                styles.label,
                { fontSize: labelSize },
                isActive && styles.labelActive,
              ]}
              numberOfLines={1}
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
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: gold,
  },
  label: {
    color: mutedForeground,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
    textAlign: "center",
  },
  labelActive: {
    color: gold,
    fontFamily: "Inter_600SemiBold",
  },
});
