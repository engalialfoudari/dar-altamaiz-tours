import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HotelPortalIcon } from "@/components/HotelPortalIcon";

export type DeliveryLocation = { latitude: number; longitude: number };

export function DeliveryLocationPicker({ value, lang, onChange }: { value: DeliveryLocation | null; lang: "en" | "ar"; onChange: (location: DeliveryLocation) => void }) {
  const rtl = lang === "ar";
  return (
    <Pressable
      style={[styles.selector, value && styles.complete, rtl && styles.rtlRow]}
      onPress={() => navigator.geolocation?.getCurrentPosition(position => onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude }))}
    >
      <HotelPortalIcon name="location" size={20} color="#003580" />
      <View style={styles.copy}>
        <Text style={[styles.title, rtl && styles.rtl]}>{rtl ? "استخدم موقع التوصيل الحالي" : "Use current delivery location"}</Text>
        <Text style={[styles.sub, rtl && styles.rtl]}>{value ? (rtl ? "تم حفظ الموقع الدقيق" : "Accurate location saved") : (rtl ? "اسمح للمتصفح بالوصول إلى موقعك" : "Allow browser location access")}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  selector: { minHeight: 64, borderWidth: 1, borderColor: "#D8E0EC", borderRadius: 10, padding: 10, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FFF" },
  complete: { borderColor: "#78B88A", backgroundColor: "#F4FBF6" },
  copy: { flex: 1 },
  title: { color: "#003580", fontSize: 13, fontWeight: "800" },
  sub: { color: "#64748B", fontSize: 11, marginTop: 2 },
  rtlRow: { flexDirection: "row-reverse" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
});