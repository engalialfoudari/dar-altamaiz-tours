import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HotelPortalIcon } from "@/components/HotelPortalIcon";
import { AppHeader } from "@/components/AppHeader";
import { InfoModal } from "@/components/InfoModal";
import type { HomeLang } from "@/components/LuxuryHome";
import { LoadingCountdown } from "@/components/LoadingCountdown";
import { isSampleFlightPreviewUrl } from "@/lib/flightSearch";

const WebView = require("react-native-webview").WebView;
const P = {
  navy: "#002B7F",
  canvas: "#F4F6F9",
  card: "#FFFFFF",
  ink: "#18263D",
  muted: "#697586",
  border: "#D8DEE8",
  paleBlue: "#EAF1FC",
  gold: "#FFB800",
  success: "#16794C",
};
const DT_HOME = "https://dt-tours.com/";
// DT Tours can keep the same GDS search pending for well over 45 seconds.
// The injected page poll ends at 105 seconds, so the native watchdog must
// outlive it rather than reporting a false "no results" error first.
const SUPPLIER_POLL_TIMEOUT_MS = 105_000;
const SEARCH_WATCHDOG_MS = SUPPLIER_POLL_TIMEOUT_MS + 15_000;

type DtAirport = { iata: string; id: string; label: string; category: string };
type DtFlightSearch = {
  tripType: "circle" | "oneway" | "multicity";
  cabin: string;
  adults: number;
  children: number;
  infants: number;
  departure?: string;
  returnDate?: string;
  from?: DtAirport;
  to?: DtAirport;
  legs?: Array<{ departure: string; from: DtAirport; to: DtAirport }>;
};
type FlightPhase = "preparing" | "searching" | "ready" | "failed";
type FlightDiagnostic = {
  stage: string;
  url?: string;
  title?: string;
  cardCount?: number;
  failureCategory?: string;
  detail?: string;
  route?: string;
  tripType?: string;
  dateFormat?: string;
  supplierResponse?: string;
};
const DIAGNOSTIC_CATEGORIES = new Set([
  "none", "form_missing", "field_missing", "form_incomplete", "dt_error",
  "dt_timeout", "navigation_blocked", "webview_error", "prepare_error", "script_error", "unknown",
]);

function isTrustedFlightUrl(url: string) {
  if (url === "about:blank") return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === "dt-tours.com" || host.endsWith(".dt-tours.com") || host === "upayments.com" || host.endsWith(".upayments.com");
  } catch {
    return url === "about:blank";
  }
}

export function isDtFlightResultUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (parsed.hostname === "dt-tours.com" || parsed.hostname.endsWith(".dt-tours.com"))
      && /^\/index\.php\/flight\/search\/\d+\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function isDtFlightResultPath(path: string | undefined) {
  return typeof path === "string" && isDtFlightResultUrl(`https://dt-tours.com${path}`);
}

function isDtSearchSetupUrl(url: string) {
  if (url === "about:blank") return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" || (host !== "dt-tours.com" && !host.endsWith(".dt-tours.com"))) return false;
    return parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
}

export function isPaymentOrCheckoutUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === "upayments.com"
      || host.endsWith(".upayments.com")
      || /payment|checkout|transaction/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function dtCabinValue(cabin: string) {
  return cabin === "Premium Economy" ? "PremiumEconomy" : cabin;
}

