import * as Updates from "expo-updates";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import colors from "@/constants/colors";

const { gold, navy } = colors.light;
const navyMid = "#132040";
const navyLight = "#1B2E4A";

interface UpdateModalProps {
  visible: boolean;
}

export function UpdateModal({ visible }: UpdateModalProps) {
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.goldBar} />

          <Image
            source={require("../assets/images/dt-tours-logo-transparent.png")}
            style={styles.logo}
            resizeMode="contain"
            tintColor={gold}
          />

          <View style={styles.goldDivider} />

          <View style={styles.arabicBlock}>
            <Text style={styles.arabicTitle}>تحديث جديد متوفر!</Text>
            <Text style={styles.arabicBody}>
              يرجى تحديث التطبيق الآن للاستمتاع بآخر الميزات والعطلات والوجهات
              الجديدة.
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.englishBlock}>
            <Text style={styles.englishTitle}>New Update Available!</Text>
            <Text style={styles.englishBody}>
              Please update the app now to enjoy the latest features, holidays,
              and new destinations.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.updateBtn,
              pressed && styles.updateBtnPressed,
              loading && styles.updateBtnLoading,
            ]}
            onPress={handleUpdate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={navy} />
            ) : (
              <Text style={styles.updateBtnText}>تحديث الآن  |  Update Now</Text>
            )}
          </Pressable>

          <View style={styles.goldBar} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: navy,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.45)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },
  goldBar: {
    height: 3,
    backgroundColor: gold,
    width: "100%",
  },
  logo: {
    width: 140,
    height: 52,
    alignSelf: "center",
    marginTop: 24,
    marginBottom: 16,
    opacity: 0.9,
  },
  goldDivider: {
    height: 1,
    backgroundColor: "rgba(201,168,76,0.3)",
    marginHorizontal: 24,
    marginBottom: 22,
  },
  arabicBlock: {
    paddingHorizontal: 24,
    marginBottom: 16,
    alignItems: "flex-end",
  },
  arabicTitle: {
    color: gold,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  arabicBody: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 22,
    opacity: 0.9,
  },
  separator: {
    height: 1,
    backgroundColor: navyMid,
    marginHorizontal: 24,
    marginVertical: 16,
  },
  englishBlock: {
    paddingHorizontal: 24,
    marginBottom: 24,
    alignItems: "flex-start",
  },
  englishTitle: {
    color: gold,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textAlign: "left",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  englishBody: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "left",
    lineHeight: 20,
    opacity: 0.9,
  },
  updateBtn: {
    backgroundColor: gold,
    marginHorizontal: 24,
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: gold,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    minHeight: 52,
  },
  updateBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  updateBtnLoading: {
    opacity: 0.75,
  },
  updateBtnText: {
    color: navy,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textAlign: "center",
  },
});
