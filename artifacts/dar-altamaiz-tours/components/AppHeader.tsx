import React, { useEffect, useState } from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
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

export function AppHeader() {
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
        <DigitalClock />
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
    alignItems: "center",
    justifyContent: "center",
  },
});
