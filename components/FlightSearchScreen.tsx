import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HotelPortalIcon } from "@/components/HotelPortalIcon";
import { AppHeader } from "@/components/AppHeader";
import { InfoModal } from "@/components/InfoModal";
import {
  buildFlightRedirectUrl,
  SAMPLE_FLIGHT_PREVIEW_URL,
  type FlightAirport,
  type FlightLeg,
  type FlightSearchValues,
  type FlightTripType,
  validateFlightSearch,
} from "@/lib/flightSearch";
import type { HomeLang } from "@/components/LuxuryHome";

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ??
  "https://tours-dar-tamaiz--engalialfoudari.replit.app/api"
).replace(/\/$/, "");

const P = {
  navy: "#002B7F",
  blue: "#003D9C",
  gold: "#FFB800",
  canvas: "#F4F6F9",
  card: "#FFFFFF",
  ink: "#18263D",
  muted: "#697586",
  border: "#D8DEE8",
  paleBlue: "#EAF1FC",
  error: "#B42318",
};

const CABINS: FlightSearchValues["cabinClass"][] = ["Economy", "Premium Economy", "Business", "First"];
const CABIN_LABELS: Record<HomeLang, Record<FlightSearchValues["cabinClass"], string>> = {
  en: {
    Economy: "Economy",
    "Premium Economy": "Premium Economy",
    Business: "Business",
    First: "First",
  },
  ar: {
    Economy: "السياحية",
    "Premium Economy": "السياحية الممتازة",
    Business: "رجال الأعمال",
    First: "الأولى",
  },
};

const COPY = {
  en: {
    title: "Flight search",
    subtitle: "Find the best fare for your next journey",
    trusted: "Trusted booking",
    support: "Personal support",
    back: "Home",
    oneWay: "One-way",
    roundTrip: "Round-trip",
    multiCity: "Multi-city",
    from: "From",
    to: "To",
    originHint: "Origin city or airport",
    destinationHint: "Destination city or airport",
    departure: "Departure",
    return: "Return",
    dateHint: "YYYY-MM-DD",
    passengers: "Passengers",
    adults: "Adults",
    children: "Children",
    infants: "Infants",
    passenger: "passenger",
    passengersPlural: "passengers",
    cabin: "Cabin class",
    search: "Search flights",
    searching: "Opening secure flight search…",
    selectAirport: "Select an airport from the list.",
    sameAirport: "Choose two different airports.",
    invalidDeparture: "Choose a valid departure date.",
    invalidReturn: "Return must be after departure.",
    incompleteLeg: "Complete every flight leg.",
    invalidLegOrder: "Each departure must be on or after the previous flight.",
    invalidPassengers: "Choose at least one passenger.",
    addLeg: "Add flight",
    removeLeg: "Remove",
    flight: "Flight",
    moveEarlier: "Move flight earlier",
    moveLater: "Move flight later",
    previewResults: "Preview sample results",
  },
  ar: {
    title: "البحث عن رحلات",
    subtitle: "اعثر على أفضل سعر لرحلتك القادمة",
    trusted: "حجز موثوق",
    support: "دعم شخصي",
    back: "الرئيسية",
    oneWay: "ذهاب فقط",
    roundTrip: "ذهاب وعودة",
    multiCity: "متعدد المدن",
    from: "من",
    to: "إلى",
    originHint: "مدينة أو مطار المغادرة",
    destinationHint: "مدينة أو مطار الوصول",
    departure: "المغادرة",
    return: "العودة",
    dateHint: "YYYY-MM-DD",
    passengers: "المسافرون",
    adults: "البالغون",
    children: "الأطفال",
    infants: "الرضّع",
    passenger: "مسافر",
    passengersPlural: "مسافرون",
    cabin: "درجة السفر",
    search: "ابحث عن الرحلات",
    searching: "جارٍ فتح بحث الرحلات الآمن…",
    selectAirport: "اختر مطاراً من القائمة.",
    sameAirport: "اختر مطارين مختلفين.",
    invalidDeparture: "اختر تاريخ مغادرة صالحاً.",
    invalidReturn: "يجب أن يكون تاريخ العودة بعد المغادرة.",
    incompleteLeg: "أكمل بيانات كل رحلة.",
    invalidLegOrder: "يجب أن يكون موعد كل رحلة في أو بعد موعد الرحلة السابقة.",
    invalidPassengers: "اختر مسافراً واحداً على الأقل.",
    addLeg: "أضف رحلة",
    removeLeg: "حذف",
    flight: "رحلة",
    moveEarlier: "نقل الرحلة للأعلى",
    moveLater: "نقل الرحلة للأسفل",
    previewResults: "معاينة نتائج تجريبية",
  },
} as const;

