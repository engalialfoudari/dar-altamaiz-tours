import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { MarqueeTicker } from "@/components/MarqueeTicker";
import { HotelPortalIcon } from "@/components/HotelPortalIcon";

const { navy, navyMid } = colors.light;

interface AppHeaderProps {
  onBack?: () => void;
  canGoBack?: boolean;
  onInfo?: () => void;
}

export function AppHeader({ onBack, canGoBack = false, onInfo }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [collapsed, setCollapsed] = useState(false);
  const isTablet = width >= 768;

  const headerHeight = 54;
  const iconSize = isTablet ? 20 : 18;
  const chevronColor = canGoBack ? "#FFFFFF" : "rgba(255,255,255,0.25)";

  if (collapsed) {
    return (
      <View style={[styles.collapsedHeader, { paddingTop: insets.top }]}>
        <Pressable
          style={({ pressed }) => [styles.collapseTab, pressed && styles.iconBtnPressed]}
          onPress={() => setCollapsed(false)}
          hitSlop={12}
          accessibilityLabel="Show announcements"
          accessibilityRole="button"
          testID="app-header-expand"
        >
          <HotelPortalIcon name="chevron-down" size={14} color="#FFFFFF" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={[styles.inner, { height: headerHeight }]}>
        {/* Left: back button */}
        {onBack != null ? (
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.iconBtnPressed,
            ]}
            onPress={onBack}
            hitSlop={12}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            testID="app-header-back"
          >
            <HotelPortalIcon name="chevron-back" size={iconSize} color={chevronColor} />
          </Pressable>
        ) : (
          <View style={styles.sideSlot} />
        )}

        {/* Centre: ticker */}
        <MarqueeTicker embedded />

        {/* Right: light bulb */}
        <View style={styles.rightCol}>
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
              testID="app-header-info"
            >
              <HotelPortalIcon name="lightbulb" size={iconSize} color="#FFFFFF" />
            </Pressable>
          ) : (
            <View style={styles.sideSlot} />
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.dismissButton, pressed && styles.iconBtnPressed]}
          onPress={() => setCollapsed(true)}
          hitSlop={10}
          accessibilityLabel="Hide announcements"
          accessibilityRole="button"
          testID="app-header-dismiss"
        >
          <HotelPortalIcon name="chevron-up" size={12} color="#FFFFFF" />
        </Pressable>
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
    position: "relative",
  },
  rightCol: {
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  iconBtnPressed: {
    backgroundColor: "rgba(201,168,76,0.18)",
  },
  dismissButton: {
    position: "absolute",
    bottom: 0,
    left: "50%",
    marginLeft: -14,
    width: 28,
    height: 16,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  collapsedHeader: {
    alignItems: "center",
    backgroundColor: navy,
    borderBottomWidth: 1,
    borderBottomColor: navyMid,
  },
  collapseTab: {
    width: 34,
    height: 20,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  centreSlot: {
    flex: 1,
    marginHorizontal: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  sideSlot: {
    width: 40,
  },
});
