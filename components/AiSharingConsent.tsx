import React from "react";
import { Pressable, Text, View } from "react-native";
import { aiSharingNotice } from "@/lib/aiConsent";

export function AiSharingConsent({ locale, kind, allowed, onChange, dark = false }: {
  locale: "en" | "ar" | "tr";
  kind: "chat" | "builder";
  allowed: boolean;
  onChange: (value: boolean) => void;
  dark?: boolean;
}) {
  const label = locale === "ar" ? "أوافق على مشاركة البيانات مع الذكاء الاصطناعي"
    : locale === "tr" ? "Yapay zekâ ile veri paylaşımına izin veriyorum"
      : "I allow sharing this data with AI";
  const color = dark ? "#FFFFFF" : "#0A1628";
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      <Text testID={`${kind === "chat" ? "chat" : "pb"}-ai-sharing-notice`}
        style={{ color, opacity: 0.8, fontSize: 11, textAlign: locale === "ar" ? "right" : "left", writingDirection: locale === "ar" ? "rtl" : "ltr" }}>
        {aiSharingNotice[locale][kind]}
      </Text>
      <Pressable testID={`${kind}-ai-sharing-consent`} accessibilityRole="checkbox"
        accessibilityLabel={label} accessibilityState={{ checked: allowed }}
        onPress={() => onChange(!allowed)}
        style={{ flexDirection: locale === "ar" ? "row-reverse" : "row", alignItems: "center", gap: 8, minHeight: 44 }}>
        <View style={{ width: 21, height: 21, borderWidth: 1, borderColor: color, borderRadius: 4, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color, fontSize: 15 }}>{allowed ? "✓" : ""}</Text>
        </View>
        <Text style={{ color, fontSize: 12, flex: 1, textAlign: locale === "ar" ? "right" : "left" }}>{label}</Text>
      </Pressable>
    </View>
  );
}
