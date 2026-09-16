import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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

// Colors matched to the DT Tours hotel portal (dt-tour.com/hotels) —
// Booking.com-style navy blue on white/light-grey, replacing the dark
// navy/gold luxury theme used elsewhere in the app for this screen only.
const HP = {
  primary: "#003580",
  primaryDark: "#00224f",
  bg: "#f2f2f2",
  card: "#FFFFFF",
  cardBorder: "#e2e6ed",
  text: "#1a1a1a",
  textMuted: "#6b7280",
  placeholder: "#9ca3af",
  inputBg: "#f7f9fc",
  inputBorder: "#d0d7de",
  addBg: "#eef4ff",
  addBorder: "#b9d2f7",
  removeBg: "#fef2f2",
  removeBorder: "#fecaca",
  removeText: "#dc2626",
  success: "#1a7a3f",
};

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
const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) =>
  String(CURRENT_YEAR + i),
);

type RequestLanguage = "en" | "ar";

const REQUEST_COPY = {
  en: {
    contactTitle: "Contact Information",
    fullName: "Full Name",
    fullNamePlaceholder: "Your full name",
    email: "Email",
    emailPlaceholder: "email@example.com",
    phone: "Phone",
    welcome: "Welcome to Dar AlTamaiz. Design a private trip for your group and we will find the best offers for you. We will reply within three business days.",
    flightTitle: "Flight",
    from: "From",
    to: "To",
    flightFromPlaceholder: "Kuwait (KWI)",
    flightToPlaceholder: "Istanbul (IST)",
    hotelsTitle: "Requested Hotels",
    hotelName: "Hotel Name",
    hotelPlaceholder: (index: number) => `Hotel ${index}`,
    city: "City",
    cityPlaceholder: "Istanbul",
    addHotel: "+ Add Another Hotel",
    datesTitle: "Travel Dates",
    selectDate: "Select date",
    notesTitle: "Special Remarks / Notes",
    notesPlaceholder: "Any additional requests or details — group size, budget, special requirements...",
    submit: "Send",
    submitting: "Sending...",
    requiredTitle: "Required fields",
    requiredMessage: "Please complete at least the flight details and travel dates.",
    serverErrorTitle: "Unable to send request",
    serverErrorMessage: "Your request could not be sent. Please try again.",
    departureDate: "Departure Date",
    returnDate: "Return Date",
    done: "Done",
    day: "Day",
    month: "Month",
    year: "Year",
    successTitle: "Request Submitted Successfully",
    successMessage: "Thank you. Your special request has been received, and our travel consultants will contact you shortly.",
    requestId: "Request ID",
    ok: "OK",
  },
  ar: {
    contactTitle: "معلومات التواصل",
    fullName: "الاسم الكامل",
    fullNamePlaceholder: "اسمك الكامل",
    email: "البريد الإلكتروني",
    emailPlaceholder: "أدخل بريدك الإلكتروني",
    phone: "الهاتف",
    welcome: "مرحباً بك في دار التميز. صمم رحلة مجموعتك أو قروبك الخاص وسنقوم بتوفير أفضل العروض لك. الرد سيكون خلال ثلاثة أيام عمل إن شاء الله.",
    flightTitle: "رحلة الطيران",
    from: "من",
    to: "إلى",
    flightFromPlaceholder: "الكويت (KWI)",
    flightToPlaceholder: "إسطنبول (IST)",
    hotelsTitle: "الفنادق المطلوبة",
    hotelName: "اسم الفندق",
    hotelPlaceholder: (index: number) => `فندق ${index}`,
    city: "المدينة",
    cityPlaceholder: "إسطنبول",
    addHotel: "+ إضافة فندق آخر",
    datesTitle: "تواريخ السفر",
    selectDate: "اختر التاريخ",
    notesTitle: "ملاحظات إضافية",
    notesPlaceholder: "أي طلبات أو تفاصيل إضافية — حجم المجموعة، الميزانية، متطلبات خاصة...",
    submit: "إرسال",
    submitting: "جاري الإرسال...",
    requiredTitle: "حقول مطلوبة",
    requiredMessage: "يرجى ملء تفاصيل الرحلة والتواريخ على الأقل.",
    serverErrorTitle: "تعذر إرسال الطلب",
    serverErrorMessage: "لم نتمكن من إرسال طلبك. يرجى المحاولة مرة أخرى.",
    departureDate: "تاريخ المغادرة",
    returnDate: "تاريخ العودة",
    done: "تم",
    day: "اليوم",
    month: "الشهر",
    year: "السنة",
    successTitle: "تم إرسال طلبك بنجاح",
    successMessage: "شكراً لك، تم استلام طلبك الخاص وسيقوم فريق مستشاري السفر لدينا بالتواصل معك قريباً.",
    requestId: "رقم الطلب",
    ok: "حسناً",
  },
};

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
    color: "rgba(26,26,26,0.35)",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  itemTextActive: {
    color: HP.text,
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
    borderColor: `${HP.primary}55`,
    borderRadius: 8,
    backgroundColor: "rgba(0,53,128,0.06)",
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
  language: RequestLanguage;
}

