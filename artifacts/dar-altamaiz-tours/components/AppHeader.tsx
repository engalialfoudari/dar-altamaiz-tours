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

interface AppHeaderProps {
  onBack?: () => void;
  canGoBack?: boolean;
  onInfo?: () => void;
}

export function AppHeader({ onBack, canGoBack = false }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const headerHeight = isTablet ? 60 : 52;
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

        <View style={styles.centreSlot} />

        <View style={styles.sideSlot} />
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
  },
  sideSlot: {
    width: 40,
  },
});
