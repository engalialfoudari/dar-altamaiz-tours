import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/AppHeader";
import { HotelPortalIcon } from "@/components/HotelPortalIcon";
import { InfoModal } from "@/components/InfoModal";
import type { HomeLang } from "@/components/LuxuryHome";
import { dateIsValid, type FlightSearchValues } from "@/lib/flightSearch";

// These are the existing flight-search screen colours; no shared theme or button colour changes.
const P = {
  navy: "#002B7F", canvas: "#F4F6F9", card: "#FFFFFF", ink: "#18263D",
  muted: "#697586", border: "#D8DEE8", paleBlue: "#EAF1FC",
};

type Flight = {
  id: string; airline: string; airlineCode: string; departure: string; arrival: string;
  depDate: string; retDate?: string; duration: string; stops: number;
  price: string; currency: string; airlineLogo?: string;
  flightNumbers?: string; returnDeparture?: string; returnArrival?: string;
  returnDuration?: string; returnStops?: number; returnFlightNumbers?: string;
  outboundSegments?: FlightSegment[]; returnSegments?: FlightSegment[];
  cabinBagIncluded?: boolean; checkedBagIncluded?: boolean;
  cabinBaggage?: FareBagAllowance; checkedBaggage?: FareBagAllowance;
};
type FareBagAllowance = { pieces?: number; weight?: string };
type FlightSegment = {
  origin: string; destination: string; departure: string; arrival: string;
  duration: string; flightNumber: string; layoverMinutes?: number;
};
type Passenger = {
  firstName: string; lastName: string; passportType: string; passportNumber: string;
  birthDate: string; passportExpiry: string;
};
const blankPassenger = (): Passenger => ({
  firstName: "", lastName: "", passportType: "", passportNumber: "", birthDate: "", passportExpiry: "",
});
const PASSPORT_TYPES = [
  { value: "Ordinary", ar: "عادي" },
  { value: "Official/Service", ar: "رسمي / خدمة" },
  { value: "Diplomatic", ar: "دبلوماسي" },
  { value: "Emergency", ar: "طوارئ" },
  { value: "Temporary", ar: "مؤقت" },
] as const;

export function flightWhatsAppMessage(flight: Flight, values: FlightSearchValues, passengers: Passenger[]): string {
  const legs = values.tripType === "roundtrip" ? `Round-trip; return ${values.returnDate}` : "One-way";
  const route = `${values.origin?.city ?? values.origin?.iata} (${values.origin?.iata}) → ${values.destination?.city ?? values.destination?.iata} (${values.destination?.iata})`;
  return [
    "Hello, I would like to arrange payment for this flight request. Please confirm availability and final fare before booking.",
    "",
    `Route: ${route}`,
    `Trip: ${legs}`,
    `Departure date requested: ${values.departure}`,
    `Airline: ${flight.airline}${flight.airlineCode ? ` (${flight.airlineCode})` : ""}`,
    ...(flight.flightNumbers ? [`Outbound flight number(s): ${flight.flightNumbers}`] : []),
    `Outbound: ${flight.departure || "Time not supplied"} → ${flight.arrival || "Time not supplied"}`,
    `Duration: ${flight.duration || "Not supplied"}; stops: ${flight.stops}`,
    ...(flight.returnDeparture || flight.returnArrival ? [
      `Return: ${flight.returnDeparture || "Time not supplied"} → ${flight.returnArrival || "Time not supplied"}`,
      `Return duration: ${flight.returnDuration || "Not supplied"}; stops: ${flight.returnStops ?? "Not supplied"}`,
      ...(flight.returnFlightNumbers ? [`Return flight number(s): ${flight.returnFlightNumbers}`] : []),
    ] : []),
    `Displayed fare: ${flight.currency} ${flight.price}`,
    `Cabin: ${values.cabinClass}`,
    `Travellers: ${values.adults} adult(s), ${values.children} child(ren), ${values.infants} infant(s)`,
    `Flight reference: ${flight.id}`,
    ...(values.specialRequests?.trim() ? [`Special requests: ${values.specialRequests.trim()}`] : []),
    "",
    ...passengers.flatMap((p, index) => [
      `Passenger ${index + 1} (${index < values.adults ? "Adult" : index < values.adults + values.children ? "Child" : "Infant"}):`,
      `First name: ${p.firstName.trim()}`,
      `Last name: ${p.lastName.trim()}`,
      `Passport type: ${p.passportType.trim()}`,
      `Passport number: ${p.passportNumber.trim()}`,
      `Date of birth: ${p.birthDate}`,
      `Passport expiry: ${p.passportExpiry}`,
      "",
    ]),
  ].join("\n").trim();
}

