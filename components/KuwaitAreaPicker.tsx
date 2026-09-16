import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HotelPortalIcon } from "@/components/HotelPortalIcon";

type Area = { en: string; ar: string };

export const KUWAIT_AREAS: Area[] = [
  ["Abdullah Al-Salem", "عبدالله السالم"], ["Adailiya", "العديلية"], ["Bneid Al-Qar", "بنيد القار"],
  ["Daiya", "الدعية"], ["Dasma", "الدسمة"], ["Dasman", "دسمان"], ["Doha", "الدوحة"], ["Faiha", "الفيحاء"],
  ["Granada", "غرناطة"], ["Jaber Al-Ahmad", "جابر الأحمد"], ["Kaifan", "كيفان"],
  ["Khaldiya", "الخالدية"], ["Mansouriya", "المنصورية"], ["Mirqab", "المرقاب"],
  ["Mubarakiya", "المباركية"], ["Nahda", "النهضة"], ["North West Sulaibikhat", "شمال غرب الصليبيخات"],
  ["Kuwait City", "مدينة الكويت"], ["Nuzha", "النزهة"], ["Qadsiya", "القادسية"], ["Qairawan", "القيروان"],
  ["Qibla", "القبلة"], ["Qurtuba", "قرطبة"], ["Rawda", "الروضة"], ["Shamiya", "الشامية"],
  ["Sharq", "شرق"], ["Shuwaikh", "الشويخ"], ["Shuwaikh Industrial", "الشويخ الصناعية"], ["Sulaibikhat", "الصليبيخات"],
  ["Surra", "السرة"], ["Yarmouk", "اليرموك"],
  ["Al-Bida'a", "البدع"], ["Al-Salam", "السلام"], ["Bayan", "بيان"], ["Hawally", "حولي"],
  ["Hitteen", "حطين"], ["Jabriya", "الجابرية"], ["Maidan Hawally", "ميدان حولي"],
  ["Mishref", "مشرف"], ["Mubarak Al-Abdullah", "مبارك العبدالله"], ["Rumaithiya", "الرميثية"],
  ["Salmiya", "السالمية"], ["Salwa", "سلوى"], ["Shaab", "الشعب"], ["Shuhada", "الشهداء"],
  ["Siddiq", "الصديق"], ["Zahra", "الزهراء"],
  ["Abdullah Al-Mubarak", "عبدالله المبارك"], ["Abraq Khaitan", "أبرق خيطان"], ["Al-Rai", "الري"],
  ["Kuwait International Airport", "مطار الكويت الدولي"],
  ["Andalous", "الأندلس"], ["Ardiya", "العارضية"], ["Ardiya Industrial", "العارضية الصناعية"],
  ["Ashbiliya", "إشبيلية"], ["Dhajeej", "الضجيج"], ["Farwaniya", "الفروانية"],
  ["Firdous", "الفردوس"], ["Jleeb Al-Shuyoukh", "جليب الشيوخ"], ["Khaitan", "خيطان"],
  ["Omariya", "العمرية"], ["Rabia", "الرابية"], ["Rehab", "الرحاب"], ["Riggae", "الرقعي"],
  ["Sabah Al-Nasser", "صباح الناصر"], ["South Abdullah Al-Mubarak", "جنوب عبدالله المبارك"],
  ["Al-Ahmadi", "الأحمدي"], ["Ali Sabah Al-Salem", "علي صباح السالم"], ["Abu Halifa", "أبو حليفة"],
  ["Abu Hasaniya", "أبو الحصانية"], ["Al-Riqqa", "الرقة"], ["Al-Zour", "الزور"],
  ["Bnaider", "بنيدر"], ["Dhaher", "الظهر"], ["Egaila", "العقيلة"], ["Fahaheel", "الفحيحيل"],
  ["Fahad Al-Ahmad", "فهد الأحمد"], ["Fintas", "الفنطاس"], ["Hadiya", "هدية"],
  ["Jaber Al-Ali", "جابر العلي"], ["Khairan", "الخيران"], ["Mahboula", "المهبولة"],
  ["Mangaf", "المنقف"], ["Mina Abdullah", "ميناء عبدالله"], ["Nuwaiseeb", "النويصيب"],
  ["Sabah Al-Ahmad", "صباح الأحمد"], ["Sabahiya", "الصباحية"], ["Shuaiba", "الشعيبة"],
  ["Wafra", "الوفرة"], ["West Abdullah Al-Mubarak", "غرب عبدالله المبارك"],
  ["Abdali", "العبدلي"], ["Al-Naeem", "النعيم"], ["Amghara", "أمغرة"], ["Jahra", "الجهراء"],
  ["Jahra Industrial", "الجهراء الصناعية"],
  ["Kabd", "كبد"], ["Naseem", "النسيم"], ["Oyoun", "العيون"], ["Qasr", "القصر"],
  ["Saad Al-Abdullah", "سعد العبدالله"], ["Salmi", "السالمي"], ["Subiya", "الصبية"],
  ["Sulaibiya", "الصليبية"], ["Taima", "تيماء"], ["Waha", "الواحة"],
  ["Abu Al-Hasaniya", "أبو الحصانية"], ["Abu Fatira", "أبو فطيرة"], ["Adan", "العدان"],
  ["Al-Qurain", "القرين"], ["Al-Qusour", "القصور"], ["Fnaitees", "الفنيطيس"],
  ["Masayel", "المسايل"], ["Messila", "المسيلة"], ["Mubarak Al-Kabeer", "مبارك الكبير"],
  ["Sabah Al-Salem", "صباح السالم"], ["Sabhan", "صبحان"], ["South Sabahiya", "جنوب الصباحية"],
].map(([en, ar]) => ({ en, ar })).sort((a, b) => a.en.localeCompare(b.en));

