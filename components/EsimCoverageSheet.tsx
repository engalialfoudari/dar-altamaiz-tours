import React, { useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { EsimDestination, EsimPackage } from "@workspace/api-client-react";
import { esimDestinationTitle, esimDisplayedCountries } from "./esimDisplayPolicy";

type Props = {
  visible: boolean;
  onClose: () => void;
  lang: "en" | "ar";
  destination: EsimDestination;
  plan: EsimPackage;
  bottomInset: number;
};

export function EsimCoverageSheet({ visible, onClose, lang, destination, plan, bottomInset }: Props) {
  const [search, setSearch] = useState("");
  const rtl = lang === "ar";
  // A local package covers its named destination even when the supplier omits the list.
  // Regional and global coverage must never be inferred from the region's name.
  const countries = esimDisplayedCountries(destination, plan);
  const matches = countries
    .filter(({ name }) => name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const close = () => { setSearch(""); onClose(); };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
    <View style={styles.overlay}>
      <Pressable testID="esim-coverage-dismiss" style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={rtl ? "إغلاق" : "Close"} />
      <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 18) }]}>
        <View style={[styles.header, rtl && styles.reverse]}>
          <View style={styles.heading}>
            <Text style={[styles.title, rtl && styles.rtl]}>{rtl ? "الدول والشبكات المشمولة" : "Countries & networks"}</Text>
            <Text style={[styles.subtitle, rtl && styles.rtl]} numberOfLines={2}>{esimDestinationTitle(destination.title)} · {plan.title}</Text>
          </View>
          <Pressable testID="esim-coverage-close" accessibilityRole="button" accessibilityLabel={rtl ? "إغلاق" : "Close"} onPress={close} style={styles.close}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
        {countries.length > 0 && <TextInput
          testID="esim-coverage-search"
          value={search}
          onChangeText={setSearch}
          placeholder={rtl ? "ابحث عن دولة" : "Search countries"}
          placeholderTextColor="#687583"
          accessibilityLabel={rtl ? "ابحث عن دولة" : "Search countries"}
          style={[styles.search, rtl && styles.rtl]}
        />}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={[styles.sectionTitle, rtl && styles.rtl]}>
            {rtl ? `الدول المشمولة (${countries.length})` : `Covered countries (${countries.length})`}
          </Text>
          {countries.length === 0
            ? <Text style={[styles.note, rtl && styles.rtl]}>{rtl ? "لم يقدّم مزود الخدمة قائمة بالدول لهذه الباقة. تحقق من التغطية قبل الشراء." : "The provider has not supplied a country list for this package. Please confirm coverage before buying."}</Text>
            : matches.length === 0
              ? <Text style={[styles.note, rtl && styles.rtl]}>{rtl ? "لا توجد دول مطابقة." : "No matching countries."}</Text>
              : matches.map(({ name, flagUrl }, index) => <View key={`${name}-${index}`} style={[styles.countryRow, rtl && styles.reverse]}>
                  {!!flagUrl && <Image source={{ uri: flagUrl }} style={styles.flag} resizeMode="contain" accessible={false} />}
                  <Text style={[styles.country, rtl && styles.rtl]}>{name}</Text>
                </View>)}
          <Text style={[styles.sectionTitle, styles.networkHeading, rtl && styles.rtl]}>{rtl ? "الشبكات" : "Networks"}</Text>
          <Text style={[styles.note, rtl && styles.rtl]}>{plan.network.length
            ? plan.network.join(" · ")
            : rtl ? "لم يقدّم مزود الخدمة تفاصيل الشبكات لهذه الباقة." : "The provider has not supplied network details for this package."}</Text>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10,25,46,0.48)" },
  sheet: { maxHeight: "85%", minHeight: 300, backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 15 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 15 },
  reverse: { flexDirection: "row-reverse" },
  heading: { flex: 1 },
  title: { color: "#202A36", fontSize: 18, fontWeight: "800" },
  subtitle: { marginTop: 4, color: "#687583", fontSize: 12 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F5F7", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#202A36", fontSize: 24, lineHeight: 28 },
  search: { minHeight: 44, borderRadius: 10, borderColor: "#D8DFE7", borderWidth: 1, paddingHorizontal: 12, color: "#202A36", marginBottom: 12 },
  content: { paddingBottom: 18 },
  sectionTitle: { color: "#202A36", fontSize: 14, fontWeight: "800", marginBottom: 9 },
  countryRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#D8DFE7", minHeight: 42, flexDirection: "row", alignItems: "center", gap: 10 },
  flag: { width: 24, height: 18 },
  country: { color: "#202A36", fontSize: 13 },
  networkHeading: { marginTop: 18 },
  note: { color: "#687583", fontSize: 13, lineHeight: 20 },
  rtl: { textAlign: "right", writingDirection: "rtl" },
});