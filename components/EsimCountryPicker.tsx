import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type EsimCountryOption = { iso: string; name: string; englishName: string; dialCode: string };

function countryName(iso: string, locale: string): string {
  try {
    const DisplayNames = Intl.DisplayNames;
    return DisplayNames ? new DisplayNames([locale], { type: "region" }).of(iso) || iso : iso;
  } catch {
    return iso;
  }
}

export function getEsimCountryOptions(locale = "en"): EsimCountryOption[] {
  return getCountries().map((iso) => ({
    iso,
    name: countryName(iso, locale),
    englishName: countryName(iso, "en"),
    dialCode: getCountryCallingCode(iso),
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

type Props = {
  testID: string;
  selectedIso: string;
  locale: string;
  title: string;
  placeholder: string;
  mode: "country" | "dialCode";
  onSelect: (option: EsimCountryOption) => void;
};

export function EsimCountryPicker({ testID, selectedIso, locale, title, placeholder, mode, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const options = useMemo(() => getEsimCountryOptions(locale), [locale]);
  const selected = options.find((option) => option.iso === selectedIso);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(locale);
    if (!needle) return options;
    return options.filter((option) =>
      option.name.toLocaleLowerCase(locale).includes(needle)
      || option.englishName.toLocaleLowerCase("en").includes(needle)
      || option.iso.toLocaleLowerCase(locale).includes(needle)
      || option.dialCode.includes(needle.replace(/^\+/, "")),
    );
  }, [locale, options, search]);

  const dismiss = () => {
    setVisible(false);
    setSearch("");
  };

  return <>
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={selected ? `${selected.name}, +${selected.dialCode}` : placeholder}
      onPress={() => setVisible(true)}
      style={styles.trigger}
    >
      <Text numberOfLines={1} style={[styles.triggerText, !selected && styles.placeholder]}>
        {selected ? (mode === "dialCode" ? `+${selected.dialCode}  ${selected.name}` : selected.name) : placeholder}
      </Text>
      <Text style={styles.chevron}>⌄</Text>
    </Pressable>
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={dismiss}>
      <View style={[styles.modal, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.header}>
          <Pressable testID={`${testID}-close`} accessibilityRole="button" accessibilityLabel="Close country list" onPress={dismiss} hitSlop={10}>
            <Text style={styles.closeText}>{locale.startsWith("ar") ? "إغلاق" : "Close"}</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <TextInput
          testID={`${testID}-search`}
          accessibilityLabel={locale.startsWith("ar") ? "بحث عن دولة" : "Search countries"}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={locale.startsWith("ar") ? "ابحث عن دولة أو رمز الاتصال" : "Search country or dial code"}
          placeholderTextColor="#768393"
          style={styles.search}
        />
        <FlatList
          testID={`${testID}-options`}
          data={filtered}
          keyExtractor={(item) => item.iso}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              testID={`${testID}-option-${item.iso}`}
              accessibilityRole="button"
              accessibilityLabel={mode === "dialCode" ? `+${item.dialCode} ${item.name}` : item.name}
              onPress={() => { onSelect(item); dismiss(); }}
              style={styles.option}
            >
              <Text style={styles.optionText}>
                {mode === "dialCode" ? `+${item.dialCode}  ${item.name}` : item.name}
              </Text>
              <Text style={styles.isoText}>{item.iso}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{locale.startsWith("ar") ? "لم يتم العثور على دولة" : "No countries found"}</Text>}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trigger: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: "#D8DFE7", backgroundColor: "#FFFFFF", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  triggerText: { color: "#202A36", fontSize: 14, flex: 1 },
  placeholder: { color: "#768393" },
  chevron: { color: "#687583", fontSize: 17, fontWeight: "700" },
  modal: { flex: 1, backgroundColor: "#F3F5F7", paddingHorizontal: 18 },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  closeText: { color: "#003580", fontSize: 14, fontWeight: "700" },
  title: { color: "#202A36", fontSize: 17, fontWeight: "800" },
  headerSpacer: { width: 42 },
  search: { height: 48, borderRadius: 8, borderWidth: 1, borderColor: "#D8DFE7", backgroundColor: "#FFFFFF", paddingHorizontal: 14, color: "#202A36", fontSize: 15, marginBottom: 12 },
  option: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  optionText: { color: "#202A36", fontSize: 15, flex: 1 },
  isoText: { color: "#687583", fontSize: 12, fontWeight: "700" },
  separator: { height: 1, backgroundColor: "#D8DFE7" },
  empty: { color: "#687583", textAlign: "center", padding: 24, fontSize: 14 },
});