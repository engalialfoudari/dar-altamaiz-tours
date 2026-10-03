import countryNames from "./esim-country-names.json";

type Language = "ar" | "en";
const countries: Record<string, { ar: string; en: string }> = countryNames;
const regions: Record<string, { ar: string; en: string }> = {
  "middle east and north africa": { ar: "الخليج وشمال أفريقيا", en: "GCC & North Africa" },
  "gcc & north africa": { ar: "الخليج وشمال أفريقيا", en: "GCC & North Africa" },
  "africa": { ar: "أفريقيا", en: "Africa" },
  "asia": { ar: "آسيا", en: "Asia" },
  "europe": { ar: "أوروبا", en: "Europe" },
  "european union and united kingdom": { ar: "الاتحاد الأوروبي والمملكة المتحدة", en: "European Union and United Kingdom" },
  "africa safari": { ar: "رحلات السفاري في أفريقيا", en: "Africa Safari" },
  "north america": { ar: "أمريكا الشمالية", en: "North America" },
  "latin america": { ar: "أمريكا اللاتينية", en: "Latin America" },
  "south america": { ar: "أمريكا الجنوبية", en: "South America" },
  "caribbean islands": { ar: "جزر الكاريبي", en: "Caribbean Islands" },
  "caribbean": { ar: "الكاريبي", en: "Caribbean" },
  "oceania": { ar: "أوقيانوسيا", en: "Oceania" },
  "middle east": { ar: "الشرق الأوسط", en: "Middle East" },
  "global": { ar: "عالمية", en: "Global" },
  "world": { ar: "عالمية", en: "Global" },
};
const aliases: Record<string, string> = {
  "turkey": "TR", "south korea": "KR", "north korea": "KP",
  "hong kong": "HK", "macao": "MO", "macau": "MO", "taiwan": "TW",
  "czech republic": "CZ", "ivory coast": "CI", "reunion": "RE",
  "united states of america": "US", "usa": "US", "uk": "GB",
  "vatican city": "VA", "palestine": "PS",
};
const codeByName = new Map<string, string>();
for (const [code, names] of Object.entries(countries)) {
  codeByName.set(names.en.toLowerCase(), code);
  codeByName.set(names.ar.toLowerCase(), code);
}
export function esimCountryCode(name: string): string | undefined {
  const key = name.trim().toLowerCase();
  return aliases[key] ?? codeByName.get(key);
}
/** Static CLDR names work in Hermes without Intl.DisplayNames or a network request. */
export function esimCountryName(code: string, locale = "en"): string {
  const language: Language = locale.startsWith("ar") ? "ar" : "en";
  return countries[code.toUpperCase()]?.[language] ?? (language === "ar" ? "دولة غير معروفة" : "Unknown country");
}
export function localizedEsimDestination(title: string, locale = "en", code?: string): string {
  const language: Language = locale.startsWith("ar") ? "ar" : "en";
  const region = regions[title.trim().toLowerCase()];
  if (region) return region[language];
  const iso = code?.trim().toUpperCase() || esimCountryCode(title);
  return iso && countries[iso] ? countries[iso]![language] : title;
}
export function esimCountryFlag(code: string): string {
  return /^[A-Z]{2}$/i.test(code)
    ? [...code.toUpperCase()].map(letter => String.fromCodePoint(letter.charCodeAt(0) + 127397)).join("")
    : "";
}