export function validateFlightPassengers(passengers: Passenger[], departure: string): number {
  return passengers.findIndex((p) =>
    !p.firstName.trim() || !p.lastName.trim() || !p.passportType.trim() || !p.passportNumber.trim()
    || !dateIsValid(p.birthDate) || p.birthDate >= departure
    || !dateIsValid(p.passportExpiry) || p.passportExpiry < departure
  );
}

function dateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join("-");
}

function segmentTime(iso: string): string {
  return iso.includes("T") ? iso.replace("T", " ").slice(0, 16) : iso || "—";
}

function layoverDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function bagInclusion(included: boolean | undefined, bag: FareBagAllowance | undefined, ar: boolean): string {
  if (included === false) return ar ? "غير مشمولة" : "Not included";
  if (included === true || baggageDetails(bag, ar)) return ar ? "مشمولة" : "Included";
  return ar ? "غير محدد" : "Not specified";
}

export function baggageDetails(bag: FareBagAllowance | undefined, ar: boolean): string | null {
  const pieces = bag?.pieces;
  const weight = bag?.weight;
  const parts: string[] = [];
  if (typeof pieces === "number" && Number.isSafeInteger(pieces) && pieces > 0)
    parts.push(ar ? `${pieces} ${pieces === 1 ? "حقيبة" : "حقائب"}` : `${pieces} ${pieces === 1 ? "bag" : "bags"}`);
  if (typeof weight === "string" && /^\d+(?:\.\d+)?\s*(?:kg|lb|lbs)$/i.test(weight.trim()) && Number.parseFloat(weight) > 0)
    parts.push(weight.trim());
  return parts.length ? parts.join(" · ") : null;
}

