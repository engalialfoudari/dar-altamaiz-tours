import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";

const { gold, navy, navyMid, mutedForeground } = colors.light;

export type TabKey = "home" | "trips" | "bookings" | "settings";

export interface Tab {
  key: TabKey;
  labelEn: string;
  url: string;
}

export const TABS: Tab[] = [
  {
    key: "home",
    labelEn: "Home",
    url: "https://dt-tours.com/",
  },
  {
    key: "trips",
    labelEn: "Holidays",
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

function IconGlobe({ size, color, active }: { size: number; color: string; active: boolean }) {
  const sw = active ? 2.2 : 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={sw} />
      <Path
        d="M2 12h20"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Path
        d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function TabIcon({ tabKey, size, color, active }: { tabKey: TabKey; size: number; color: string; active: boolean }) {
  switch (tabKey) {
    case "home":      return <IconHome size={size} color={color} active={active} />;
    case "trips":     return <IconGlobe size={size} color={color} active={active} />;
    case "bookings":  return <IconBriefcase size={size} color={color} active={active} />;
    case "settings":  return <IconPhone size={size} color={color} active={active} />;
  }
}

interface BottomTabBarProps {
  activeTab: TabKey;
  onTabPress: (tab: Tab) => void;
}

export function BottomTabBar({ activeTab, onTabPress }: BottomTabBarProps) {
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
        const iconColor = isActive ? gold : mutedForeground;
        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            onPress={() => onTabPress(tab)}
            hitSlop={4}
          >
            {isActive && (
              <View style={[styles.activeIndicator, isTablet && { width: 36, height: 3 }]} />
            )}
            <TabIcon tabKey={tab.key} size={iconSize} color={iconColor} active={isActive} />
            <Text
              style={[
                styles.label,
                { fontSize: labelSize },
                isActive && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {tab.labelEn}
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
