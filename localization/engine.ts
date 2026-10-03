import { turkishCopy } from "./dictionary";
import { translateUiTexts } from "@workspace/api-client-react";

export type AppLocale = "en" | "ar" | "tr";
let locale: AppLocale = "en";
const listeners = new Set<() => void>();
const liveCopy = new Map<string, string>();
const pending = new Set<string>();
const failed = new Set<string>();
const inFlight = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
export const normalizeCopy = (text: string) => text.replace(/\s+/g, " ").trim();
export const getAppLocale = () => locale;
export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setAppLocale(value: AppLocale) {
  if (locale === value) return;
  locale = value;
  listeners.forEach(listener => listener());
}
function notify() { listeners.forEach(listener => listener()); }
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templates = Object.entries(turkishCopy).filter(([key]) => /\{\d+\}/.test(key))
  .filter(([key]) => key.replace(/\{\d+\}/g, "").trim().length >= 3)
  .map(([key, value]) => {
    const indexes: string[] = [];
    const source = key.split(/(\{\d+\})/).map(part => {
      if (/^\{\d+\}$/.test(part)) { indexes.push(part); return "(.+?)"; }
      return escapeRegex(part);
    }).join("");
    return { regex: new RegExp(`^${source}$`, "s"), indexes, value };
  });
const translatedValues = new Set(Object.values(turkishCopy).map(normalizeCopy));

// Customer input, technical identifiers and brand marks are data, not UI copy.
export function isDisplayData(value: string): boolean {
  return !/[A-Za-z\u0600-\u06ff]/.test(value)
    || /^(?:https?:\/\/|mailto:|tel:|LPA:|ESIM-|DT-|HTL-)/i.test(value)
    || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    || /^(?:[A-Z0-9._/+:-]+|[A-Za-z0-9_-]{18,})$/.test(value)
    || /^(?:D\.?T\.? Tours|DT Tours|Dar AlTamaiz Tours|Google|Apple|Visa|Mastercard|KNET|eSIM|QR)$/i.test(value);
}
export function lookupTurkish(text: string): string | undefined {
  const key = normalizeCopy(text);
  const exact = liveCopy.get(key) ?? (Object.prototype.hasOwnProperty.call(turkishCopy, key) ? turkishCopy[key] : undefined);
  if (exact) return exact;
  if (translatedValues.has(key)) return text;
  if (isDisplayData(key)) return text;
  for (const template of templates) {
    const match = key.match(template.regex);
    if (!match) continue;
    const values = new Map(template.indexes.map((index, i) => [index, match[i + 1]!]));
    const translated = template.value.replace(/\{\d+\}/g, index => {
      const value = values.get(index) ?? "";
      if (isDisplayData(value)) return value;
      const normalizedValue = normalizeCopy(value);
      return liveCopy.get(normalizedValue) ??
        (Object.prototype.hasOwnProperty.call(turkishCopy, normalizedValue) ? turkishCopy[normalizedValue] : undefined) ?? value;
    });
    if (!/[\u0600-\u06ff]/.test(translated)) return translated;
  }
  return undefined;
}

export async function translateUiImmediately(texts: string[]): Promise<string[]> {
  if (getAppLocale() !== "tr") return texts;
  const unknown = [...new Set(texts.filter(text => lookupTurkish(text) === undefined))];
  for (let offset = 0; offset < unknown.length; offset += 30) {
    const batch = unknown.slice(offset, offset + 30);
    const protectedTexts = batch.map(protectDisplayData);
    const response = await translateUiTexts({ lang: "tr", texts: protectedTexts.map(item => item.text) });
    if (response.fallback || response.translations.length !== batch.length) throw new Error("Incomplete Turkish translation");
    response.translations.forEach((text, index) => {
      if (!text.trim() || /[\u0600-\u06ff]/.test(text)) throw new Error("Invalid Turkish translation");
      liveCopy.set(normalizeCopy(batch[index]!), protectedTexts[index]!.restore(text));
    });
  }
  return texts.map(text => lookupTurkish(text) ?? "Bu içerik şu anda çevrilemiyor.");
}
async function flushPending() {
  timer = undefined;
  const batch = [...pending].slice(0, 30);
  batch.forEach(text => pending.delete(text));
  if (!batch.length) return;
  try {
    batch.forEach(text => inFlight.add(text));
    const protectedTexts = batch.map(protectDisplayData);
    const result = await translateUiTexts({ lang: "tr", texts: protectedTexts.map(item => item.text) });
    if (result.fallback || !Array.isArray(result.translations) || result.translations.length !== batch.length) throw new Error("Incomplete translation");
    result.translations.forEach((translation: unknown, index: number) => {
      if (typeof translation !== "string" || !translation.trim() || /[\u0600-\u06ff]/.test(translation)) {
        failed.add(batch[index]!);
      } else liveCopy.set(batch[index]!, protectedTexts[index]!.restore(translation));
    });
  } catch {
    batch.forEach(text => failed.add(text));
  } finally {
    batch.forEach(text => inFlight.delete(text));
  }
  notify();
  if (pending.size) timer = setTimeout(flushPending, 150);
}
export function localizeUi(value: unknown): any {
  if (locale !== "tr" || typeof value !== "string" || !value.trim()) return value;
  const known = lookupTurkish(value);
  if (known !== undefined) {
    if (known === value) return value;
    return `${value.match(/^\s*/)?.[0] ?? ""}${known}${value.match(/\s*$/)?.[0] ?? ""}`;
  }
  const key = normalizeCopy(value);
  // Never show original-language text on a translation failure.
  if (failed.has(key)) return "Bu içerik şu anda çevrilemiyor.";
  if (!pending.has(key) && !inFlight.has(key)) pending.add(key);
  if (!timer) timer = setTimeout(flushPending, 150);
  return "Çeviri hazırlanıyor…";
}

/** Do not send contact information or activation credentials to an AI service. */
export function protectDisplayData(text: string) {
  const values: string[] = [];
  const protectedText = text.replace(
    /(?:\{(?:\d+|DT_DATA_\d+)\}|LPA:[^\s]+|https?:\/\/[^\s]+|[^\s@]+@[^\s@]+\.[^\s@]+|\+?\d[\d ()-]{7,}\d|\b(?:TAMAIZ|ESIM|DT|HTL)-[A-Za-z0-9_-]+\b|\b\d+(?:[.,]\d+)*\b)/g,
    value => {
      if (/^\{(?:\d+|DT_DATA_\d+)\}$/.test(value)) return value;
      let index = values.length;
      while (text.includes(`{DT_DATA_${index}}`)) { values.push(""); index++; }
      values.push(value);
      return `{DT_DATA_${index}}`;
    },
  );
  return {
    text: protectedText,
    restore: (translated: string) => {
      for (let i = 0; i < values.length; i++) {
        if (!values[i]) continue;
        if (!translated.includes(`{DT_DATA_${i}}`)) throw new Error("Translation removed protected display data");
      }
      return translated.replace(/\{DT_DATA_(\d+)\}/g, (match, index) => values[Number(index)] || match);
    },
  };
}