export function isoAfter(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validationMessage(code: string | null, lang: HomeLang) {
  const s = COPY[lang];
  if (code === "origin" || code === "destination") return s.selectAirport;
  if (code === "same-airport") return s.sameAirport;
  if (code === "departure") return s.invalidDeparture;
  if (code === "return") return s.invalidReturn;
  if (code?.startsWith("leg-") || code === "legs") {
    return code === "leg-order" ? s.invalidLegOrder : s.incompleteLeg;
  }
  if (code === "passengers") return s.invalidPassengers;
  return "";
}

function localDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function dateIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDateDays(iso: string, days: number) {
  const date = localDate(iso);
  date.setDate(date.getDate() + days);
  return dateIso(date);
}

const ENGLISH_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ENGLISH_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const ARABIC_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function dateLabel(iso: string, lang: HomeLang) {
  const date = localDate(iso);
  const month = lang === "ar" ? ARABIC_MONTHS[date.getMonth()] : ENGLISH_MONTHS_SHORT[date.getMonth()];
  return `${ENGLISH_WEEKDAYS[date.getDay()]} ${date.getDate()} ${month}`;
}

function AirportSuggestions({
  suggestions,
  onChoose,
  isRtl,
}: {
  suggestions: FlightAirport[];
  onChoose: (airport: FlightAirport) => void;
  isRtl: boolean;
}) {
  if (!suggestions.length) return null;
  return (
    <View style={styles.suggestionBox} testID="flight-airport-suggestions">
      {suggestions.map((airport) => (
        <Pressable key={`${airport.iata}-${airport.name}`} onPress={() => onChoose(airport)} style={({ pressed }) => [styles.suggestion, isRtl && styles.rowReverse, pressed && styles.pressed]}>
          <View style={[styles.suggestionIcon, isRtl && styles.suggestionIconRtl]}><HotelPortalIcon name="airplane" size={17} color={P.navy} /></View>
          <View style={styles.suggestionCopy}>
            <Text style={[styles.suggestionTitle, isRtl && styles.rtlText]}>{airport.city} <Text style={styles.suggestionIata}>{airport.iata}</Text></Text>
            <Text style={[styles.suggestionMeta, isRtl && styles.rtlText]} numberOfLines={1}>{airport.name}, {airport.country}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function FlightDatePicker({
  visible,
  lang,
  tripType,
  departure,
  returnDate,
  initialMode,
  onClose,
  onChange,
}: {
  visible: boolean;
  lang: HomeLang;
  tripType: FlightTripType;
  departure: string;
  returnDate: string;
  initialMode: "departure" | "return";
  onClose: () => void;
  onChange: (departure: string, returnDate: string) => void;
}) {
  const isRtl = lang === "ar";
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"departure" | "return">(initialMode);
  const [month, setMonth] = useState(() => localDate(departure));
  const today = isoAfter(0);

  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setMonth(localDate(initialMode === "return" ? returnDate || departure : departure));
  }, [visible, initialMode]);

  if (!visible) return null;

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstDay + totalDays) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= totalDays ? dateIso(new Date(year, monthIndex, day, 12)) : "";
  });
  const weeks = Array.from({ length: cells.length / 7 }, (_, weekIndex) => (
    cells.slice(weekIndex * 7, weekIndex * 7 + 7)
  ));
  const weekdays = ENGLISH_WEEKDAYS;
  const monthTitle = lang === "ar"
    ? `${ARABIC_MONTHS[monthIndex]} ${year}`
    : month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const monthStart = new Date(year, monthIndex, 1);
  const todayMonth = localDate(today);
  const canGoBack = monthStart > new Date(todayMonth.getFullYear(), todayMonth.getMonth(), 1);

  const chooseDate = (value: string) => {
    if (!value || value < today) return;
    if (tripType === "oneway") {
      onChange(value, returnDate);
      onClose();
      return;
    }
    if (mode === "departure") {
      onChange(value, returnDate > value ? returnDate : addDateDays(value, 1));
      setMode("return");
      return;
    }
    if (value <= departure) {
      return;
    }
    onChange(departure, value);
    setMode("return");
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.dateModalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.dateSheet}>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.dateSheetContent, { paddingBottom: Math.max(30, insets.bottom + 20) }]}
          >
            <View style={styles.sheetHandle} />
            <View style={[styles.dateSheetHeader, isRtl && styles.rowReverse]}>
              <Text style={styles.dateSheetTitle}>{isRtl ? "اختَر تواريخ الرحلة" : "Select flight dates"}</Text>
              <Pressable onPress={onClose} style={styles.dateClose} accessibilityLabel={isRtl ? "إغلاق التقويم" : "Close date picker"}>
                <HotelPortalIcon name="close" size={18} color={P.ink} />
              </Pressable>
            </View>
            <View style={[styles.datePhaseRow, isRtl && styles.rowReverse]}>
              <Pressable onPress={() => setMode("departure")} style={[styles.datePhase, mode === "departure" && styles.datePhaseActive]}>
                <Text style={[styles.datePhaseLabel, mode === "departure" && styles.datePhaseLabelActive]}>{isRtl ? "المغادرة" : "Departure"}</Text>
                <Text style={[styles.datePhaseValue, mode === "departure" && styles.datePhaseValueActive]}>{dateLabel(departure, lang)}</Text>
              </Pressable>
              {tripType === "roundtrip" && <Pressable onPress={() => setMode("return")} style={[styles.datePhase, mode === "return" && styles.datePhaseActive]}>
                <Text style={[styles.datePhaseLabel, mode === "return" && styles.datePhaseLabelActive]}>{isRtl ? "العودة" : "Return"}</Text>
                <Text style={[styles.datePhaseValue, mode === "return" && styles.datePhaseValueActive]}>{returnDate ? dateLabel(returnDate, lang) : "—"}</Text>
              </Pressable>}
            </View>
            <View style={[styles.calendarMonthHeader, isRtl && styles.rowReverse]}>
              <Pressable disabled={!canGoBack} onPress={() => setMonth(new Date(year, monthIndex - 1, 1))} style={[styles.monthArrow, !canGoBack && styles.faded]} accessibilityLabel={isRtl ? "الشهر السابق" : "Previous month"}>
                <HotelPortalIcon name="chevron-back" size={20} color={canGoBack ? P.ink : P.border} />
              </Pressable>
              <Text style={styles.monthTitle}>{monthTitle}</Text>
              <Pressable onPress={() => setMonth(new Date(year, monthIndex + 1, 1))} style={styles.monthArrow} accessibilityLabel={isRtl ? "الشهر التالي" : "Next month"}>
                <HotelPortalIcon name="chevron-forward" size={20} color={P.ink} />
              </Pressable>
            </View>
            <View style={styles.weekdayRow} testID="flight-calendar-weekdays">
              {weekdays.map((day, index) => (
                <View
                  key={`${day}-${index}`}
                  style={[styles.calendarColumnSlot, { left: `${index * (100 / 7)}%` }]}
                  testID={`flight-calendar-weekday-${index}`}
                >
                  <Text style={styles.weekday}>{day}</Text>
                </View>
              ))}
            </View>
            <View style={styles.calendarGrid} testID="flight-calendar-grid">
              {weeks.map((week, weekIndex) => (
                <View
                  key={`week-${weekIndex}`}
                  style={styles.calendarWeek}
                  testID={`flight-calendar-week-${weekIndex}`}
                >
                  {week.map((value, weekdayIndex) => {
                    const index = weekIndex * 7 + weekdayIndex;
                    const disabled = !value || value < today || (mode === "return" && value <= departure);
                    const isDeparture = value === departure;
                    const isReturn = value === returnDate;
                    const inRange = !!value && !!returnDate && value > departure && value < returnDate;
                    return (
                      <View
                        key={`${value}-${index}`}
                        style={[styles.calendarColumnSlot, { left: `${weekdayIndex * (100 / 7)}%` }]}
                        testID={`flight-calendar-cell-${index}`}
                      >
                        <Pressable
                          disabled={disabled}
                          onPress={() => chooseDate(value)}
                          style={[
                            styles.calendarCell,
                            inRange && styles.calendarCellRange,
                            isDeparture && !!returnDate && styles.calendarCellRangeStart,
                            isReturn && styles.calendarCellRangeEnd,
                          ]}
                        >
                          {value ? (
                            <View style={[styles.calendarDay, (isDeparture || isReturn) && styles.calendarDaySelected, disabled && styles.calendarDayDisabled]}>
                              <Text
                                style={[styles.calendarDayText, (isDeparture || isReturn) && styles.calendarDayTextSelected, disabled && styles.calendarDayTextDisabled]}
                                testID={`flight-calendar-day-${value}`}
                              >
                                {Number(value.slice(-2)).toString()}
                              </Text>
                            </View>
                          ) : null}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
            <View style={[styles.dateSheetFooter, isRtl && styles.rowReverse]}>
              <Text style={[styles.dateHelper, isRtl && styles.rtlText]}>
                {tripType === "roundtrip" && returnDate > departure
                  ? `${Math.round((localDate(returnDate).getTime() - localDate(departure).getTime()) / 86_400_000)} ${isRtl ? "ليالٍ" : "nights"}`
                  : mode === "return" && tripType === "roundtrip"
                    ? (isRtl ? "اختَر تاريخ العودة" : "Choose your return date")
                    : (isRtl ? "اختَر تاريخ المغادرة" : "Choose your departure date")}
              </Text>
              <Pressable onPress={onClose} style={styles.dateDoneButton} testID="flight-calendar-done">
                <Text style={styles.dateDoneText}>{isRtl ? "تم" : "Done"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AirportField({
  label,
  placeholder,
  icon,
  value,
  selected,
  onChangeText,
  onFocus,
  isRtl,
  testID,
}: {
  label: string;
  placeholder: string;
  icon: "airplane" | "location";
  value: string;
  selected: FlightAirport | null;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  isRtl: boolean;
  testID: string;
}) {
  return (
    <View style={[styles.field, isRtl && styles.rowReverse]}>
      <View style={[styles.fieldIcon, isRtl && styles.fieldIconRtl]}>
        <HotelPortalIcon name={icon} size={21} color={P.navy} />
      </View>
      <View style={styles.fieldCopy}>
        <Text style={[styles.fieldLabel, isRtl && styles.rtlText]}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={placeholder}
          placeholderTextColor="#98A2B3"
          style={[styles.fieldInput, isRtl && styles.rtlText]}
          testID={testID}
          accessibilityLabel={label}
        />
      </View>
      {selected && <Text style={[styles.iataBadge, isRtl && styles.iataBadgeRtl]}>{selected.iata}</Text>}
    </View>
  );
}

function PassengerCountRow({
  label,
  value,
  onDecrease,
  onIncrease,
  canDecrease,
  testID,
}: {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease: boolean;
  testID: string;
}) {
  return (
    <View style={styles.passengerCountRow}>
      <Text style={styles.passengerCountLabel}>{label}</Text>
      <View style={styles.passengerCounter}>
        <Pressable
          onPress={onDecrease}
          disabled={!canDecrease}
          style={[styles.counterButton, !canDecrease && styles.counterButtonDisabled]}
          accessibilityLabel={`Remove ${label}`}
          testID={`${testID}-decrease`}
        >
          <HotelPortalIcon name="minus" size={16} color={canDecrease ? P.navy : "#B5C0CE"} />
        </Pressable>
        <Text style={styles.passengerCountValue} testID={`${testID}-value`}>{value}</Text>
        <Pressable onPress={onIncrease} style={styles.counterButton} accessibilityLabel={`Add ${label}`} testID={`${testID}-increase`}>
          <HotelPortalIcon name="plus" size={16} color={P.navy} />
        </Pressable>
      </View>
    </View>
  );
}

function airportText(airport: FlightAirport | null, text?: string): string {
  return text ?? airport?.label ?? (airport ? `${airport.city} (${airport.iata})` : "");
}
export function FlightSearchScreen({
  lang,
  onChangeLang,
  onBack,
  onSearch,
  initialValues,
  onValuesChange,
}: {
  lang: HomeLang;
  onChangeLang: (lang: HomeLang) => void;
  onBack: () => void;
  onSearch: (url: string) => void;
  initialValues?: FlightSearchValues | null;
  onValuesChange?: (values: FlightSearchValues) => void;
}) {
  const insets = useSafeAreaInsets();
  const isRtl = lang === "ar";
  const s = COPY[lang];
  const [tripType, setTripType] = useState<FlightTripType>(initialValues?.tripType ?? "roundtrip");
  const [origin, setOrigin] = useState<FlightAirport | null>(initialValues?.origin ?? null);
  const [destination, setDestination] = useState<FlightAirport | null>(initialValues?.destination ?? null);
  const [originText, setOriginText] = useState(initialValues?.origin?.label ?? (initialValues?.origin ? `${initialValues.origin.city} (${initialValues.origin.iata})` : ""));
  const [destinationText, setDestinationText] = useState(initialValues?.destination?.label ?? (initialValues?.destination ? `${initialValues.destination.city} (${initialValues.destination.iata})` : ""));
  const [legs, setLegs] = useState<FlightLeg[]>(() => initialMultiCityLegs(initialValues));
  const [activeAirport, setActiveAirport] = useState<{ legIndex?: number; side: "origin" | "destination" } | null>(null);
  const [suggestions, setSuggestions] = useState<FlightAirport[]>([]);
  const [departure, setDeparture] = useState(initialValues?.departure ?? isoAfter(7));
  const [returnDate, setReturnDate] = useState(initialValues?.returnDate ?? isoAfter(14));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<"departure" | "return">("departure");
  const [datePickerLegIndex, setDatePickerLegIndex] = useState<number | null>(null);
  const [adults, setAdults] = useState(initialValues?.adults ?? 1);
  const [children, setChildren] = useState(initialValues?.children ?? 0);
  const [infants, setInfants] = useState(initialValues?.infants ?? 0);
  const [passengerPickerOpen, setPassengerPickerOpen] = useState(false);
  const [cabinIndex, setCabinIndex] = useState(Math.max(0, initialValues ? CABINS.indexOf(initialValues.cabinClass) : 0));
  const [cabinPickerOpen, setCabinPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [isOpening, setIsOpening] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const airportQuery = activeAirport?.legIndex != null
    ? airportText(legs[activeAirport.legIndex]?.[activeAirport.side] ?? null, legs[activeAirport.legIndex]?.[`${activeAirport.side}Text`])
    : activeAirport?.side === "origin" ? originText : activeAirport?.side === "destination" ? destinationText : "";
  useEffect(() => {
    if (!activeAirport || airportQuery.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/airport-suggest?q=${encodeURIComponent(airportQuery.trim())}&lang=${lang}`)
        .then((response) => response.ok ? response.json() : [])
        .then((data: unknown) => {
          if (active && Array.isArray(data)) setSuggestions(data as FlightAirport[]);
        })
        .catch(() => {
          if (active) setSuggestions([]);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [activeAirport, airportQuery, lang]);

  const values = useMemo<FlightSearchValues>(() => ({
    tripType,
    origin,
    destination,
    departure,
    returnDate,
    legs,
    adults,
    children,
    infants,
    cabinClass: CABINS[cabinIndex],
  }), [adults, cabinIndex, children, departure, destination, infants, legs, origin, returnDate, tripType]);
  useEffect(() => {
    onValuesChange?.(values);
  }, [onValuesChange, values]);

  const chooseAirport = (airport: FlightAirport) => {
    if (!activeAirport) return;
    if (activeAirport.legIndex != null) {
      const textKey = activeAirport.side === "origin" ? "originText" : "destinationText";
      setLegs((current) => current.map((leg, index) => index === activeAirport.legIndex
        ? { ...leg, [activeAirport.side]: airport, [textKey]: airportText(airport) }
        : leg));
    } else if (activeAirport.side === "origin") {
      setOrigin(airport);
      setOriginText(airport.label ?? `${airport.city} (${airport.iata})`);
    } else if (activeAirport.side === "destination") {
      setDestination(airport);
      setDestinationText(airport.label ?? `${airport.city} (${airport.iata})`);
    }
    setActiveAirport(null);
    setSuggestions([]);
    setError("");
  };

  const swapAirports = () => {
    setOrigin(destination);
    setDestination(origin);
    setOriginText(destination ? (destination.label ?? `${destination.city} (${destination.iata})`) : "");
    setDestinationText(origin ? (origin.label ?? `${origin.city} (${origin.iata})`) : "");
    setError("");
  };

  const submit = () => {
    const validation = validateFlightSearch(values);
    if (validation) {
      setError(validationMessage(validation, lang));
      return;
    }
    setIsOpening(true);
    setError("");
    onValuesChange?.(values);
    onSearch(buildFlightRedirectUrl(API_BASE, values));
  };

  const editAirport = (side: "origin" | "destination", text: string) => {
    if (side === "origin") {
      setOriginText(text);
      setOrigin(null);
    } else {
      setDestinationText(text);
      setDestination(null);
    }
    setActiveAirport({ side });
    setError("");
  };

  const editLegAirport = (legIndex: number, side: "origin" | "destination", text: string) => {
    const textKey = side === "origin" ? "originText" : "destinationText";
    setLegs((current) => current.map((leg, index) => index === legIndex
      ? { ...leg, [side]: null, [textKey]: text }
      : leg));
    setActiveAirport({ legIndex, side });
    setSuggestions([]);
    setError("");
  };

  const addLeg = () => {
    setLegs((current) => {
      const previous = current[current.length - 1];
      return [...current, {
        origin: previous?.destination ?? null,
        destination: null,
        departure: previous?.departure ?? isoAfter(7),
        originText: airportText(previous?.destination ?? null),
      }];
    });
    setError("");
  };

  const removeLeg = (legIndex: number) => {
    if (legs.length <= 2) return;
    setLegs((current) => current.filter((_, index) => index !== legIndex));
    setDatePickerLegIndex((current) => {
      if (current === null) return null;
      if (current === legIndex) return null;
      return current > legIndex ? current - 1 : current;
    });
    setError("");
  };

  const moveLeg = (legIndex: number, direction: -1 | 1) => {
    const nextIndex = legIndex + direction;
    if (nextIndex < 0 || nextIndex >= legs.length) return;
    setLegs((current) => {
      const next = [...current];
      [next[legIndex], next[nextIndex]] = [next[nextIndex], next[legIndex]];
      return next;
    });
    setDatePickerLegIndex((current) => {
      if (current === null) return null;
      if (current === legIndex) return nextIndex;
      if (current === nextIndex) return legIndex;
      return current;
    });
    setError("");
  };

  const openDatePicker = (mode: "departure" | "return") => {
    setDatePickerLegIndex(null);
    setDatePickerMode(mode);
    setDatePickerOpen(true);
  };

  const openLegDatePicker = (legIndex: number) => {
    setDatePickerLegIndex(legIndex);
    setDatePickerMode("departure");
    setDatePickerOpen(true);
  };

  return (
    <View style={styles.root}>
      <AppHeader onBack={onBack} canGoBack onInfo={() => setShowInfo(true)} />
      <KeyboardAvoidingView style={styles.flightContent} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel={s.back} testID="flight-back-home">
              <HotelPortalIcon name={isRtl ? "arrow-forward" : "arrow-back"} size={19} color="#FFFFFF" />
            </Pressable>
            <View pointerEvents="none" style={styles.logoFrame}>
              <View style={styles.logoCrop}>
                <Image
                  source={require("../assets/images/dt-tours-logo-transparent.png")}
                  style={styles.logo}
                  resizeMode="contain"
                  tintColor="#FFFFFF"
                  accessibilityLabel="Dar AlTamaiz Tours"
                />
              </View>
            </View>
            <View style={styles.langPill}>
              {(["en", "ar"] as HomeLang[]).map((option) => (
                <Pressable key={option} onPress={() => onChangeLang(option)} style={[styles.langButton, lang === option && styles.langButtonActive]} accessibilityLabel={option === "en" ? "English" : "Arabic"}>
                  <Text style={[styles.langText, lang === option && styles.langTextActive]}>{option === "en" ? "EN" : "عربي"}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={[styles.heroCopy, isRtl && styles.heroCopyRtl]}>
            <Text style={[styles.heroTitle, isRtl && styles.rtlText]} numberOfLines={1}>{s.title}</Text>
            <Text style={[styles.heroSubtitle, isRtl && styles.rtlText]}>{s.subtitle}</Text>
          </View>
          <View style={[styles.badges, isRtl && styles.rowReverse]}>
            <View style={[styles.badge, isRtl && styles.rowReverse]}>
              <HotelPortalIcon name="check" size={15} color="#B9D8FA" />
              <Text style={styles.badgeText}>{s.trusted}</Text>
            </View>
            <View style={styles.badgeDivider} />
            <View style={[styles.badge, isRtl && styles.rowReverse]}>
              <HotelPortalIcon name="chat" size={15} color="#B9D8FA" />
              <Text style={styles.badgeText}>{s.support}</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchCard}>
          <View style={[styles.tripTabs, isRtl && styles.rowReverse]}>
            {([
              ["oneway", s.oneWay],
              ["roundtrip", s.roundTrip],
              ["multicity", s.multiCity],
            ] as Array<[FlightTripType, string]>).map(([type, label]) => (
              <Pressable key={type} onPress={() => { setTripType(type); setActiveAirport(null); setSuggestions([]); setError(""); }} style={[styles.tripTab, tripType === type && styles.tripTabActive]} testID={`flight-trip-${type}`}>
                <Text style={[styles.tripTabText, tripType === type && styles.tripTabTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {tripType !== "multicity" && <>
            <AirportField
              label={s.from}
              placeholder={s.originHint}
              icon="airplane"
              value={originText}
              selected={origin}
              onChangeText={(text) => editAirport("origin", text)}
              onFocus={() => setActiveAirport({ side: "origin" })}
              isRtl={isRtl}
              testID="flight-origin-input"
            />
            {activeAirport?.side === "origin" && activeAirport.legIndex == null && <AirportSuggestions suggestions={suggestions} onChoose={chooseAirport} isRtl={isRtl} />}
            <View style={styles.destinationStack}>
              <AirportField
                label={s.to}
                placeholder={s.destinationHint}
                icon="location"
                value={destinationText}
                selected={destination}
                onChangeText={(text) => editAirport("destination", text)}
                onFocus={() => setActiveAirport({ side: "destination" })}
                isRtl={isRtl}
                testID="flight-destination-input"
              />
              <View style={styles.swapWrap}>
                <Pressable onPress={swapAirports} style={styles.swapButton} accessibilityLabel="Swap origin and destination" testID="flight-swap">
                  <HotelPortalIcon name="swap" size={20} color={P.navy} />
                </Pressable>
              </View>
            </View>
            {activeAirport?.side === "destination" && activeAirport.legIndex == null && <AirportSuggestions suggestions={suggestions} onChoose={chooseAirport} isRtl={isRtl} />}
          </>}

          {tripType !== "multicity" ? <View style={[styles.dateRow, isRtl && styles.rowReverse]}>
            <Pressable onPress={() => openDatePicker("departure")} style={[styles.dateField, styles.dateFieldFirst]} testID="flight-departure-input">
              <HotelPortalIcon name="calendar" size={20} color={P.navy} />
              <View style={styles.dateCopy}>
                <Text style={[styles.fieldLabel, isRtl && styles.rtlText]}>{s.departure}</Text>
                <Text style={[styles.dateValue, isRtl && styles.rtlText]}>{dateLabel(departure, lang)}</Text>
              </View>
            </Pressable>
            {tripType === "roundtrip" ? (
              <Pressable onPress={() => openDatePicker("return")} style={styles.dateField} testID="flight-return-input">
                <HotelPortalIcon name="calendar" size={20} color={P.navy} />
                <View style={styles.dateCopy}>
                  <Text style={[styles.fieldLabel, isRtl && styles.rtlText]}>{s.return}</Text>
                  <Text style={[styles.dateValue, isRtl && styles.rtlText]}>
                    {returnDate ? dateLabel(returnDate, lang) : (isRtl ? "اختر العودة" : "Choose return")}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.dateFieldPlaceholder}>
                <Text style={[styles.datePlaceholderText, isRtl && styles.rtlText]}>{s.oneWay}</Text>
              </View>
            )}
          </View> : <View style={styles.multiCityLegs} testID="flight-multicity-legs">
            {legs.map((leg, index) => (
              <View key={`${index}-${leg.departure}`} style={styles.multiCityLeg}>
                <View style={[styles.legHeader, isRtl && styles.rowReverse]}>
                  <Text style={[styles.legTitle, isRtl && styles.rtlText]}>{s.flight} {index + 1}</Text>
                  <View style={[styles.legActions, isRtl && styles.rowReverse]}>
                    <Pressable onPress={() => moveLeg(index, -1)} disabled={index === 0} style={[styles.legActionButton, index === 0 && styles.legActionDisabled]} accessibilityLabel={s.moveEarlier} testID={`flight-leg-${index + 1}-move-earlier`}>
                      <Text style={styles.legActionText}>↑</Text>
                    </Pressable>
                    <Pressable onPress={() => moveLeg(index, 1)} disabled={index === legs.length - 1} style={[styles.legActionButton, index === legs.length - 1 && styles.legActionDisabled]} accessibilityLabel={s.moveLater} testID={`flight-leg-${index + 1}-move-later`}>
                      <Text style={styles.legActionText}>↓</Text>
                    </Pressable>
                    {legs.length > 2 && <Pressable onPress={() => removeLeg(index)} style={styles.legRemoveButton} accessibilityLabel={`${s.removeLeg} ${index + 1}`} testID={`flight-leg-${index + 1}-remove`}>
                      <HotelPortalIcon name="close" size={16} color={P.error} />
                    </Pressable>}
                  </View>
                </View>
                <AirportField
                  label={s.from}
                  placeholder={s.originHint}
                  icon="airplane"
                  value={airportText(leg.origin, leg.originText)}
                  selected={leg.origin}
                  onChangeText={(text) => editLegAirport(index, "origin", text)}
                  onFocus={() => setActiveAirport({ legIndex: index, side: "origin" })}
                  isRtl={isRtl}
                  testID={`flight-leg-${index + 1}-origin-input`}
                />
                {activeAirport?.legIndex === index && activeAirport.side === "origin" && suggestions.length > 0 && (
                  <AirportSuggestions suggestions={suggestions} onChoose={chooseAirport} isRtl={isRtl} />
                )}
                <AirportField
                  label={s.to}
                  placeholder={s.destinationHint}
                  icon="location"
                  value={airportText(leg.destination, leg.destinationText)}
                  selected={leg.destination}
                  onChangeText={(text) => editLegAirport(index, "destination", text)}
                  onFocus={() => setActiveAirport({ legIndex: index, side: "destination" })}
                  isRtl={isRtl}
                  testID={`flight-leg-${index + 1}-destination-input`}
                />
                {activeAirport?.legIndex === index && activeAirport.side === "destination" && suggestions.length > 0 && (
                  <AirportSuggestions suggestions={suggestions} onChoose={chooseAirport} isRtl={isRtl} />
                )}
                <Pressable
                  onPress={() => openLegDatePicker(index)}
                  style={({ pressed }) => [styles.multiLegDate, isRtl && styles.rowReverse, pressed && styles.pressed]}
                  testID={`flight-leg-${index + 1}-departure-input`}
                  accessibilityLabel={`${s.departure} ${index + 1}`}
                >
                  <HotelPortalIcon name="calendar" size={20} color={P.navy} />
                  <View style={styles.dateCopy}>
                    <Text style={[styles.fieldLabel, isRtl && styles.rtlText]}>{s.departure}</Text>
                    <Text
                      style={[styles.dateValue, isRtl && styles.rtlText]}
                      testID={`flight-leg-${index + 1}-departure-value`}
                    >
                      {dateLabel(leg.departure, lang)}
                    </Text>
                  </View>
                </Pressable>
              </View>
            ))}
            {legs.length < 5 && <Pressable onPress={addLeg} style={[styles.addLegButton, isRtl && styles.rowReverse]} testID="flight-add-leg">
              <HotelPortalIcon name="plus" size={18} color={P.navy} />
              <Text style={styles.addLegText}>{s.addLeg}</Text>
            </Pressable>}
          </View>}

          <Pressable onPress={() => {
            setPassengerPickerOpen((open) => !open);
            setCabinPickerOpen(false);
          }} style={[styles.passengerSummaryField, isRtl && styles.rowReverse]} testID="flight-passengers">
            <HotelPortalIcon name="user" size={21} color={P.navy} />
            <View style={styles.selectionCopy}>
              <Text style={[styles.fieldLabel, isRtl && styles.rtlText]} numberOfLines={1}>{s.passengers}</Text>
              <Text style={[styles.selectionValue, isRtl && styles.rtlText]} numberOfLines={1}>
                {isRtl
                  ? `${adults} بالغ · ${children} طفل · ${infants} رضيع`
                  : `${adults} adult${adults === 1 ? "" : "s"} · ${children} child${children === 1 ? "" : "ren"} · ${infants} infant${infants === 1 ? "" : "s"}`}
              </Text>
            </View>
            <HotelPortalIcon name={isRtl ? "chevron-back" : "chevron-forward"} size={16} color={P.muted} />
          </Pressable>
          {passengerPickerOpen && (
            <View style={styles.passengerPicker} testID="flight-passenger-options">
              <PassengerCountRow
                label={s.adults}
                value={adults}
                onDecrease={() => {
                  setAdults((value) => Math.max(1, value - 1));
                  setInfants((value) => Math.min(value, Math.max(1, adults - 1)));
                }}
                onIncrease={() => setAdults((value) => Math.min(9, value + 1))}
                canDecrease={adults > 1}
                testID="flight-adults"
              />
              <PassengerCountRow label={s.children} value={children} onDecrease={() => setChildren((value) => Math.max(0, value - 1))} onIncrease={() => setChildren((value) => Math.min(8, value + 1))} canDecrease={children > 0} testID="flight-children" />
              <PassengerCountRow label={s.infants} value={infants} onDecrease={() => setInfants((value) => Math.max(0, value - 1))} onIncrease={() => setInfants((value) => Math.min(adults, value + 1))} canDecrease={infants > 0} testID="flight-infants" />
            </View>
          )}
          <Pressable onPress={() => {
            setCabinPickerOpen((open) => !open);
            setPassengerPickerOpen(false);
          }} style={[styles.cabinSelectionField, isRtl && styles.rowReverse]} testID="flight-cabin">
            <HotelPortalIcon name="briefcase" size={21} color={P.navy} />
            <View style={styles.selectionCopy}>
              <Text style={[styles.fieldLabel, isRtl && styles.rtlText]}>{s.cabin}</Text>
              <Text style={[styles.selectionValue, isRtl && styles.rtlText]}>{CABIN_LABELS[lang][CABINS[cabinIndex]]}</Text>
            </View>
            <HotelPortalIcon name={isRtl ? "chevron-back" : "chevron-forward"} size={16} color={P.muted} />
          </Pressable>
          {cabinPickerOpen && (
            <View style={styles.cabinPicker} testID="flight-cabin-options">
              {CABINS.map((cabin, index) => {
                const selected = cabinIndex === index;
                return (
                  <Pressable
                    key={cabin}
                    onPress={() => {
                      setCabinIndex(index);
                      setCabinPickerOpen(false);
                    }}
                    style={[styles.cabinOption, isRtl && styles.rowReverse, selected && styles.cabinOptionSelected]}
                    testID={`flight-cabin-option-${cabin}`}
                  >
                    <Text style={[styles.cabinOptionText, isRtl && styles.rtlText, selected && styles.cabinOptionTextSelected]}>
                      {CABIN_LABELS[lang][cabin]}
                    </Text>
                    {selected ? <HotelPortalIcon name="check" size={18} color={P.navy} /> : null}
                  </Pressable>
                );
              })}
            </View>
          )}

          {error ? <Text style={[styles.errorText, isRtl && styles.rtlText]} testID="flight-search-error">{error}</Text> : null}
          <Pressable onPress={submit} disabled={isOpening} style={({ pressed }) => [styles.searchButton, (pressed || isOpening) && styles.searchButtonPressed]} testID="flight-search-submit">
            {isOpening ? <ActivityIndicator color="#FFFFFF" /> : <HotelPortalIcon name="search" size={20} color="#FFFFFF" />}
            <Text style={styles.searchButtonText}>{isOpening ? s.searching : s.search}</Text>
          </Pressable>
          {/* Dev/testing only — lets someone outside Kuwait/Middle-East
              networks see what result cards look like without a real GDS
              search (which only returns data for Middle-East IPs). Real
              customers must never see this on the production web build. */}
          {Platform.OS === "web" && __DEV__ && (
            <Pressable onPress={() => onSearch(SAMPLE_FLIGHT_PREVIEW_URL)} style={styles.previewResultsButton} testID="flight-preview-results">
              <Text style={styles.previewResultsText}>{s.previewResults}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      <FlightDatePicker
        visible={datePickerOpen}
        lang={lang}
        tripType={datePickerLegIndex === null ? tripType : "oneway"}
        departure={datePickerLegIndex === null ? departure : legs[datePickerLegIndex]?.departure ?? departure}
        returnDate={datePickerLegIndex === null ? returnDate : ""}
        initialMode={datePickerMode}
        onClose={() => {
          setDatePickerOpen(false);
          setDatePickerLegIndex(null);
        }}
        onChange={(nextDeparture, nextReturn) => {
          if (datePickerLegIndex !== null) {
            setLegs((current) => current.map((leg, index) => (
              index === datePickerLegIndex ? { ...leg, departure: nextDeparture } : leg
            )));
          } else {
            setDeparture(nextDeparture);
            setReturnDate(nextReturn);
          }
          setError("");
        }}
      />
      <InfoModal visible={showInfo} onClose={() => setShowInfo(false)} />
    </KeyboardAvoidingView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.canvas },
  flightContent: { flex: 1 },
  content: { paddingBottom: 32 },
  hero: { backgroundColor: P.navy, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18 },
  heroTop: { position: "relative", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)" },
  logoFrame: { position: "absolute", left: 0, right: 0, top: 1, height: 38, alignItems: "center", justifyContent: "center" },
  logoCrop: { width: 168, height: 36, overflow: "hidden", alignItems: "center" },
  logo: { width: 168, height: 168, position: "absolute", top: -69 },
  langPill: { flexDirection: "row", borderRadius: 20, padding: 3, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  langButton: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 16 },
  langButtonActive: { backgroundColor: "#3777C6" },
  langText: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700" },
  langTextActive: { color: "#FFFFFF" },
  heroCopy: { marginTop: 16 },
  heroCopyRtl: { alignItems: "stretch" },
  heroTitle: { color: "#FFFFFF", fontSize: 27, fontWeight: "900", letterSpacing: -0.4 },
  heroSubtitle: { color: "rgba(255,255,255,0.78)", fontSize: 13, marginTop: 4 },
  badges: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 15, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)" },
  badge: { flexDirection: "row", alignItems: "center", gap: 6 },
  badgeText: { color: "rgba(255,255,255,0.92)", fontSize: 11, fontWeight: "700" },
  badgeDivider: { width: 1, height: 15, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 10 },
  searchCard: { marginHorizontal: 16, marginTop: 18, backgroundColor: P.card, borderRadius: 14, borderWidth: 1, borderColor: "#E6EAF0", padding: 11, shadowColor: "#1D3557", shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  productTabs: { flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: P.border, paddingBottom: 12, paddingHorizontal: 2 },
  productTabActive: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: P.navy, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20 },
  productTabActiveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  productTabMuted: { paddingHorizontal: 4, paddingVertical: 8 },
  productTabMutedText: { color: P.ink, fontSize: 14, fontWeight: "700" },
  tripTabs: { flexDirection: "row", marginTop: 14, marginBottom: 12, padding: 3, backgroundColor: P.canvas, borderRadius: 8 },
  tripTab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 42, borderRadius: 6 },
  tripTabActive: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: P.navy },
  tripTabText: { color: P.ink, fontSize: 12, fontWeight: "700" },
  tripTabTextActive: { color: P.navy, fontWeight: "900" },
  field: { minHeight: 69, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderColor: P.border, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, marginBottom: 10 },
  fieldIcon: { marginRight: 11 },
  fieldIconRtl: { marginRight: 0, marginLeft: 11 },
  fieldCopy: { flex: 1, minWidth: 0 },
  fieldLabel: { color: P.ink, fontSize: 12, fontWeight: "800", marginBottom: 2 },
  fieldInput: { color: P.muted, fontSize: 14, paddingVertical: 0, minHeight: 27, textAlignVertical: "center" },
  iataBadge: { color: P.navy, fontSize: 12, fontWeight: "900", backgroundColor: P.paleBlue, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  iataBadgeRtl: { writingDirection: "ltr" },
  destinationStack: { position: "relative" },
  swapWrap: { position: "absolute", right: 11, top: 16, zIndex: 4 },
  swapButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: P.gold, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF", shadowColor: "#6D5500", shadowOpacity: 0.2, shadowRadius: 5, elevation: 4 },
  suggestionBox: { marginTop: -4, marginBottom: 10, borderColor: P.border, borderWidth: 1, borderRadius: 9, overflow: "hidden", backgroundColor: "#FFFFFF" },
  suggestion: { flexDirection: "row", alignItems: "center", padding: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  suggestionIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: P.paleBlue, justifyContent: "center", alignItems: "center", marginRight: 10 },
  suggestionIconRtl: { marginRight: 0, marginLeft: 10 },
  suggestionCopy: { flex: 1, minWidth: 0 },
  suggestionTitle: { color: P.ink, fontSize: 13, fontWeight: "800" },
  suggestionIata: { color: P.navy },
  suggestionMeta: { color: P.muted, fontSize: 11, marginTop: 2 },
  dateRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  dateField: { flex: 1, minHeight: 68, flexDirection: "row", alignItems: "center", borderRadius: 9, borderWidth: 1, borderColor: P.border, paddingHorizontal: 10 },
  dateFieldFirst: {},
  dateCopy: { flex: 1, minWidth: 0, marginLeft: 8 },
  dateInput: { color: P.muted, fontSize: 13, paddingVertical: 0, minHeight: 25 },
  dateValue: { color: P.muted, fontSize: 13, fontWeight: "700", marginTop: 2 },
  dateFieldPlaceholder: { flex: 1, minHeight: 68, borderRadius: 9, borderWidth: 1, borderColor: P.border, backgroundColor: P.canvas, padding: 10, justifyContent: "center" },
  datePlaceholderText: { color: P.muted, fontSize: 11, lineHeight: 16 },
  selectionRow: { flexDirection: "row", gap: 8, marginBottom: 13 },
  selectionField: { flex: 1, minHeight: 69, flexDirection: "row", alignItems: "center", borderRadius: 9, borderWidth: 1, borderColor: P.border, paddingHorizontal: 10, gap: 7 },
  passengerSummaryField: { minHeight: 64, flexDirection: "row", alignItems: "center", borderRadius: 9, borderWidth: 1, borderColor: P.border, paddingHorizontal: 12, gap: 10, marginBottom: 8 },
  cabinSelectionField: { minHeight: 64, flexDirection: "row", alignItems: "center", borderRadius: 9, borderWidth: 1, borderColor: P.border, paddingHorizontal: 12, gap: 10, marginBottom: 13 },
  cabinPicker: { borderRadius: 9, borderWidth: 1, borderColor: "#C9D8F0", backgroundColor: "#FFFFFF", marginTop: -7, marginBottom: 13, overflow: "hidden" },
  cabinOption: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#D8E2F0" },
  cabinOptionSelected: { backgroundColor: P.paleBlue },
  cabinOptionText: { color: P.ink, fontSize: 14, fontWeight: "700" },
  cabinOptionTextSelected: { color: P.navy, fontWeight: "900" },
  cabinField: { flex: 1 },
  selectionCopy: { flex: 1, minWidth: 0 },
  selectionValue: { color: P.ink, fontSize: 13, fontWeight: "700" },
  counterButton: { width: 26, height: 26, borderRadius: 13, backgroundColor: P.paleBlue, alignItems: "center", justifyContent: "center" },
  counterButtonDisabled: { backgroundColor: "#F0F2F5" },
  passengerPicker: { borderRadius: 9, borderWidth: 1, borderColor: "#C9D8F0", backgroundColor: P.paleBlue, paddingHorizontal: 12, marginBottom: 8 },
  passengerCountRow: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#C9D8F0" },
  passengerCountLabel: { color: P.ink, fontSize: 14, fontWeight: "700" },
  passengerCounter: { flexDirection: "row", alignItems: "center", gap: 10 },
  passengerCountValue: { minWidth: 18, color: P.ink, fontSize: 15, textAlign: "center", fontWeight: "800" },
  errorText: { color: P.error, fontSize: 12, fontWeight: "700", marginBottom: 10, lineHeight: 17 },
  multiCityLegs: { gap: 10, marginBottom: 10 },
  multiCityLeg: { borderColor: "#C9D8F0", borderWidth: 1, borderRadius: 10, padding: 10, backgroundColor: P.paleBlue },
  legHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  legTitle: { color: P.navy, fontSize: 13, fontWeight: "900" },
  legActions: { flexDirection: "row", alignItems: "center", gap: 5 },
  legActionButton: { width: 29, height: 29, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: P.border },
  legActionDisabled: { opacity: 0.4 },
  legActionText: { color: P.navy, fontSize: 17, fontWeight: "900", lineHeight: 20 },
  legRemoveButton: { width: 29, height: 29, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F0C9C5" },
  multiLegDate: { minHeight: 62, flexDirection: "row", alignItems: "center", borderRadius: 9, borderWidth: 1, borderColor: P.border, backgroundColor: "#FFFFFF", paddingHorizontal: 10 },
  addLegButton: { minHeight: 44, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: P.navy, backgroundColor: "#FFFFFF" },
  addLegText: { color: P.navy, fontSize: 13, fontWeight: "900" },
  dateModalBackdrop: { flex: 1, backgroundColor: "rgba(12, 24, 44, 0.46)", justifyContent: "flex-end" },
  dateSheet: { width: "100%", maxHeight: "92%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", shadowColor: "#001B50", shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 30 },
  dateSheetContent: { paddingHorizontal: 20, paddingTop: 10 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "#CAD2DD", alignSelf: "center", marginBottom: 14 },
  dateSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  dateSheetTitle: { color: P.ink, fontSize: 18, fontWeight: "900" },
  dateClose: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: P.canvas },
  datePhaseRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  datePhase: { flex: 1, minHeight: 56, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 10, backgroundColor: P.canvas, borderWidth: 1, borderColor: "transparent" },
  datePhaseActive: { backgroundColor: P.paleBlue, borderColor: P.navy },
  datePhaseLabel: { color: P.muted, fontSize: 11, fontWeight: "800" },
  datePhaseLabelActive: { color: P.navy },
  datePhaseValue: { color: P.ink, fontSize: 13, fontWeight: "800", marginTop: 3 },
  datePhaseValueActive: { color: P.navy },
  calendarMonthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  monthArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: P.canvas, alignItems: "center", justifyContent: "center" },
  faded: { opacity: 0.35 },
  monthTitle: { color: P.ink, fontSize: 16, fontWeight: "900" },
  weekdayRow: { position: "relative", height: 16, marginBottom: 5 },
  calendarColumnSlot: { position: "absolute", top: 0, width: "14.2857%" },
  weekday: { width: "100%", color: P.muted, textAlign: "center", fontSize: 11, fontWeight: "800" },
  calendarGrid: {},
  calendarWeek: { position: "relative", height: 40 },
  calendarCell: { width: "100%", height: 40, alignItems: "center", justifyContent: "center" },
  calendarCellRange: { backgroundColor: "#E1EDFC" },
  calendarCellRangeStart: { backgroundColor: "#E1EDFC", borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  calendarCellRangeEnd: { backgroundColor: "#E1EDFC", borderTopRightRadius: 20, borderBottomRightRadius: 20 },
  calendarDay: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  calendarDaySelected: { backgroundColor: P.navy },
  calendarDayDisabled: { opacity: 0.35 },
  calendarDayText: { color: P.ink, fontSize: 13, fontWeight: "700" },
  calendarDayTextSelected: { color: "#FFFFFF", fontWeight: "900" },
  calendarDayTextDisabled: { color: P.muted },
  dateSheetFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#F0F0F0" },
  dateHelper: { flex: 1, color: P.navy, fontSize: 12, fontWeight: "800" },
  dateDoneButton: { minWidth: 66, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: P.navy, paddingHorizontal: 14 },
  dateDoneText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  searchButton: { minHeight: 54, borderRadius: 8, flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center", backgroundColor: P.navy },
  searchButtonPressed: { opacity: 0.84 },
  searchButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  previewResultsButton: { minHeight: 42, marginTop: 9, borderRadius: 8, borderWidth: 1, borderColor: P.navy, alignItems: "center", justifyContent: "center", backgroundColor: P.paleBlue },
  previewResultsText: { color: P.navy, fontSize: 13, fontWeight: "900" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  pressed: { opacity: 0.72 },
});
function initialMultiCityLegs(initialValues?: FlightSearchValues | null): FlightLeg[] {
  if (initialValues?.legs && initialValues.legs.length >= 2) return initialValues.legs;
  return [
    {
      origin: initialValues?.origin ?? null,
      destination: initialValues?.destination ?? null,
      departure: initialValues?.departure ?? isoAfter(7),
      originText: airportText(initialValues?.origin ?? null),
      destinationText: airportText(initialValues?.destination ?? null),
    },
    {
      origin: initialValues?.destination ?? null,
      destination: null,
      departure: isoAfter(10),
      originText: airportText(initialValues?.destination ?? null),
    },
  ];
}
