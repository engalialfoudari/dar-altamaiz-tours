import { Ionicons } from "@expo/vector-icons";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";

const { gold, navy, navyMid } = colors.light;

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

interface AppHeaderProps {
  onAvatarPress: () => void;
}

export function AppHeader({ onAvatarPress }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const statusBarHeight =
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : insets.top;

  const headerHeight = isTablet ? 60 : 52;

  return (
    <View style={[styles.header, { paddingTop: statusBarHeight }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={navy}
        translucent={Platform.OS === "android"}
      />
      <View style={[styles.inner, { height: headerHeight }]}>
        <View style={styles.clockWrap}>
          <DigitalClock />
        </View>

        <Pressable
          style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
          onPress={onAvatarPress}
          hitSlop={8}
        >
          <Ionicons name="person-outline" size={isTablet ? 22 : 19} color={gold} />
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
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  clockWrap: {
    flex: 1,
    alignItems: "center",
  },
  avatar: {
    position: "absolute",
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(201,168,76,0.1)",
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPressed: {
    backgroundColor: "rgba(201,168,76,0.25)",
  },
});
