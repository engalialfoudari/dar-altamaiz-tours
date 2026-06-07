import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";

const { gold, navy, navyMid } = colors.light;

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
  const logoWidth = isTablet ? 200 : 160;
  const logoHeight = isTablet ? 44 : 36;

  return (
    <View style={[styles.header, { paddingTop: statusBarHeight }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={navy}
        translucent={Platform.OS === "android"}
      />
      <View style={[styles.inner, { height: headerHeight }]}>
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/images/dt-tours-logo-transparent.png")}
            style={{ width: logoWidth, height: logoHeight }}
            resizeMode="contain"
            tintColor={gold}
          />
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
  logoWrap: {
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