export function KuwaitAreaPicker({
  value,
  lang,
  onChange,
}: {
  value: string;
  lang: "en" | "ar";
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();
  const rtl = lang === "ar";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? KUWAIT_AREAS.filter(area => area.en.toLowerCase().includes(q) || area.ar.includes(q)) : KUWAIT_AREAS;
  }, [query]);
  const selected = KUWAIT_AREAS.find(area => area.en === value);

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={[styles.fieldText, !selected && styles.placeholder, rtl && styles.rtl]}>
          {selected ? (rtl ? selected.ar : selected.en) : (rtl ? "اختر المنطقة" : "Select area")}
        </Text>
        <HotelPortalIcon name="chevron-down" size={18} color="#64748B" />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={[styles.header, rtl && styles.rowRtl]}>
            <Pressable style={styles.close} onPress={() => setOpen(false)}>
              <HotelPortalIcon name="close" size={22} color="#003580" />
            </Pressable>
            <Text style={[styles.title, rtl && styles.rtl]}>{rtl ? "اختر منطقة التوصيل" : "Choose delivery area"}</Text>
            <View style={styles.close} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={rtl ? "ابحث عن المنطقة" : "Search areas"}
            placeholderTextColor="#94A3B8"
            style={[styles.search, rtl && styles.rtl]}
          />
          <FlatList
            data={filtered}
            keyExtractor={item => item.en}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={[styles.option, value === item.en && styles.optionSelected, rtl && styles.rowRtl]}
                onPress={() => { onChange(item.en); setOpen(false); setQuery(""); }}
              >
                <Text style={[styles.optionText, rtl && styles.rtl]}>{rtl ? item.ar : item.en}</Text>
                {value === item.en && <HotelPortalIcon name="check" size={18} color="#003580" />}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: 46, borderWidth: 1, borderColor: "#D8E0EC", borderRadius: 10, paddingHorizontal: 12, marginBottom: 7, backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldText: { flex: 1, color: "#003580", fontSize: 14 },
  placeholder: { color: "#94A3B8" },
  modal: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { height: 56, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: "#003580", fontSize: 18, fontWeight: "800" },
  search: { margin: 14, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 10, backgroundColor: "#FFF", paddingHorizontal: 13, paddingVertical: 11, color: "#003580" },
  option: { minHeight: 50, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#E9EEF5", backgroundColor: "#FFF" },
  optionSelected: { backgroundColor: "#EEF5FF" },
  optionText: { color: "#1E293B", fontSize: 15 },
  rowRtl: { flexDirection: "row-reverse" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
});