function DatePickerModal({
  visible,
  onConfirm,
  onDismiss,
  initialDay = 0,
  initialMonth = new Date().getMonth(),
  initialYear = 0,
  label,
  language,
}: DatePickerModalProps) {
  const copy = REQUEST_COPY[language];
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
            <Text style={dpk.doneBtnText}>{copy.done}</Text>
          </Pressable>
        </View>
        <View style={dpk.colHeaders}>
          <Text style={dpk.colHeader}>{copy.day}</Text>
          <Text style={dpk.colHeader}>{copy.month}</Text>
          <Text style={dpk.colHeader}>{copy.year}</Text>
        </View>
        <View style={dpk.wheels}>
          <WheelColumn items={DAYS} selectedIndex={day} onSelect={setDay} />
          <View style={dpk.divider} />
          <WheelColumn
            items={language === "ar" ? MONTHS_AR : MONTHS}
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
    backgroundColor: HP.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: HP.cardBorder,
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
    color: HP.textMuted,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  doneBtn: {
    backgroundColor: HP.primary,
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 20,
  },
  doneBtnText: {
    color: "#FFFFFF",
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
    color: HP.primary,
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
    backgroundColor: HP.cardBorder,
    marginHorizontal: 4,
  },
});

interface HotelEntry {
  id: string;
  name: string;
  city: string;
}


