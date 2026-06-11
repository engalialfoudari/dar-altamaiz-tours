import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";

const { gold, navy } = colors.light;

const API_BASE = (process.env["EXPO_PUBLIC_API_BASE"] ?? "").replace(/\/$/, "");

function generateRequestId(): string {
  const tsSuffix = Date.now().toString().slice(-4);
  const randDigit = Math.floor(Math.random() * 10).toString();
  return `DT-${tsSuffix}${randDigit}`;
}

interface HotelEntry {
  id: string;
  name: string;
}

function SectionIcon({ children }: { children: string }) {
  return <Text style={styles.sectionEmoji}>{children}</Text>;
}

export function SpecialRequestsScreen() {
  const insets = useSafeAreaInsets();
  const [flightFrom, setFlightFrom] = useState("");
  const [flightTo, setFlightTo] = useState("");
  const [hotels, setHotels] = useState<HotelEntry[]>([{ id: "1", name: "" }]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [requestId, setRequestId] = useState("");

  const addHotel = () =>
    setHotels((p) => [...p, { id: Date.now().toString(), name: "" }]);
  const removeHotel = (id: string) =>
    setHotels((p) => p.filter((h) => h.id !== id));
  const updateHotel = (id: string, name: string) =>
    setHotels((p) => p.map((h) => (h.id === id ? { ...h, name } : h)));

  const handleSubmit = async () => {
    if (!flightFrom.trim() || !flightTo.trim() || !dateFrom.trim() || !dateTo.trim()) {
      Alert.alert(
        "حقول مطلوبة",
        "يرجى ملء تفاصيل الرحلة والتواريخ على الأقل.",
      );
      return;
    }
    const rid = generateRequestId();
    setSubmitting(true);
    try {
      if (!API_BASE) {
        await new Promise((r) => setTimeout(r, 800));
      } else {
        const res = await fetch(`${API_BASE}/requests/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: rid,
            flightFrom: flightFrom.trim(),
            flightTo: flightTo.trim(),
            hotels: hotels.map((h) => h.name).filter(Boolean),
            dateFrom: dateFrom.trim(),
            dateTo: dateTo.trim(),
            notes: notes.trim(),
          }),
        });
        if (!res.ok) throw new Error("server_error");
      }
      setFlightFrom("");
      setFlightTo("");
      setHotels([{ id: "1", name: "" }]);
      setDateFrom("");
      setDateTo("");
      setNotes("");
      setRequestId(rid);
      setSuccessModal(true);
    } catch {
      Alert.alert(
        "خطأ",
        "حدث خطأ أثناء إرسال طلبك. يرجى المحاولة مرة أخرى.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>طلب خاص / Special Request</Text>
        <Text style={styles.subheading}>
          أرسل لنا تفاصيل رحلتك وسنوفر لك أفضل العروض
        </Text>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <SectionIcon>✈️</SectionIcon>
            <Text style={styles.sectionLabel}>رحلة الطيران</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>من / From</Text>
              <TextInput
                style={styles.input}
                value={flightFrom}
                onChangeText={setFlightFrom}
                placeholder="Kuwait (KWI)"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="characters"
              />
            </View>
            <View style={[styles.halfField, { marginLeft: 10 }]}>
              <Text style={styles.fieldLabel}>إلى / To</Text>
              <TextInput
                style={styles.input}
                value={flightTo}
                onChangeText={setFlightTo}
                placeholder="Istanbul (IST)"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <SectionIcon>📅</SectionIcon>
            <Text style={styles.sectionLabel}>تواريخ السفر</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>تاريخ المغادرة</Text>
              <TextInput
                style={styles.input}
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholder="DD/MM/YYYY"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={[styles.halfField, { marginLeft: 10 }]}>
              <Text style={styles.fieldLabel}>تاريخ العودة</Text>
              <TextInput
                style={styles.input}
                value={dateTo}
                onChangeText={setDateTo}
                placeholder="DD/MM/YYYY"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.hotelHeader}>
            <View style={styles.sectionHeader}>
              <SectionIcon>🏨</SectionIcon>
              <Text style={styles.sectionLabel}>الفنادق المطلوبة</Text>
            </View>
            <Pressable onPress={addHotel} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ إضافة</Text>
            </Pressable>
          </View>
          {hotels.map((hotel, idx) => (
            <View key={hotel.id} style={styles.hotelRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={hotel.name}
                onChangeText={(t) => updateHotel(hotel.id, t)}
                placeholder={`فندق ${idx + 1}`}
                placeholderTextColor="rgba(255,255,255,0.25)"
              />
              {hotels.length > 1 && (
                <Pressable
                  onPress={() => removeHotel(hotel.id)}
                  style={styles.removeBtn}
                  hitSlop={8}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <SectionIcon>📝</SectionIcon>
            <Text style={styles.sectionLabel}>ملاحظات إضافية</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="أي طلبات أو تفاصيل إضافية..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            (pressed || submitting) && { opacity: 0.8 },
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? "جاري الإرسال..." : "إرسال الطلب  ›"}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Svg width={64} height={64} viewBox="0 0 64 64" style={{ marginBottom: 18 }}>
              <Circle cx="32" cy="32" r="30" fill="#1A7A4A" />
              <Path
                d="M18 32l10 10 18-20"
                stroke="#FFFFFF"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
            <Text style={styles.modalText}>
              {`تم إرسال طلبك بنجاح! رقم الطلب الخاص بك هو: `}
              <Text style={styles.modalRequestId}>{requestId}</Text>
              {`. سيقوم فريق دار التميز بالرد عليك وتوفير أفضل العروض خلال 3 أيام عمل إن شاء الله. يمكنك استخدام هذا الرقم للمتابعة معنا عبر الواتساب أو الإيميل.`}
            </Text>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setSuccessModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>حسناً</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy,
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  heading: {
    color: gold,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  subheading: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.2)",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  sectionLabel: {
    color: gold,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
  },
  halfField: {
    flex: 1,
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.25)",
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 42,
  },
  textArea: {
    height: 90,
    paddingTop: 10,
  },
  hotelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  hotelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  addBtn: {
    backgroundColor: "rgba(201,168,76,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.4)",
  },
  addBtnText: {
    color: gold,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,60,60,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,60,60,0.3)",
  },
  removeBtnText: {
    color: "#FF6B6B",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  submitBtn: {
    backgroundColor: gold,
    borderRadius: 50,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: gold,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  submitBtnText: {
    color: navy,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#0D2040",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.4)",
    width: "100%",
    maxWidth: 380,
  },
  modalText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 24,
  },
  modalRequestId: {
    color: gold,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  modalCloseBtn: {
    backgroundColor: gold,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 50,
  },
  modalCloseBtnText: {
    color: navy,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