function payloadUrl(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}format=json`;
}

export function flightSearchInjection(search: DtFlightSearch) {
  const config = JSON.stringify({ ...search, cabin: dtCabinValue(search.cabin) });
  return `
    (function() {
      var config = ${config};
      function tell(type, extra) {
        var bridge = window.ReactNativeWebView;
        if (bridge) bridge.postMessage(JSON.stringify(Object.assign({ type: type }, extra || {})));
      }
      function report(stage, failureCategory, cardCount, detail) {
        tell('DT_FLIGHT_DIAGNOSTIC', {
          stage: stage,
          failureCategory: failureCategory || 'none',
          path: location.pathname || '/',
          cardCount: Math.max(0, Math.min(500, Number(cardCount) || 0)),
          route: searchRoute(),
          tripType: config.tripType,
          dateFormat: 'DD-MM-YYYY',
          supplierResponse: supplierResponse()
        });
      }
      function searchRoute() {
        if (config.tripType === 'multicity') {
          return (config.legs || []).map(function(leg) {
            return String(leg && leg.from && leg.from.iata || '') + '-' + String(leg && leg.to && leg.to.iata || '');
          }).filter(Boolean).join(',');
        }
        return String(config.from && config.from.iata || '') + '-' + String(config.to && config.to.iata || '');
      }
      function supplierResponse() {
        var text = (document.body && document.body.innerText || '').toLowerCase();
        if (/a php error was encountered|array to string conversion|models\\/flight_model\\.php/.test(text)) return 'php_flight_model_error';
        if (/could not process your request|flight booking engine/.test(text)) return 'flight_booking_engine_could_not_process';
        if (/payment got failed|payment failed/.test(text)) return 'payment_failed';
        return '';
      }
      function supplierFailure() {
        var text = (document.body && document.body.innerText || '').toLowerCase();
        return /a php error was encountered|array to string conversion|models\\/flight_model\\.php|could not process your request|payment got failed|payment failed|flight booking engine/.test(text);
      }
      function fail(category, detail) {
        report('failed', category, 0, detail);
        tell('DT_FLIGHT_FAILED');
      }
      function formatDate(value) {
        var parts = String(value || '').split('-');
        return parts.length === 3 ? parts[2] + '-' + parts[1] + '-' + parts[0] : '';
      }
      function setValue(selector, value) {
        var element = document.querySelector(selector);
        if (!element) return false;
        element.removeAttribute('readonly');
        element.value = value || '';
        element.setAttribute('value', value || '');
        try { element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
        return true;
      }
      function setArrayValue(name, index, value, disabled) {
        var element = document.querySelectorAll('[name="' + name + '"]')[index];
        if (!element) return false;
        element.disabled = !!disabled;
        element.removeAttribute('readonly');
        element.value = value || '';
        element.setAttribute('value', value || '');
        return true;
      }
      function disableStandardFields(form) {
        ['from_label', 'from', 'from_loc_id', 'from_loc_type', 'to_label', 'to', 'to_loc_id', 'to_loc_type', 'depature', 'return'].forEach(function(name) {
          var input = form.querySelector('[name="' + name + '"]');
          if (input) input.disabled = true;
        });
      }
      function submitMultiCity(form) {
        var legs = config.legs || [];
        if (legs.length < 2) { fail('form_incomplete'); return false; }
        var multi = document.getElementById('multi_way_fieldset');
        if (multi) multi.style.display = 'block';
        var complete = setValue('#trip_type_id', 'multicity');
        var count = document.getElementById('multicity_segment_count');
        if (count) { count.value = String(legs.length); } else { complete = false; }
        disableStandardFields(form);
        for (var i = 0; i < 5; i += 1) {
          var leg = legs[i];
          var disabled = !leg;
          complete = setArrayValue('from_label[]', i, leg && leg.from.label, disabled) && complete;
          complete = setArrayValue('from[]', i, leg && leg.from.iata, disabled) && complete;
          complete = setArrayValue('from_loc_id[]', i, leg && leg.from.id, disabled) && complete;
          complete = setArrayValue('from_loc_type[]', i, leg && leg.from.category, disabled) && complete;
          complete = setArrayValue('to_label[]', i, leg && leg.to.label, disabled) && complete;
          complete = setArrayValue('to[]', i, leg && leg.to.iata, disabled) && complete;
          complete = setArrayValue('to_loc_id[]', i, leg && leg.to.id, disabled) && complete;
          complete = setArrayValue('to_loc_type[]', i, leg && leg.to.category, disabled) && complete;
          complete = setArrayValue('depature[]', i, leg && formatDate(leg.departure), disabled) && complete;
        }
        return complete;
      }
      function submitStandard(form) {
        if (!config.from || !config.to || !config.departure) { fail('form_incomplete'); return false; }
        var complete = setValue('#trip_type_id', config.tripType);
        complete = setValue('#from', config.from.label) && complete;
        complete = setValue('#from_val', config.from.iata) && complete;
        complete = setValue('#from_loc_id', config.from.id) && complete;
        complete = setValue('#from_loc_type', config.from.category) && complete;
        complete = setValue('#to', config.to.label) && complete;
        complete = setValue('#to_val', config.to.iata) && complete;
        complete = setValue('#to_loc_id', config.to.id) && complete;
        complete = setValue('#to_loc_type', config.to.category) && complete;
        complete = setValue('#flight_datepicker1', formatDate(config.departure)) && complete;
        complete = setValue('#flight_datepicker2', config.returnDate ? formatDate(config.returnDate) : '') && complete;
        if (!config.returnDate) {
          var returnField = document.querySelector('[name="return"]');
          if (returnField) returnField.disabled = true; else complete = false;
        }
        return complete;
      }
      function submitSearch(attempt) {
        report('form_lookup', 'none', 0);
        try {
        var form = document.getElementById('flight_form');
        if (!form) {
          if (attempt < 80) return setTimeout(function() { submitSearch(attempt + 1); }, 250);
          fail('form_missing');
          return;
        }
        var sector = form.querySelector('input[name="sector_type"][value="international"]');
        if (!sector) { fail('field_missing'); return; }
        sector.checked = true; sector.disabled = false;
        var cabin = form.querySelector('[name="v_class"]');
        if (!cabin) { fail('field_missing'); return; }
        cabin.value = config.cabin || 'Economy'; cabin.disabled = false;
        var adult = form.querySelector('[name="adult"]');
        if (!adult) { fail('field_missing'); return; }
        adult.value = String(config.adults || 1); adult.disabled = false;
        var child = form.querySelector('[name="child"]');
        var infant = form.querySelector('[name="infant"]');
        if (!child || !infant) { fail('field_missing'); return; }
        child.value = String(config.children || 0); child.disabled = false;
        infant.value = String(config.infants || 0); infant.disabled = false;
        var complete = config.tripType === 'multicity' ? submitMultiCity(form) : submitStandard(form);
        if (!complete || window.__dtNativeFlightSubmitted) { fail('form_incomplete'); return; }
        window.__dtNativeFlightSubmitted = true;
        report('form_filled', 'none', 0);
        tell('DT_FLIGHT_SUBMITTED');
        function submitOnce() {
          if (window.__dtNativeFlightSubmitTriggered) return;
          window.__dtNativeFlightSubmitTriggered = true;
          var searchButton = form.querySelector('#flight-form-submit, [name="search_flight"], #search_flight, button[type="submit"], input[type="submit"]');
          if (searchButton && typeof searchButton.click === 'function') {
            report('search_click', 'none', 0);
            searchButton.click();
          } else if (typeof form.requestSubmit === 'function') {
            report('request_submit', 'none', 0);
            form.requestSubmit();
          } else {
            report('direct_submit', 'none', 0);
            form.submit();
          }
        }
        setTimeout(submitOnce, 80);
        } catch (error) {
          fail('script_error', error && error.message ? error.message : 'unknown');
        }
      }
      function reportResult(attempt) {
        if (window.__dtNativeFlightPollCancelled) return;
        if (supplierFailure()) { fail('dt_error', supplierResponse()); return; }
        var cards = document.querySelectorAll('.rowresult.r-r-i, .rowresult, .flight-result');
        if (cards.length) { report('results_ready', 'none', cards.length); tell('DT_FLIGHT_RESULTS_READY'); return; }
        if (attempt >= 105) { report('timeout', 'dt_timeout', 0); tell('DT_FLIGHT_TIMEOUT'); return; }
        setTimeout(function() { reportResult(attempt + 1); }, 1000);
      }
      function startSearchFlow() {
        if (window.__dtNativeFlightBooted) return;
        if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') {
          setTimeout(startSearchFlow, 50);
          return;
        }
        window.__dtNativeFlightBooted = true;
        report('script_started', 'none', 0);
        if (/\\/index\\.php\\/flight\\/search\\/\\d+\\/?$/.test(location.pathname)) {
          report('result_page_loaded', 'none', 0);
          window.addEventListener('pagehide', function() { window.__dtNativeFlightPollCancelled = true; });
          reportResult(0);
        } else if (/(^|\\.)dt-tours\\.com$/.test(location.hostname) && (location.pathname === '/' || location.pathname === '/index.php')) {
          report('home_loaded', 'none', 0);
          submitSearch(0);
        } else {
          report('intermediate_page', 'none', 0);
          if (supplierFailure()) fail('dt_error', supplierResponse());
        }
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startSearchFlow);
      } else {
        startSearchFlow();
      }
      true;
    })();
  `;
}

const SAMPLE_FLIGHTS = [
  { airline: "Kuwait Airways", code: "KU 671", depart: "09:10", arrive: "10:45", duration: "1h 35m", stops: "Non-stop", price: "42.500" },
  { airline: "Jazeera Airways", code: "J9 511", depart: "13:20", arrive: "14:55", duration: "1h 35m", stops: "Non-stop", price: "39.900" },
  { airline: "flydubai", code: "FZ 054", depart: "18:30", arrive: "20:05", duration: "1h 35m", stops: "Non-stop", price: "36.750" },
];

function SampleFlightResults({ lang }: { lang: HomeLang }) {
  const isRtl = lang === "ar";
  const copy = isRtl
    ? {
        label: "معاينة نتائج تجريبية",
        title: "الكويت إلى دبي",
        route: "KWI  ←  DXB",
        details: "رحلة ذهاب · مسافر واحد · الدرجة السياحية",
        note: "هذه معاينة للتصميم فقط. يتم تأكيد السعر والتوفر الفعليين قبل الحجز.",
        select: "اختيار الرحلة",
      }
    : {
        label: "Sample results preview",
        title: "Kuwait to Dubai",
        route: "KWI  →  DXB",
        details: "One-way · 1 traveller · Economy",
        note: "This is a design preview only. Live price and availability are confirmed before booking.",
        select: "Select flight",
      };

  return (
    <ScrollView contentContainerStyle={styles.sampleResults} showsVerticalScrollIndicator={false}>
      <View style={[styles.sampleSummary, isRtl && styles.rowReverse]}>
        <View style={styles.sampleRouteIcon}>
          <HotelPortalIcon name="airplane" size={22} color={P.navy} />
        </View>
        <View style={styles.sampleSummaryCopy}>
          <Text style={[styles.sampleLabel, isRtl && styles.rtlText]}>{copy.label}</Text>
          <Text style={[styles.sampleTitle, isRtl && styles.rtlText]}>{copy.title}</Text>
          <Text style={[styles.sampleRoute, isRtl && styles.rtlText]}>{copy.route}</Text>
          <Text style={[styles.sampleDetails, isRtl && styles.rtlText]}>{copy.details}</Text>
        </View>
      </View>

      {SAMPLE_FLIGHTS.map((flight) => (
        <View key={flight.code} style={styles.sampleFlightCard}>
          <View style={[styles.sampleAirlineRow, isRtl && styles.rowReverse]}>
            <View style={styles.sampleAirlineMark}><Text style={styles.sampleAirlineMarkText}>✈</Text></View>
            <View style={styles.sampleAirlineCopy}>
              <Text style={[styles.sampleAirline, isRtl && styles.rtlText]}>{flight.airline}</Text>
              <Text style={[styles.sampleFlightCode, isRtl && styles.rtlText]}>{flight.code} · {flight.stops}</Text>
            </View>
            <View style={styles.samplePriceWrap}>
              <Text style={styles.samplePriceCurrency}>KWD</Text>
              <Text style={styles.samplePrice}>{flight.price}</Text>
            </View>
          </View>
          <View style={[styles.sampleTimeRow, isRtl && styles.rowReverse]}>
            <View>
              <Text style={[styles.sampleTime, isRtl && styles.rtlText]}>{flight.depart}</Text>
              <Text style={[styles.sampleAirport, isRtl && styles.rtlText]}>KWI</Text>
            </View>
            <View style={styles.sampleDuration}>
              <Text style={styles.sampleDurationText}>{flight.duration}</Text>
              <View style={styles.sampleLine}><View style={styles.sampleLineDot} /></View>
            </View>
            <View>
              <Text style={[styles.sampleTime, styles.sampleTimeEnd, isRtl && styles.rtlText]}>{flight.arrive}</Text>
              <Text style={[styles.sampleAirport, styles.sampleTimeEnd, isRtl && styles.rtlText]}>DXB</Text>
            </View>
          </View>
          <View style={[styles.sampleCardFooter, isRtl && styles.rowReverse]}>
            <Text style={[styles.sampleAvailability, isRtl && styles.rtlText]}>● {isRtl ? "متاح للمعاينة" : "Shown for preview"}</Text>
            <View style={styles.sampleSelectButton}><Text style={styles.sampleSelectText}>{copy.select}</Text></View>
          </View>
        </View>
      ))}
      <View style={[styles.sampleNote, isRtl && styles.rowReverse]}>
        <HotelPortalIcon name="check" size={16} color={P.navy} />
        <Text style={[styles.sampleNoteText, isRtl && styles.rtlText]}>{copy.note}</Text>
      </View>
    </ScrollView>
  );
}

function BrowserFlightHandoff({
  lang,
  url,
  onBack,
}: {
  lang: HomeLang;
  url: string;
  onBack: () => void;
}) {
  const isRtl = lang === "ar";
  const [loadFailed, setLoadFailed] = useState(false);

  if (loadFailed) {
    return (
      <View style={styles.browserHandoff} testID="flight-browser-handoff-error">
        <HotelPortalIcon name="airplane" size={32} color={P.navy} />
        <Text style={[styles.browserHandoffTitle, isRtl && styles.rtlText]}>
          {isRtl ? "تعذر فتح البحث المباشر" : "We couldn't open live flight search"}
        </Text>
        <Text style={[styles.browserHandoffNote, isRtl && styles.rtlText]}>
          {isRtl
            ? "عدّل بيانات الرحلة ثم حاول مرة أخرى."
            : "Review your flight details and try again."}
        </Text>
        <Pressable onPress={onBack} style={styles.retryButton} testID="flight-browser-handoff-back">
          <Text style={styles.retryButtonText}>{isRtl ? "تعديل البحث" : "Edit search"}</Text>
        </Pressable>
      </View>
    );
  }

  // Stay inside the app frame: the live DT Tours search and results render in
  // an embedded iframe (same pattern as the main WebIframeShell/hotel portal)
  // instead of navigating the whole browser tab away to dt-tours.com. The
  // handoff page's own auto-submitting form runs inside this iframe.
  return (
    <View style={styles.browserHandoffFrame} testID="flight-browser-handoff">
      <iframe
        src={url}
        // allow-forms/allow-scripts let the handoff page's auto-submit form run;
        // allow-same-origin keeps the DT Tours session cookie active;
        // allow-top-navigation-by-user-activation lets payment redirects work.
        sandbox="allow-scripts allow-forms allow-same-origin allow-top-navigation-by-user-activation allow-modals"
        style={{ flex: 1, width: "100%", height: "100%", border: "none" } as any}
        title="DT Tours flight results"
        onError={() => setLoadFailed(true)}
      />
    </View>
  );
}

export function FlightResultsScreen({
  url,
  lang,
  onBack,
  onClose,
}: {
  url: string;
  lang: HomeLang;
  onBack: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<FlightPhase>("preparing");
  const [search, setSearch] = useState<DtFlightSearch | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const handoffWebViewRef = useRef<any>(null);
  const latestUrl = useRef(DT_HOME);
  const lastDiagnostic = useRef("");
  const isRtl = lang === "ar";
  const backLabel = isRtl ? "تعديل البحث" : "Edit search";
  const closeLabel = isRtl ? "الرئيسية" : "Home";
  const loadingText = phase === "preparing"
    ? (isRtl ? "جارٍ تجهيز بحثك…" : "Preparing your search…")
    : (isRtl ? "جارٍ البحث عن رحلاتك…" : "Searching DT Tours for flights…");
  const injection = useMemo(() => search ? flightSearchInjection(search) : "", [search]);
  const reportDiagnostic = (diagnostic: FlightDiagnostic) => {
    let path = "unknown";
    try {
      const parsed = new URL(diagnostic.url ?? latestUrl.current);
      if (parsed.hostname === "dt-tours.com" || parsed.hostname.endsWith(".dt-tours.com")) {
        path = parsed.pathname.slice(0, 200);
      }
    } catch {
      // Do not report unknown or full client URLs.
    }
    const stage = diagnostic.stage.replace(/[^a-z_]/gi, "").slice(0, 48) || "unknown";
    const failureCategory = DIAGNOSTIC_CATEGORIES.has(diagnostic.failureCategory ?? "")
      ? diagnostic.failureCategory!
      : "unknown";
    const cardCount = Math.max(0, Math.min(500, Math.trunc(diagnostic.cardCount ?? 0)));
    const detail = typeof diagnostic.detail === "string"
      ? diagnostic.detail.replace(/[^a-z0-9 _-]/gi, " ").slice(0, 160)
      : "";
    const signature = `${stage}|${path}|${failureCategory}|${cardCount}|${detail}`;
    if (lastDiagnostic.current === signature) return;
    lastDiagnostic.current = signature;
    let endpoint = "";
    try {
      endpoint = `${new URL(url).origin}/api/logs`;
    } catch {
      return;
    }
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        errorType: "flight_handoff",
        message: `Flight handoff: ${stage}`,
        context: {
          stage,
          path,
          cardCount,
          failureCategory,
          route: typeof diagnostic.route === "string" ? diagnostic.route.replace(/[^A-Z,-]/g, "").slice(0, 80) : "",
          tripType: ["circle", "oneway", "multicity"].includes(diagnostic.tripType ?? "") ? diagnostic.tripType : "",
          dateFormat: diagnostic.dateFormat === "DD-MM-YYYY" ? diagnostic.dateFormat : "",
          supplierResponse: typeof diagnostic.supplierResponse === "string"
            ? diagnostic.supplierResponse
            : "",
        },
      }),
    }).catch(() => {});
  };

  useEffect(() => {
    if (Platform.OS === "web") return;
    const controller = new AbortController();
    const prepareSearch = async () => {
      try {
        const response = await fetch(payloadUrl(url), { signal: controller.signal });
        const data = await response.json() as { ok?: boolean; search?: DtFlightSearch };
        if (!response.ok || !data.ok || !data.search || controller.signal.aborted) {
          reportDiagnostic({ stage: "prepare_failed", failureCategory: "prepare_error" });
          setPhase("failed");
          return;
        }
        setSearch(data.search);
        setWebViewKey((value) => value + 1);
        setPhase("searching");
      } catch {
        if (!controller.signal.aborted) {
          reportDiagnostic({ stage: "prepare_failed", failureCategory: "prepare_error" });
          setPhase("failed");
        }
      }
    };
    void prepareSearch();
    return () => controller.abort();
  }, [url]);

  useEffect(() => {
    if (phase !== "searching") return;
    const watchdog = setTimeout(() => {
      reportDiagnostic({ stage: "watchdog_timeout", failureCategory: "dt_timeout" });
      setPhase("failed");
    }, SEARCH_WATCHDOG_MS);
    return () => clearTimeout(watchdog);
  }, [phase]);

  const handleNavigation = (nextUrl: string) => {
    latestUrl.current = nextUrl;
    reportDiagnostic({ stage: "navigating", url: nextUrl });
    if (phase !== "ready" && !isDtSearchSetupUrl(nextUrl)) {
      reportDiagnostic({ stage: "navigation_blocked", url: nextUrl, failureCategory: "navigation_blocked" });
      setPhase("failed");
    }
  };

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as FlightDiagnostic & { type?: string; path?: string };
      if (message.type === "DT_FLIGHT_DIAGNOSTIC") {
        reportDiagnostic({ ...message, url: `https://dt-tours.com${message.path ?? "/"}` });
      }
      if (message.type === "DT_FLIGHT_RESULTS_READY") {
        // A result-card message can arrive before React Native reports the
        // new URL. Trust the controlled script's result-page path too, or a
        // live result page can be left under the false-failure watchdog.
        if (isDtFlightResultPath(message.path) || isDtFlightResultUrl(latestUrl.current)) {
          if (isDtFlightResultPath(message.path)) {
            latestUrl.current = `https://dt-tours.com${message.path}`;
          }
          setPhase("ready");
        }
      }
      if (message.type === "DT_FLIGHT_FAILED" || message.type === "DT_FLIGHT_TIMEOUT") setPhase("failed");
    } catch {
      // Only the controlled DT Tours script sends messages to this WebView.
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader onBack={onBack} canGoBack onInfo={() => setShowInfo(true)} />
      <View style={[styles.header, { paddingTop: 16 }, isRtl && styles.rowReverse]}>
        <Pressable onPress={onBack} style={styles.headerButton} accessibilityLabel={backLabel} testID="flight-results-back">
          <HotelPortalIcon name={isRtl ? "arrow-forward" : "arrow-back"} size={19} color="#FFFFFF" />
          <Text style={styles.headerButtonText}>{backLabel}</Text>
        </Pressable>
        <View pointerEvents="none" style={styles.logoCenter}>
          <View style={styles.titleLogoCrop}>
            <Image
              source={require("../assets/images/dt-tours-logo-transparent.png")}
              style={styles.titleLogo}
              resizeMode="contain"
              tintColor="#FFFFFF"
              accessibilityLabel="Dar AlTamaiz Tours"
            />
          </View>
        </View>
        <Pressable onPress={onClose} style={styles.headerButton} accessibilityLabel={closeLabel} testID="flight-results-home">
          <HotelPortalIcon name="close" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.webArea}>
        {Platform.OS === "web" ? (
          isSampleFlightPreviewUrl(url)
            ? <SampleFlightResults lang={lang} />
            : <BrowserFlightHandoff lang={lang} url={url} onBack={onBack} />
        ) : (
          search && phase !== "failed" && (
            <WebView
              ref={handoffWebViewRef}
              key={webViewKey}
              source={{ uri: DT_HOME }}
              style={styles.webView}
              javaScriptEnabled
              domStorageEnabled
              cacheEnabled={false}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              setSupportMultipleWindows={false}
              userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
              injectedJavaScript={injection}
              onMessage={handleMessage}
              onNavigationStateChange={(event: { url: string }) => handleNavigation(event.url)}
              onLoadEnd={(event: { nativeEvent: { url: string } }) => {
                handleNavigation(event.nativeEvent.url);
                handoffWebViewRef.current?.injectJavaScript?.(injection);
              }}
              onError={() => {
                reportDiagnostic({ stage: "webview_error", failureCategory: "webview_error" });
                setPhase("failed");
              }}
              onShouldStartLoadWithRequest={(request: { url: string }) => {
                if (!isTrustedFlightUrl(request.url)) return false;
                if (phase !== "ready" && !isDtSearchSetupUrl(request.url)) {
                  reportDiagnostic({ stage: "navigation_blocked", url: request.url, failureCategory: "navigation_blocked" });
                  setPhase("failed");
                  return false;
                }
                return true;
              }}
            />
          )
        )}
        {Platform.OS !== "web" && (phase === "preparing" || phase === "searching") && (
          <View style={styles.loader} pointerEvents="none">
            <LoadingCountdown
              message={loadingText}
              color={P.navy}
              mutedColor="#526276"
              rtl={isRtl}
            />
          </View>
        )}
        {Platform.OS !== "web" && phase === "failed" && (
          <View style={styles.errorPanel}>
            <HotelPortalIcon name="airplane" size={32} color={P.navy} />
            <Text style={styles.errorTitle}>{isRtl ? "تعذر إكمال البحث" : "We couldn't complete this search"}</Text>
            <Text style={styles.errorText}>
              {isRtl
                ? "لم تعرض DT Tours نتائج لهذه الرحلة. عدّل بحثك ثم حاول مرة أخرى."
                : "DT Tours did not return flight results for this search. Edit your details and try again."}
            </Text>
            <Pressable onPress={onBack} style={styles.retryButton} testID="flight-results-retry">
              <Text style={styles.retryButtonText}>{isRtl ? "تعديل البحث" : "Edit search"}</Text>
            </Pressable>
          </View>
        )}
      </View>
      <InfoModal visible={showInfo} onClose={() => setShowInfo(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.canvas },
  header: { minHeight: 58, backgroundColor: P.navy, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8 },
  rowReverse: { flexDirection: "row-reverse" },
  headerButton: { minHeight: 35, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 7 },
  headerButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  logoCenter: { position: "absolute", left: 0, right: 0, bottom: 7, alignItems: "center" },
  titleLogoCrop: { width: 168, height: 36, overflow: "hidden", alignItems: "center" },
  titleLogo: { width: 168, height: 168, position: "absolute", top: -69 },
  webArea: { flex: 1 },
  webView: { flex: 1 },
  sampleResults: { padding: 16, paddingBottom: 32, gap: 12, backgroundColor: P.canvas },
  sampleSummary: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: P.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: P.border },
  sampleRouteIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: P.paleBlue },
  sampleSummaryCopy: { flex: 1, minWidth: 0 },
  sampleLabel: { color: P.success, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.4 },
  sampleTitle: { color: P.ink, fontSize: 19, fontWeight: "900", marginTop: 2 },
  sampleRoute: { color: P.navy, fontSize: 13, fontWeight: "900", marginTop: 3 },
  sampleDetails: { color: P.muted, fontSize: 12, marginTop: 2 },
  sampleFlightCard: { backgroundColor: P.card, borderRadius: 14, borderWidth: 1, borderColor: P.border, padding: 14, shadowColor: "#1D3557", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  sampleAirlineRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  sampleAirlineMark: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: P.navy },
  sampleAirlineMarkText: { color: "#FFFFFF", fontSize: 15 },
  sampleAirlineCopy: { flex: 1, minWidth: 0 },
  sampleAirline: { color: P.ink, fontSize: 14, fontWeight: "900" },
  sampleFlightCode: { color: P.muted, fontSize: 11, marginTop: 2 },
  samplePriceWrap: { alignItems: "flex-end" },
  samplePriceCurrency: { color: P.muted, fontSize: 10, fontWeight: "800" },
  samplePrice: { color: P.navy, fontSize: 18, fontWeight: "900" },
  sampleTimeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 17 },
  sampleTime: { color: P.ink, fontSize: 18, fontWeight: "900" },
  sampleTimeEnd: { textAlign: "right" },
  sampleAirport: { color: P.muted, fontSize: 11, fontWeight: "800", marginTop: 2 },
  sampleDuration: { width: 112, alignItems: "center" },
  sampleDurationText: { color: P.muted, fontSize: 10, fontWeight: "700", marginBottom: 5 },
  sampleLine: { height: 1, alignSelf: "stretch", backgroundColor: "#B7C2D1", justifyContent: "center" },
  sampleLineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.gold, alignSelf: "center" },
  sampleCardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#EEF1F5", marginTop: 17, paddingTop: 11 },
  sampleAvailability: { color: P.success, fontSize: 11, fontWeight: "800" },
  sampleSelectButton: { minHeight: 32, paddingHorizontal: 11, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: P.navy },
  sampleSelectText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  sampleNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, backgroundColor: P.paleBlue },
  sampleNoteText: { flex: 1, color: P.navy, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  browserHandoff: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, backgroundColor: P.canvas, gap: 13 },
  browserHandoffFrame: { ...StyleSheet.absoluteFillObject, backgroundColor: P.canvas },
  browserHandoffTitle: { color: P.navy, fontSize: 20, fontWeight: "900", textAlign: "center" },
  browserHandoffNote: { color: "#526276", fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 310 },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: P.canvas },
  errorPanel: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, backgroundColor: P.canvas, gap: 13 },
  errorTitle: { color: P.navy, fontSize: 20, fontWeight: "900", textAlign: "center" },
  errorText: { color: "#526276", fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 310 },
  retryButton: { marginTop: 5, minHeight: 46, paddingHorizontal: 22, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: P.navy },
  retryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
});