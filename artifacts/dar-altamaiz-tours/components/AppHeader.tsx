import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { MarqueeTicker } from "@/components/MarqueeTicker";

const { navy, navyMid } = colors.light;

function ChevronLeft({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LightBulbIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 21h6"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 18h6"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 15.5A6 6 0 1 0 9 15.5V18h6v-2.5z"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface AppHeaderProps {
  onBack?: () => void;
  canGoBack?: boolean;
  onInfo?: () => void;
}

export function AppHeader({ onBack, canGoBack = false, onInfo }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const headerHeight = 50;
  const iconSize = isTablet ? 24 : 22;
  const chevronColor = canGoBack ? "#FFFFFF" : "rgba(255,255,255,0.25)";

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={[styles.inner, { height: headerHeight }]}>
        {onBack != null ? (
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.iconBtnPressed,
            ]}
            onPress={onBack}
            disabled={!canGoBack}
            hitSlop={12}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ChevronLeft size={iconSize} color={chevronColor} />
          </Pressable>
        ) : (
          <View style={styles.sideSlot} />
        )}

        <MarqueeTicker embedded />

        {onInfo != null ? (
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.iconBtnPressed,
            ]}
            onPress={onInfo}
            hitSlop={12}
            accessibilityLabel="Search guidelines"
            accessibilityRole="button"
          >
            <LightBulbIcon size={iconSize} />
          </Pressable>
        ) : (
          <View style={styles.sideSlot} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: navy,
    borderBottomWidth: 1,
    borderBottomColor: navyMid,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  iconBtnPressed: {
    backgroundColor: "rgba(201,168,76,0.18)",
  },
  centreSlot: {
    flex: 1,
    marginHorizontal: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  sideSlot: {
    width: 40,
  },
});
