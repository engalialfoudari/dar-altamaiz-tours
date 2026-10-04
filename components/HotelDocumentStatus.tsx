import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";
import type { AppLocale } from "@/localization/engine";
import { hotelDocumentCopy, type HotelDocumentState } from "@/lib/hotelDocumentReadiness";

const { navy, gold, text } = colors.light;

/** Covers only the hotel layer; the existing document and app navigation stay mounted. */
export function HotelDocumentStatus({ state, language, onRetry }: {
  state: HotelDocumentState;
  language: AppLocale;
  onRetry: () => void;
}) {
  if (state === "ready") return null;
  const copy = hotelDocumentCopy[language];
  return (
    <View style={[StyleSheet.absoluteFillObject, styles.screen]} testID="hotel-document-status">
      {state === "loading" && <ActivityIndicator color={gold} />}
      <Text accessibilityRole={state === "error" ? "alert" : "text"} accessibilityLiveRegion="polite"
        style={[styles.text, { writingDirection: language === "ar" ? "rtl" : "ltr" }]}>
        {state === "loading" ? copy.loading : copy.error}
      </Text>
      {state === "error" && <Pressable accessibilityRole="button" testID="hotel-document-retry"
        style={styles.retry} onPress={onRetry}>
        <Text style={styles.retryText}>{copy.retry}</Text>
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: navy, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  text: { color: text, textAlign: "center", fontSize: 16, lineHeight: 25 },
  retry: { backgroundColor: gold, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: navy, fontWeight: "700", fontSize: 16 },
});