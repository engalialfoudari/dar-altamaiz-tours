import { useCallback, useEffect, useRef, useState } from "react";
import type { AppLocale } from "@/localization/engine";

/** New documents start in the selected language; open documents switch in place. */
export function useBookingDocumentLocale(url: string, visible: boolean, locale: AppLocale): AppLocale {
  const snapshot = useRef({ url, visible, locale });
  if (url !== snapshot.current.url) {
    snapshot.current.locale = locale;
  }
  snapshot.current.url = url;
  snapshot.current.visible = visible;
  return snapshot.current.locale;
}

/** Fetch outside the WebView: the legacy website's CSP forbids API fetches. */
export function useBookingPageLocale(
  apiBase: string,
  language: AppLocale,
  initialUrl: string,
  inject: (script: string) => void,
) {
  const url = useRef(initialUrl);
  const [documentVersion, setDocumentVersion] = useState(0);
  const generation = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const script = useRef<string | null>(null);
  const ready = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const apply = useCallback(async () => {
    if (!ready.current) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const epoch = ++generation.current;
    const pageUrl = url.current;
    setError(null);
    try {
      if (!script.current) {
        const response = await fetch(`${apiBase}/customer-locale.js`, { signal: controller.signal });
        if (!response.ok) throw new Error("Locale script unavailable");
        script.current = await response.text();
      }
      let map: Record<string, string> = {};
      if (language !== "en") {
        const response = await fetch(`${apiBase}/fetch-translate-page`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: pageUrl, lang: language }), signal: controller.signal,
        });
        if (!response.ok) throw new Error("Translation unavailable");
        map = (await response.json()).map;
      }
      if (epoch !== generation.current || pageUrl !== url.current) return;
      inject(`if(window.dtSyncLang)window.dtSyncLang('en');window.__dtLegacyLocale=true;${script.current};window.__dtLocale.set(${JSON.stringify(language)},${JSON.stringify(map)});true;`);
    } catch {
      if (!controller.signal.aborted && epoch === generation.current) setError(
        language === "tr" ? "Sayfa çevrilemedi. Lütfen yeniden deneyin."
          : language === "ar" ? "تعذّر ترجمة الصفحة. حاول مرة أخرى." : "Page could not be translated. Please try again.",
      );
    }
  }, [apiBase, language, inject]);
  useEffect(() => {
    void apply();
    return () => { generation.current++; pending.current?.abort(); };
  }, [apply, documentVersion]);
  const loaded = useCallback((pageUrl?: string) => {
    if (pageUrl) url.current = pageUrl;
    ready.current = true;
    setDocumentVersion(version => version + 1);
  }, []);
  const navigated = useCallback((pageUrl: string) => {
    if (pageUrl !== url.current) {
      url.current = pageUrl; generation.current++; pending.current?.abort(); ready.current = false;
    }
  }, []);
  return { loaded, navigated, retry: apply, error };
}

export const bookingLocaleMessage = (language: AppLocale) =>
  ({ type: "dt-customer-locale", language });
export const bookingLocaleInjection = (language: AppLocale) =>
  `if(window.__dtLocale){if(typeof window.setLang==='function')window.setLang(${JSON.stringify(language)});else window.__dtLocale.set(${JSON.stringify(language)});}true;`;