export function SpecialRequestsScreen({ language = "en" }: { language?: RequestLanguage }) {
  const insets = useSafeAreaInsets();
  const copy = REQUEST_COPY[language];
  const rtl = language === "ar";

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
        copy.requiredTitle,
        copy.requiredMessage,
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
        throw new Error("API_BASE is not configured — rebuild the app with EXPO_PUBLIC_API_BASE set.");
      }
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
      if (!res.ok) {
        const body = await res.text().catch(() => res.status.toString());
        throw new Error(`HTTP ${res.status}: ${body}`);
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
    } catch (error) {
      Alert.alert(copy.serverErrorTitle, copy.serverErrorMessage);
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
           <Text style={[styles.sectionLabel, rtl && styles.rtlText]}>👤  {copy.contactTitle}</Text>
           <Text style={[styles.fieldLabel, rtl && styles.rtlText]}>{copy.fullName}</Text>
          <TextInput
            style={[styles.input, { marginBottom: 10 }]}
            value={contactName}
            onChangeText={setContactName}
             placeholder={copy.fullNamePlaceholder}
             placeholderTextColor={HP.placeholder}
          />
          <View style={styles.row}>
            <View style={styles.halfField}>
               <Text style={[styles.fieldLabel, rtl && styles.rtlText]}>{copy.email}</Text>
              <TextInput
                style={styles.input}
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder={copy.emailPlaceholder}
                 placeholderTextColor={HP.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={[styles.halfField, { marginLeft: 10 }]}>
               <Text style={[styles.fieldLabel, rtl && styles.rtlText]}>{copy.phone}</Text>
              <TextInput
                style={styles.input}
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="+965 XXXX XXXX"
                 placeholderTextColor={HP.placeholder}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* Welcome copy — exact spec Arabic */}
         <Text style={[styles.welcomeText, rtl && styles.rtlText]}>{copy.welcome}</Text>

        {/* Flight Section */}
        <View style={styles.card}>
           <Text style={[styles.sectionLabel, rtl && styles.rtlText]}>✈️  {copy.flightTitle}</Text>
          <View style={styles.row}>
            <View style={styles.halfField}>
               <Text style={[styles.fieldLabel, rtl && styles.rtlText]}>{copy.from}</Text>
              <TextInput
                style={styles.input}
                value={flightFrom}
                onChangeText={setFlightFrom}
                 placeholder={copy.flightFromPlaceholder}
                 placeholderTextColor={HP.placeholder}
                autoCapitalize="characters"
              />
            </View>
            <View style={[styles.halfField, { marginLeft: 10 }]}>
               <Text style={[styles.fieldLabel, rtl && styles.rtlText]}>{copy.to}</Text>
              <TextInput
                style={styles.input}
                value={flightTo}
                onChangeText={setFlightTo}
                 placeholder={copy.flightToPlaceholder}
                 placeholderTextColor={HP.placeholder}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        {/* Hotels Section */}
        <View style={styles.card}>
           <Text style={[styles.sectionLabel, rtl && styles.rtlText]}>🏨  {copy.hotelsTitle}</Text>
          {hotels.map((hotel, idx) => (
            <View key={hotel.id} style={styles.hotelBlock}>
              <View style={styles.row}>
                <View style={styles.halfField}>
                   <Text style={[styles.fieldLabel, rtl && styles.rtlText]}>{copy.hotelName}</Text>
                  <TextInput
                    style={styles.input}
                    value={hotel.name}
                    onChangeText={(t) =>
                      updateHotelField(hotel.id, "name", t)
                    }
                     placeholder={copy.hotelPlaceholder(idx + 1)}
                     placeholderTextColor={HP.placeholder}
                  />
                </View>
                <View style={[styles.halfField, { marginLeft: 10 }]}>
                   <Text style={[styles.fieldLabel, rtl && styles.rtlText]}>{copy.city}</Text>
                  <TextInput
                    style={styles.input}
                    value={hotel.city}
                    onChangeText={(t) =>
                      updateHotelField(hotel.id, "city", t)
                    }
                     placeholder={copy.cityPlaceholder}
                     placeholderTextColor={HP.placeholder}
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
               {copy.addHotel}
            </Text>
          </Pressable>
        </View>

        {/* Date Section */}
        <View style={styles.card}>
           <Text style={[styles.sectionLabel, rtl && styles.rtlText]}>📅  {copy.datesTitle}</Text>
          <View style={styles.row}>
            <View style={styles.halfField}>
               <Text style={[styles.fieldLabel, rtl && styles.rtlText]}>{copy.from}</Text>
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
                   {dateFromStr || copy.selectDate}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.halfField, { marginLeft: 10 }]}>
               <Text style={[styles.fieldLabel, rtl && styles.rtlText]}>{copy.to}</Text>
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
                   {dateToStr || copy.selectDate}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Notes Section */}
        <View style={styles.card}>
           <Text style={[styles.sectionLabel, rtl && styles.rtlText]}>📝  {copy.notesTitle}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
             placeholder={copy.notesPlaceholder}
             placeholderTextColor={HP.placeholder}
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
          {submitting ? (
             <Text style={styles.submitBtnText}>{copy.submitting}</Text>
          ) : (
             <Text style={styles.submitBtnText}>{copy.submit}</Text>
          )}
        </Pressable>

      </ScrollView>
      </KeyboardAvoidingView>

      {/* Departure date picker */}
      <DatePickerModal
        visible={activePicker === "from"}
         label={copy.departureDate}
         language={language}
        initialDay={dateFromDay}
        initialMonth={dateFromMonth}
        initialYear={dateFromYear}
        onConfirm={(d, m, y) => handleDateConfirm(d, m, y, "from")}
        onDismiss={() => setActivePicker(null)}
      />

      {/* Return date picker */}
      <DatePickerModal
        visible={activePicker === "to"}
         label={copy.returnDate}
         language={language}
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
              <Circle cx="32" cy="32" r="30" fill={HP.success} />
              <Path
                d="M18 32l10 10 18-20"
                stroke="#FFFFFF"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
             <Text style={[styles.modalTitle, rtl && styles.rtlText]}>{copy.successTitle}</Text>
            <Text style={styles.modalText}>
               {`${copy.successMessage}\n\n`}
               <Text style={styles.modalRequestIdLabel}>{`${copy.requestId}: `}</Text>
              <Text style={styles.modalRequestId}>{requestId}</Text>
            </Text>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setSuccessModal(false)}
            >
               <Text style={styles.modalCloseBtnText}>{copy.ok}</Text>
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
    backgroundColor: HP.bg,
  },
  scroll: {
    padding: 16,
    paddingBottom: 60,
  },
  welcomeText: {
    color: HP.textMuted,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: HP.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: HP.cardBorder,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionLabel: {
    color: HP.primary,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
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
    color: HP.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  input: {
    backgroundColor: HP.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HP.inputBorder,
    color: HP.text,
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
    color: HP.text,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  dateBtnPlaceholder: {
    color: HP.placeholder,
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
    backgroundColor: HP.removeBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: HP.removeBorder,
    marginLeft: 8,
    marginBottom: 0,
  },
  removeBtnText: {
    color: HP.removeText,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  addHotelBtn: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: HP.addBg,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HP.addBorder,
  },
  addHotelBtnText: {
    color: HP.primary,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  submitBtn: {
    backgroundColor: HP.primary,
    borderRadius: 50,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: HP.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  submitBtnTextAr: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    lineHeight: 19,
  },
  submitBtnTextEn: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 14,
    letterSpacing: 0.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: HP.card,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: HP.cardBorder,
    width: "100%",
    maxWidth: 380,
  },
  modalTitle: {
    color: HP.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 14,
  },
  modalText: {
    color: HP.textMuted,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  modalRequestIdLabel: {
    color: HP.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  modalRequestId: {
    color: HP.primary,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  modalCloseBtn: {
    backgroundColor: HP.primary,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 50,
  },
  modalCloseBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