export function FlightApiResultsScreen({
  url, values, lang, onBack, onClose,
}: {
  url: string;
  values: FlightSearchValues | null;
  lang: HomeLang;
  onBack: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const ar = lang === "ar";
  const [flights, setFlights] = useState<Flight[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [selected, setSelected] = useState<Flight | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>(() =>
    Array.from({ length: Math.max(1, (values?.adults ?? 1) + (values?.children ?? 0) + (values?.infants ?? 0)) }, blankPassenger));
  const [formError, setFormError] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [detailsFlight, setDetailsFlight] = useState<Flight | null>(null);
  const [openPassportTypeFor, setOpenPassportTypeFor] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Flight search returned ${response.status}`);
        const data = await response.json() as { configured?: boolean; flights?: Flight[]; quota_exceeded?: boolean };
        if (!data.configured || data.quota_exceeded || !Array.isArray(data.flights)) throw new Error("Flight search unavailable");
        if (controller.signal.aborted) return;
        const valid = data.flights.filter((flight) =>
          typeof flight.id === "string" && typeof flight.airline === "string"
          && Number.isFinite(Number(flight.price)) && Number(flight.price) > 0
          && flight.currency === "KWD");
        setFlights(valid);
        setStatus(valid.length ? "ready" : "empty");
      })
      .catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [url]);

  if (!values) return null;
  const update = (index: number, key: keyof Passenger, text: string) => {
    setPassengers((current) => current.map((p, i) =>
      i === index ? { ...p, [key]: key === "birthDate" || key === "passportExpiry" ? dateInput(text) : text } : p));
    setFormError("");
  };
  const openWhatsApp = async () => {
    if (!selected) return;
    const invalid = validateFlightPassengers(passengers, values.departure);
    if (invalid !== -1) {
      setFormError(ar
        ? `راجع بيانات المسافر ${invalid + 1}. أدخل جميع الحقول وتواريخ صحيحة بصيغة YYYY-MM-DD، مع جواز صالح عند المغادرة.`
        : `Check passenger ${invalid + 1}: complete every field, use valid YYYY-MM-DD dates, and ensure the passport is valid on departure.`);
      return;
    }
    const message = flightWhatsAppMessage(selected, values, passengers);
    try {
      await Linking.openURL(`https://wa.me/96590087797?text=${encodeURIComponent(message)}`);
    } catch {
      setFormError(ar ? "تعذر فتح واتساب. حاول مرة أخرى." : "Could not open WhatsApp. Please try again.");
    }
  };
  const field = (index: number, key: keyof Passenger, titleEn: string, titleAr: string, date = false) => (
    <View style={styles.field} key={key}>
      <Text style={[styles.label, ar && styles.rtl]}>{ar ? titleAr : titleEn}</Text>
      <TextInput
        value={passengers[index][key]}
        onChangeText={(text) => update(index, key, text)}
        placeholder={date ? "YYYY-MM-DD" : ar ? titleAr : titleEn}
        placeholderTextColor={P.muted}
        autoCapitalize={date || key === "passportNumber" ? "characters" : "words"}
        keyboardType={date ? "number-pad" : "default"}
        maxLength={date ? 10 : 100}
        style={[styles.input, ar && styles.rtl]}
        accessibilityLabel={ar ? titleAr : titleEn}
        testID={`passenger-${index}-${key}`}
      />
    </View>
  );
  const passportTypeField = (index: number) => (
    <View style={styles.field}>
      <Text style={[styles.label, ar && styles.rtl]}>{ar ? "نوع الجواز" : "Passport type"}</Text>
      <Pressable
        onPress={() => setOpenPassportTypeFor((current) => current === index ? null : index)}
        style={[styles.input, styles.passportSelect, ar && styles.reverse]}
        accessibilityRole="button"
        accessibilityState={{ expanded: openPassportTypeFor === index }}
        accessibilityLabel={ar ? "نوع الجواز" : "Passport type"}
        testID={`passenger-${index}-passportType`}
      >
        <Text style={[styles.passportValue, !passengers[index].passportType && styles.passportPlaceholder, ar && styles.rtl]}>
          {passengers[index].passportType
            ? (ar ? PASSPORT_TYPES.find((type) => type.value === passengers[index].passportType)?.ar : passengers[index].passportType)
            : ar ? "اختر نوع الجواز" : "Select passport type"}
        </Text>
        <HotelPortalIcon name={openPassportTypeFor === index ? "chevron-up" : "chevron-down"} size={18} color={P.muted} />
      </Pressable>
      {openPassportTypeFor === index && (
        <View style={styles.passportOptions}>
          {PASSPORT_TYPES.map((type) => (
            <Pressable
              key={type.value}
              onPress={() => { update(index, "passportType", type.value); setOpenPassportTypeFor(null); }}
              style={[styles.passportOption, ar && styles.reverse]}
              accessibilityRole="button"
              testID={`passenger-${index}-passport-option-${type.value}`}
            >
              <Text style={[styles.passportValue, ar && styles.rtl]}>{ar ? type.ar : type.value}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
  const detailsLeg = (title: string, segments: FlightSegment[] | undefined, stops: number | undefined) => (
    <View style={styles.detailsSection}>
      <Text style={[styles.detailsHeading, ar && styles.rtl]}>{title}</Text>
      {segments?.length ? segments.map((segment, index) => (
        <View key={`${index}-${segment.flightNumber}`} style={styles.segment}>
          <Text style={[styles.detailsText, ar && styles.rtl]}>
            {segment.origin || "—"} → {segment.destination || "—"}
            {segment.flightNumber ? ` · ${segment.flightNumber}` : ""}
            {segment.duration ? ` · ${segment.duration}` : ""}
          </Text>
          <Text style={[styles.meta, ar && styles.rtl]}>{segmentTime(segment.departure)} → {segmentTime(segment.arrival)}</Text>
          {index < segments.length - 1 && (
            <Text style={[styles.layover, ar && styles.rtl]}>
              {ar ? "الترانزيت في" : "Transit at"} {segment.destination || "—"} · {segment.layoverMinutes != null
                ? layoverDuration(segment.layoverMinutes)
                : ar ? "مدة الترانزيت غير متوفرة" : "Transit time unavailable"}
            </Text>
          )}
        </View>
      )) : <Text style={[styles.meta, ar && styles.rtl]}>{stops === 0
        ? ar ? "رحلة مباشرة" : "Direct flight"
        : ar ? `${stops ?? "—"} توقف · تفاصيل الترانزيت غير متوفرة` : `${stops ?? "—"} stop(s) · Transit details unavailable`}</Text>}
    </View>
  );
  return (
    <View style={styles.root}>
      <AppHeader onBack={onBack} canGoBack onInfo={() => setShowInfo(true)} />
      <View style={[styles.header, ar && styles.reverse]}>
        <Pressable onPress={selected ? () => { setSelected(null); setFormError(""); } : onBack} style={styles.headerButton} testID="flight-results-back">
          <HotelPortalIcon name={ar ? "arrow-forward" : "arrow-back"} size={19} color={P.card} />
          <Text style={styles.headerText}>{ar ? "رجوع" : "Back"}</Text>
        </Pressable>
        <View pointerEvents="none" style={styles.logoCenter}>
          <View style={styles.logoCrop}>
            <Image source={require("../assets/images/dt-tours-logo-transparent.png")} style={styles.logo} resizeMode="contain" tintColor={P.card} accessibilityLabel="Dar AlTamaiz Tours" />
          </View>
        </View>
        <Pressable onPress={onClose} style={styles.headerButton} testID="flight-results-home">
          <HotelPortalIcon name="close" size={18} color={P.card} />
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, ar && styles.rtl]}>{selected ? (ar ? "بيانات المسافرين" : "Passenger details") : (ar ? "الرحلات المتاحة" : "Available flights")}</Text>
        <Text style={[styles.subtitle, ar && styles.rtl]}>
          {values.origin?.iata} → {values.destination?.iata} · {values.departure}
          {values.tripType === "roundtrip" ? ` → ${values.returnDate}` : ""} · {values.cabinClass}
        </Text>
        {status === "loading" && <View style={styles.center}><ActivityIndicator color={P.navy} /><Text style={styles.note}>{ar ? "جارٍ البحث عن الرحلات…" : "Searching for flights…"}</Text></View>}
        {(status === "error" || status === "empty") && (
          <View style={styles.center}>
            <Text style={styles.note}>{status === "empty"
              ? ar ? "لم نجد رحلات متاحة لهذا البحث. عدّل بحثك وحاول مجدداً." : "No flights found for this search. Edit your search and try again."
              : ar ? "تعذر تحميل الرحلات الآن. عدّل بحثك وحاول مجدداً." : "Flights could not be loaded. Edit your search and try again."}</Text>
            <Pressable onPress={onBack} style={styles.button}><Text style={styles.buttonText}>{ar ? "تعديل البحث" : "Edit search"}</Text></Pressable>
          </View>
        )}
        {status === "ready" && !selected && (
          <>
            <Text style={[styles.note, ar && styles.rtl]}>{ar ? "الأسعار والتوفر قابلة للتغيير حتى يؤكدها فريقنا." : "Fares and availability are subject to confirmation by our team."}</Text>
            {flights.map((flight, index) => (
              <View style={styles.card} key={`${flight.id}-${index}`} testID={`flight-result-${index}`}>
                <View style={[styles.row, ar && styles.reverse]}>
                  <Pressable onPress={() => setDetailsFlight(flight)} style={styles.airlineGroup} accessibilityRole="button" accessibilityLabel={`${flight.airline} · ${ar ? "تفاصيل الرحلة" : "Flight details"}`}>
                    {!!flight.airlineLogo && <Image source={{ uri: flight.airlineLogo }} style={styles.airlineLogo} resizeMode="contain" accessibilityLabel={`${flight.airline} logo`} />}
                    <Text style={styles.airline} numberOfLines={2}>{flight.airline}</Text>
                  </Pressable>
                  <Text style={styles.price}>{flight.currency} {flight.price}</Text>
                </View>
                <Text style={[styles.route, ar && styles.rtl]}>{values.origin?.iata}  {flight.departure}  →  {values.destination?.iata}  {flight.arrival}</Text>
                <Text style={[styles.meta, ar && styles.rtl]}>{flight.depDate} · {flight.duration || "—"} · {flight.stops === 0 ? (ar ? "مباشر" : "Direct") : `${flight.stops} ${ar ? "توقف" : "stop(s)"}`}</Text>
                {!!flight.flightNumbers && <Text style={[styles.meta, ar && styles.rtl]}>{ar ? "رقم الرحلة" : "Flight"}: {flight.flightNumbers}</Text>}
                {values.tripType === "roundtrip" && <Text style={[styles.meta, ar && styles.rtl]}>{ar ? "العودة المطلوبة" : "Requested return"}: {values.returnDate}</Text>}
                {values.tripType === "roundtrip" && (flight.returnDeparture || flight.returnArrival) && (
                  <Text style={[styles.route, ar && styles.rtl]}>{values.destination?.iata} {flight.returnDeparture} → {values.origin?.iata} {flight.returnArrival}{flight.returnFlightNumbers ? ` · ${flight.returnFlightNumbers}` : ""}</Text>
                )}
                <Pressable onPress={() => setDetailsFlight(flight)} style={styles.detailsLink} accessibilityRole="button" testID={`flight-details-${index}`}>
                  <Text style={styles.detailsLinkText}>{ar ? "تفاصيل الرحلة والأمتعة ›" : "Flight & baggage details ›"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setSelected(flight); setFormError(""); }}
                  style={styles.button}
                  testID={`flight-select-${index}`}
                ><Text style={styles.buttonText}>{ar ? "اختيار الرحلة" : "Select flight"}</Text></Pressable>
              </View>
            ))}
          </>
        )}
        {status === "ready" && selected && (
          <>
            <View style={styles.card}>
              <Text style={styles.airline}>{selected.airline} · {selected.currency} {selected.price}</Text>
              <Text style={styles.meta}>{values.origin?.iata} {selected.departure} → {values.destination?.iata} {selected.arrival} · {values.departure}</Text>
              {values.tripType === "roundtrip" && <Text style={styles.meta}>{ar ? "العودة" : "Return"}: {values.returnDate}</Text>}
              {!!values.specialRequests?.trim() && (
                <Text style={[styles.meta, ar && styles.rtl]}>
                  {ar ? "طلبات خاصة" : "Special requests"}: {values.specialRequests.trim()}
                </Text>
              )}
            </View>
            {passengers.map((p, index) => (
              <View style={styles.card} key={index}>
                <Text style={[styles.passengerTitle, ar && styles.rtl]}>
                  {ar ? `المسافر ${index + 1}` : `Passenger ${index + 1}`} · {index < values.adults ? (ar ? "بالغ" : "Adult") : index < values.adults + values.children ? (ar ? "طفل" : "Child") : (ar ? "رضيع" : "Infant")}
                </Text>
                {field(index, "firstName", "First name (as on passport)", "الاسم الأول كما في الجواز")}
                {field(index, "lastName", "Last name (as on passport)", "اسم العائلة كما في الجواز")}
                {passportTypeField(index)}
                {field(index, "passportNumber", "Passport number", "رقم الجواز")}
                {field(index, "birthDate", "Date of birth", "تاريخ الميلاد", true)}
                {field(index, "passportExpiry", "Passport expiry date", "تاريخ انتهاء الجواز", true)}
              </View>
            ))}
            <Text style={[styles.note, ar && styles.rtl]}>{ar
              ? "سيُفتح واتساب برسالة تتضمن تفاصيل الرحلة وبيانات جوازات المسافرين. لن يتم الدفع أو تأكيد الحجز تلقائياً."
              : "WhatsApp will open with the flight and passenger passport details. Payment and booking are not automatic."}</Text>
            {!!formError && <Text style={styles.error} testID="flight-passenger-error">{formError}</Text>}
            <Pressable onPress={openWhatsApp} style={styles.button} testID="flight-whatsapp-payment">
              <Text style={styles.buttonText}>{ar ? "الدفع عبر واتساب" : "WhatsApp payment"}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      <Modal visible={!!detailsFlight} transparent animationType="fade" onRequestClose={() => setDetailsFlight(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetailsFlight(null)} accessibilityLabel={ar ? "إغلاق التفاصيل" : "Close flight details"} />
          {detailsFlight && (
            <View style={styles.detailsPanel} testID="flight-details-popup">
              <View style={[styles.row, ar && styles.reverse]}>
                <Text style={styles.detailsTitle}>{ar ? "تفاصيل الرحلة" : "Flight details"}</Text>
                <Pressable onPress={() => setDetailsFlight(null)} style={styles.closeDetails} accessibilityRole="button" accessibilityLabel={ar ? "إغلاق" : "Close"}>
                  <HotelPortalIcon name="close" size={20} color={P.ink} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[styles.detailsAirline, ar && styles.reverse]}>
                  {!!detailsFlight.airlineLogo && <Image source={{ uri: detailsFlight.airlineLogo }} style={styles.airlineLogo} resizeMode="contain" />}
                  <Text style={styles.airline}>{detailsFlight.airline}</Text>
                </View>
                <Text style={[styles.meta, ar && styles.rtl]}>{detailsFlight.currency} {detailsFlight.price} · {values.cabinClass}</Text>
                {detailsLeg(ar ? "الذهاب" : "Outbound", detailsFlight.outboundSegments, detailsFlight.stops)}
                {values.tripType === "roundtrip" && detailsLeg(ar ? "العودة" : "Return", detailsFlight.returnSegments, detailsFlight.returnStops)}
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsHeading, ar && styles.rtl]}>{ar ? "الأمتعة" : "Baggage"}</Text>
                  <Text style={[styles.detailsText, ar && styles.rtl]}>
                    {ar ? "حقيبة المقصورة" : "Cabin bag"}: {bagInclusion(detailsFlight.cabinBagIncluded, detailsFlight.cabinBaggage, ar)}
                    {detailsFlight.cabinBagIncluded !== false && baggageDetails(detailsFlight.cabinBaggage, ar)
                      ? ` · ${baggageDetails(detailsFlight.cabinBaggage, ar)}` : ""}
                  </Text>
                  <Text style={[styles.detailsText, ar && styles.rtl]}>
                    {ar ? "الأمتعة المسجلة" : "Checked bag"}: {bagInclusion(detailsFlight.checkedBagIncluded, detailsFlight.checkedBaggage, ar)}
                    {detailsFlight.checkedBagIncluded !== false && baggageDetails(detailsFlight.checkedBaggage, ar)
                      ? ` · ${baggageDetails(detailsFlight.checkedBaggage, ar)}` : ""}
                  </Text>
                  {((detailsFlight.cabinBagIncluded !== false && (!detailsFlight.cabinBaggage?.pieces || !detailsFlight.cabinBaggage?.weight))
                    || (detailsFlight.checkedBagIncluded !== false && (!detailsFlight.checkedBaggage?.pieces || !detailsFlight.checkedBaggage?.weight))) && (
                    <Text style={[styles.meta, ar && styles.rtl]}>{ar
                      ? "قد لا تتوفر تفاصيل الوزن أو العدد لبعض الأمتعة في بيانات السعر. يرجى تأكيد التفاصيل الناقصة مع فريقنا قبل الحجز."
                      : "Some bag weights or counts are not provided for this fare. Confirm missing details with our team before booking."}</Text>
                  )}
                </View>
                <Text style={[styles.meta, ar && styles.rtl]}>{ar
                  ? "الأسعار والتفاصيل قابلة للتغيير حتى يتم تأكيد الحجز."
                  : "Fares and details are subject to confirmation before booking."}</Text>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
      <InfoModal visible={showInfo} onClose={() => setShowInfo(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.canvas },
  header: { minHeight: 58, backgroundColor: P.navy, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8 },
  reverse: { flexDirection: "row-reverse" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
  headerButton: { minHeight: 35, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 7 },
  headerText: { color: P.card, fontSize: 12, fontWeight: "800" },
  logoCenter: { position: "absolute", left: 0, right: 0, bottom: 7, alignItems: "center" },
  logoCrop: { width: 168, height: 36, overflow: "hidden" },
  logo: { width: 168, height: 168, position: "absolute", top: -69 },
  scroll: { flex: 1 },
  title: { fontSize: 22, fontWeight: "900", color: P.navy, marginBottom: 4 },
  subtitle: { fontSize: 13, color: P.muted, marginBottom: 16 },
  center: { alignItems: "center", paddingVertical: 48, gap: 16 },
  note: { fontSize: 13, color: P.muted, lineHeight: 20, marginBottom: 14 },
  card: { backgroundColor: P.card, borderWidth: 1, borderColor: P.border, borderRadius: 14, padding: 15, marginBottom: 12, gap: 9 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  airline: { color: P.ink, fontWeight: "900", fontSize: 16, flexShrink: 1 },
  airlineGroup: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  airlineLogo: { width: 30, height: 30 },
  price: { color: P.navy, fontWeight: "900", fontSize: 17 },
  route: { color: P.ink, fontWeight: "800", fontSize: 15, marginTop: 5 },
  meta: { color: P.muted, fontSize: 12, lineHeight: 18 },
  detailsLink: { alignSelf: "flex-start", minHeight: 28, justifyContent: "center" },
  detailsLinkText: { color: P.navy, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 20, backgroundColor: "rgba(0,0,0,0.48)" },
  detailsPanel: { backgroundColor: P.card, borderRadius: 14, padding: 18, maxHeight: "80%", gap: 12 },
  detailsTitle: { color: P.navy, fontSize: 19, fontWeight: "900" },
  closeDetails: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  detailsAirline: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 },
  detailsSection: { borderTopWidth: 1, borderTopColor: P.border, paddingTop: 12, marginTop: 12, gap: 7 },
  detailsHeading: { color: P.navy, fontSize: 15, fontWeight: "800" },
  detailsText: { color: P.ink, fontSize: 13, lineHeight: 20 },
  segment: { gap: 3, paddingVertical: 3 },
  layover: { color: P.navy, backgroundColor: P.paleBlue, fontSize: 12, padding: 8, borderRadius: 6, marginVertical: 4 },
  button: { backgroundColor: P.navy, borderRadius: 8, paddingHorizontal: 16, minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 7 },
  buttonText: { color: P.card, fontWeight: "900", fontSize: 14 },
  passengerTitle: { color: P.navy, fontWeight: "900", fontSize: 16, marginBottom: 5 },
  field: { gap: 5 },
  label: { color: P.ink, fontSize: 12, fontWeight: "700" },
  input: { minHeight: 47, borderWidth: 1, borderColor: P.border, borderRadius: 8, paddingHorizontal: 12, color: P.ink, backgroundColor: P.card, fontSize: 15 },
  passportSelect: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  passportValue: { color: P.ink, fontSize: 15 },
  passportPlaceholder: { color: P.muted },
  passportOptions: { borderWidth: 1, borderColor: P.border, borderRadius: 8, overflow: "hidden", backgroundColor: P.card },
  passportOption: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  error: { color: "#B91C1C", fontSize: 13, lineHeight: 19, marginBottom: 8 },
});