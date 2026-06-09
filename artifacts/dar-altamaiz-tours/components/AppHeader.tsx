import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";

const { navy, navyMid } = colors.light;

function DigitalClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const dateStr = `${dd}/${mm}/${yyyy}`;

  return (
    <View style={clockStyles.wrap}>
      <Text style={clockStyles.time}>{timeStr}</Text>
      <Text style={clockStyles.date}>{dateStr}</Text>
    </View>
  );
}

const clockStyles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  time: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    lineHeight: 18,
  },
  date: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.8,
    lineHeight: 14,
  },
});

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
      {/* bulb body */}
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

  const statusBarHeight =
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : insets.top;

  const headerHeight = isTablet ? 60 : 52;
  const iconSize = isTablet ? 24 : 22;
  const chevronColor = canGoBack ? "#FFFFFF" : "rgba(255,255,255,0.25)";

  return (
    <View style={[styles.header, { paddingTop: statusBarHeight }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={navy}
        translucent={Platform.OS === "android"}
      />
      <View style={[styles.inner, { height: headerHeight }]}>
        {/* Left: back chevron */}
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

        {/* Centre: clock */}
        <View style={styles.clockWrap}>
          <DigitalClock />
        </View>

        {/* Right: info button */}
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
  clockWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sideSlot: {
    width: 40,
  },
});
