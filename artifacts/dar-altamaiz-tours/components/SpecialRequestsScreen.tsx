import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  const ts3 = Date.now().toString().slice(-3);
  const rand2 = Math.floor(Math.random() * 90 + 10).toString();
  return `DT-${ts3}${rand2}`;
}

function formatDate(day: number, month: number, year: number): string {
  return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
}

const DAYS = Array.from({ length: 31 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) =>
  String(CURRENT_YEAR + i),
);

const ITEM_H = 44;
const VISIBLE = 3;

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function WheelColumn({ items, selectedIndex, onSelect }: WheelColumnProps) {
  const ref = useRef<ScrollView>(null);
  const lastIndex = useRef(selectedIndex);

  const scrollToIndex = (index: number, animated = true) => {
    ref.current?.scrollTo({ y: index * ITEM_H, animated });
  };

  return (
    <View style={wheel.col}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onLayout={() => scrollToIndex(selectedIndex, false)}
        onMomentumScrollEnd={(e) => {
          const raw = e.nativeEvent.contentOffset.y / ITEM_H;
          const clamped = Math.min(
            items.length - 1,
            Math.max(0, Math.round(raw)),
          );
          if (clamped !== lastIndex.current) {
            lastIndex.current = clamped;
            onSelect(clamped);
          }
        }}
        onScrollEndDrag={(e) => {
          const raw = e.nativeEvent.contentOffset.y / ITEM_H;
          const clamped = Math.min(
            items.length - 1,
            Math.max(0, Math.round(raw)),
          );
          if (clamped !== lastIndex.current) {
            lastIndex.current = clamped;
            onSelect(clamped);
            scrollToIndex(clamped, true);
          }
        }}
      >
        {items.map((label, i) => (
          <View key={i} style={wheel.item}>
            <Text
              style={[
                wheel.itemText,
                i === selectedIndex && wheel.itemTextActive,
              ]}
            >
              {label}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={wheel.selectionBar} pointerEvents="none" />
    </View>
  );
}

const wheel = StyleSheet.create({
  col: {
    flex: 1,
    height: ITEM_H * VISIBLE,
    overflow: "hidden",
    position: "relative",
  },
  item: {
    height: ITEM_H,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  itemTextActive: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  selectionBar: {
    position: "absolute",
    top: ITEM_H,
    left: 4,
    right: 4,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: `${gold}66`,
    borderRadius: 8,
    backgroundColor: "rgba(201,168,76,0.07)",
  },
});

interface DatePickerModalProps {
  visible: boolean;
  onConfirm: (day: number, month: number, year: number) => void;
  onDismiss: () => void;
  initialDay?: number;
  initialMonth?: number;
  initialYear?: number;
  label: string;
}

function DatePickerModal({
  visible,
  onConfirm,
  onDismiss,
  initialDay = 0,
  initialMonth = new Date().getMonth(),
  initialYear = 0,
  label,
}: DatePickerModalProps) {
  const [day, setDay] = useState(initialDay);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={dpk.overlay} onPress={onDismiss} />
      <View style={dpk.sheet}>
        <View style={dpk.header}>
          <Text style={dpk.headerLabel}>{label}</Text>
          <Pressable
            onPress={() => onConfirm(day, month, year)}
            style={dpk.doneBtn}
          >
            <Text style={dpk.doneBtnText}>Done</Text>
          </Pressable>
        </View>
        <View style={dpk.colHeaders}>
          <Text style={dpk.colHeader}>Day</Text>
          <Text style={dpk.colHeader}>Month</Text>
          <Text style={dpk.colHeader}>Year</Text>
        </View>
        <View style={dpk.wheels}>
          <WheelColumn items={DAYS} selectedIndex={day} onSelect={setDay} />
          <View style={dpk.divider} />
          <WheelColumn
            items={MONTHS}
            selectedIndex={month}
            onSelect={setMonth}
          />
          <View style={dpk.divider} />
          <WheelColumn items={YEARS} selectedIndex={year} onSelect={setYear} />
        </View>
      </View>
    </Modal>
  );
}

const dpk = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: "#0D2040",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: `${gold}55`,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 18,
    paddingBottom: 10,
  },
  headerLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  doneBtn: {
    backgroundColor: gold,
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 20,
  },
  doneBtnText: {
    color: navy,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  colHeaders: {
    flexDirection: "row",
    marginBottom: 4,
  },
  colHeader: {
    flex: 1,
    textAlign: "center",
    color: gold,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  wheels: {
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    width: 1,
    height: ITEM_H * VISIBLE,
    backgroundColor: "rgba(201,168,76,0.2)",
    marginHorizontal: 4,
  },
});

interface HotelEntry {
  id: string;
  name: string;
  city: string;
}

export function SpecialRequestsScreen() {
  const insets = useSafeAreaInsets();

  const [flightFrom, setFlightFrom] = useState("");
  const [flightTo, setFlightTo] = useState("");

  const [hotels, setHotels] = useState<HotelEntry[]>([
    { id: "1", name: "", city: "" },
  ]);

  const [dateFromStr, setDateFromStr] = useState("");
  const [dateFromDay, setDateFromDay] = useState(0);
  const [dateFromMonth, setDateFromMonth] = useState(new Date().getMonth());
  const [dateFromYear, setDateFromYear] = useState(0);

  const [dateToStr, setDateToStr] = useState("");
  const [dateToDay, setDateToDay] = useState(6);
  const [dateToMonth, setDateToMonth] = useState(new Date().getMonth());
  const [dateToYear, setDateToYear] = useState(0);

  const [activePicker, setActivePicker] = useState<"from" | "to" | null>(null);

  const [notes, setNotes] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [requestId, setRequestId] = useState("");

  useEffect(() => {
    AsyncStorage.multiGet(["dt_contact_name", "dt_contact_email", "dt_contact_phone"])
      .then((pairs) => {
        const [name, email, phone] = pairs.map(([, v]) => v ?? "");
        if (name) setContactName(name);
        if (email) setContactEmail(email);
        if (phone) setContactPhone(phone);
      })
      .catch(() => {});
  }, []);

  const addHotel = () =>
    setHotels((p) => [
      ...p,
      { id: Date.now().toString(), name: "", city: "" },
    ]);
  const removeHotel = (id: string) =>
    setHotels((p) => p.filter((h) => h.id !== id));
  const updateHotelField = (
    id: string,
    field: "name" | "city",
    value: string,
  ) =>
    setHotels((p) =>
      p.map((h) => (h.id === id ? { ...h, [field]: value } : h)),
    );

  const handleDateConfirm = (
    d: number,
    m: number,
    y: number,
    field: "from" | "to",
  ) => {
    const str = formatDate(d + 1, m, CURRENT_YEAR + y);
    if (field === "from") {
      setDateFromDay(d);
      setDateFromMonth(m);
      setDateFromYear(y);
      setDateFromStr(str);
    } else {
      setDateToDay(d);
      setDateToMonth(m);
      setDateToYear(y);
      setDateToStr(str);
    }
    setActivePicker(null);
  };

  const handleSubmit = async () => {
    if (!flightFrom.trim() || !flightTo.trim() || !dateFromStr || !dateToStr) {
      Alert.alert(
        "حقول مطلوبة",
        "يرجى ملء تفاصيل الرحلة والتواريخ على الأقل.",
      );
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    const rid = generateRequestId();
    setSubmitting(true);
    try {
      if (!API_BASE) {
        await new Promise((r) => setTimeout(r, 700));
      } else {
        const res = await fetch(`${API_BASE}/requests/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: rid,
            contactName: contactName.trim(),
            contactEmail: contactEmail.trim(),
            contactPhone: contactPhone.trim(),
            flightFrom: flightFrom.trim(),
            flightTo: flightTo.trim(),
            hotels: hotels
              .filter((h) => h.name.trim())
              .map((h) => ({ name: h.name.trim(), city: h.city.trim() })),
            dateFrom: dateFromStr,
            dateTo: dateToStr,
            notes: notes.trim(),
          }),
        });
        if (!res.ok) throw new Error("server_error");
      }
      // Cache contact details for autofill on next visit
      AsyncStorage.multiSet([
        ["dt_contact_name", contactName.trim()],
        ["dt_contact_email", contactEmail.trim()],
        ["dt_contact_phone", contactPhone.trim()],
      ]).catch(() => {});
      setFlightFrom("");
      setFlightTo("");
      setHotels([{ id: "1", name: "", city: "" }]);
      setDateFromStr("");
      setDateToStr("");
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
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 120}
        style={{ flex: 1 }}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Contact Info Section */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>👤  معلومات التواصل</Text>
          <Text style={styles.fieldLabel}>Full Name (الاسم الكامل)</Text>
          <TextInput
            style={[styles.input, { marginBottom: 10 }]}
            value={contactName}
            onChangeText={setContactName}
            placeholder="اسمك الكامل"
            placeholderTextColor="rgba(255,255,255,0.25)"
          />
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Email (البريد)</Text>
              <TextInput
                style={styles.input}
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="email@example.com"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={[styles.halfField, { marginLeft: 10 }]}>
              <Text style={styles.fieldLabel}>Phone (الهاتف)</Text>
              <TextInput
                style={styles.input}
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="+965 XXXX XXXX"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* Welcome copy — exact spec Arabic */}
        <Text style={styles.welcomeText}>
          مرحباً بك في دار التميز. صمم رحلة مجموعتك أو قروبك الخاص وسنقوم
          بتوفير أفضل العروض لك. الرد سيكون خلال ثلاثة أيام عمل إن شاء الله.
        </Text>

        {/* Flight Section */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>✈️  رحلة الطيران</Text>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>From (من)</Text>
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
              <Text style={styles.fieldLabel}>To (إلى)</Text>
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

        {/* Hotels Section */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>🏨  الفنادق المطلوبة</Text>
          {hotels.map((hotel, idx) => (
            <View key={hotel.id} style={styles.hotelBlock}>
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>
                    Hotel Name (اسم الفندق)
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={hotel.name}
                    onChangeText={(t) =>
                      updateHotelField(hotel.id, "name", t)
                    }
                    placeholder={`فندق ${idx + 1}`}
                    placeholderTextColor="rgba(255,255,255,0.25)"
                  />
                </View>
                <View style={[styles.halfField, { marginLeft: 10 }]}>
                  <Text style={styles.fieldLabel}>City (المدينة)</Text>
                  <TextInput
                    style={styles.input}
                    value={hotel.city}
                    onChangeText={(t) =>
                      updateHotelField(hotel.id, "city", t)
                    }
                    placeholder="Istanbul"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                  />
                </View>
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
            </View>
          ))}
          <Pressable onPress={addHotel} style={styles.addHotelBtn}>
            <Text style={styles.addHotelBtnText}>
              + Add Another Hotel (إضافة فندق آخر)
            </Text>
          </Pressable>
        </View>

        {/* Date Section */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>📅  تواريخ السفر</Text>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>From (من)</Text>
              <Pressable
                style={[styles.input, styles.dateBtn]}
                onPress={() => setActivePicker("from")}
              >
                <Text
                  style={[
                    styles.dateBtnText,
                    !dateFromStr && styles.dateBtnPlaceholder,
                  ]}
                >
                  {dateFromStr || "Select date"}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.halfField, { marginLeft: 10 }]}>
              <Text style={styles.fieldLabel}>To (إلى)</Text>
              <Pressable
                style={[styles.input, styles.dateBtn]}
                onPress={() => setActivePicker("to")}
              >
                <Text
                  style={[
                    styles.dateBtnText,
                    !dateToStr && styles.dateBtnPlaceholder,
                  ]}
                >
                  {dateToStr || "Select date"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Notes Section */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>
            📝  Special Remarks / Notes (ملاحظات إضافية)
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="أي طلبات أو تفاصيل إضافية — حجم المجموعة، الميزانية، متطلبات خاصة..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            numberOfLines={5}
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
            {submitting ? "جاري الإرسال..." : "Submit Request  ›"}
          </Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Departure date picker */}
      <DatePickerModal
        visible={activePicker === "from"}
        label="Departure Date  (تاريخ المغادرة)"
        initialDay={dateFromDay}
        initialMonth={dateFromMonth}
        initialYear={dateFromYear}
        onConfirm={(d, m, y) => handleDateConfirm(d, m, y, "from")}
        onDismiss={() => setActivePicker(null)}
      />

      {/* Return date picker */}
      <DatePickerModal
        visible={activePicker === "to"}
        label="Return Date  (تاريخ العودة)"
        initialDay={dateToDay}
        initialMonth={dateToMonth}
        initialYear={dateToYear}
        onConfirm={(d, m, y) => handleDateConfirm(d, m, y, "to")}
        onDismiss={() => setActivePicker(null)}
      />

      {/* Success Modal */}
      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Svg
              width={64}
              height={64}
              viewBox="0 0 64 64"
              style={{ marginBottom: 18 }}
            >
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
            <Text style={styles.modalTitle}>
              تم إرسال طلبك بنجاح | Request Submitted Successfully
            </Text>
            <Text style={styles.modalText}>
              {"شكراً لك، تم استلام طلبك الخاص وسيقوم فريق مستشاري السفر لدينا بالتواصل معك قريباً.\n\nThank you, your special request has been received. Our travel consultants team will contact you shortly.\n\n"}
              <Text style={styles.modalRequestIdLabel}>{"Request ID: "}</Text>
              <Text style={styles.modalRequestId}>{requestId}</Text>
            </Text>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setSuccessModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>حسناً  |  OK</Text>
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
    paddingBottom: 60,
  },
  welcomeText: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.2)",
  },
  sectionLabel: {
    color: gold,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
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
  dateBtn: {
    justifyContent: "center",
  },
  dateBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  dateBtnPlaceholder: {
    color: "rgba(255,255,255,0.28)",
  },
  textArea: {
    height: 110,
    paddingTop: 10,
  },
  hotelBlock: {
    marginBottom: 8,
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
    marginLeft: 8,
    marginBottom: 0,
  },
  removeBtnText: {
    color: "#FF6B6B",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  addHotelBtn: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(201,168,76,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.4)",
  },
  addHotelBtnText: {
    color: gold,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  submitBtn: {
    backgroundColor: gold,
    borderRadius: 50,
    height: 50,
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
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 14,
  },
  modalText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  modalRequestIdLabel: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  modalRequestId: {
    color: gold,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
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
