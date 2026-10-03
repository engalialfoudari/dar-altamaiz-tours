import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter, Platform } from "react-native";
import { getAppLocale, setAppLocale, subscribeLocale, type AppLocale } from "./engine";

const LocaleContext = createContext<{ locale: AppLocale; version: number; changeLocale: (locale: AppLocale) => void }>({
  locale: "en", version: 0, changeLocale: setAppLocale,
});
export const useAppLanguage = () => useContext(LocaleContext);
export const isAppLocale = (value: unknown): value is AppLocale => value === "en" || value === "ar" || value === "tr";
export function AppLanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState(getAppLocale);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => subscribeLocale(() => {
    setLocale(getAppLocale());
    setVersion(version => version + 1);
  }), []);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem("home_lang").catch(() => null).then(value => {
      const linkLanguage = Platform.OS === "web" && typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("lang") : null;
      if (active) {
        if (isAppLocale(linkLanguage)) setAppLocale(linkLanguage);
        else if (isAppLocale(value)) setAppLocale(value);
      }
    }).finally(() => { if (active) setReady(true); }).catch(() => {});
    const subscription = DeviceEventEmitter.addListener("homeLanguageChanged", value => {
      if (isAppLocale(value)) setAppLocale(value);
    });
    return () => { active = false; subscription.remove(); };
  }, []);
  const changeLocale = (value: AppLocale) => {
    setAppLocale(value);
    AsyncStorage.setItem("home_lang", value).catch(() => {});
    DeviceEventEmitter.emit("homeLanguageChanged", value);
  };
  return <LocaleContext.Provider value={{ locale, version, changeLocale }}>
    {ready ? children : null}
  </LocaleContext.Provider>;
}