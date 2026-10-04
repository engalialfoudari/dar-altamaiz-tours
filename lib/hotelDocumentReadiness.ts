import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export const HOTEL_DOCUMENT_TIMEOUT_MS = 20_000;
export type HotelDocumentState = "loading" | "ready" | "error";

export function requiresHotelDocumentReadiness(url: string): boolean {
  try {
    return /\/(?:hotels|hotel-test)(?:\/logout)?\/?$/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** A load event (including a browser's 502/error document) is not readiness. */
export function useHotelDocumentReadiness(
  documentKey: string,
  sendProbe: (message: { type: string; requestId: string }) => void,
  enabled = true,
) {
  const id = useId();
  const requestId = useMemo(() => `${id}:${documentKey}`, [id, documentKey]);
  const [state, setState] = useState<HotelDocumentState>("loading");
  const status = useRef<HotelDocumentState>("loading");
  const sender = useRef(sendProbe);
  sender.current = sendProbe;
  const probe = useCallback(() => {
    sender.current({ type: "dt-hotel-document-probe", requestId });
  }, [requestId]);

  useEffect(() => {
    if (!enabled) {
      status.current = "ready";
      setState("ready");
      return;
    }
    status.current = "loading";
    setState("loading");
    probe();
    const interval = setInterval(() => {
      if (status.current === "loading") probe();
      else clearInterval(interval);
    }, 500);
    const timeout = setTimeout(() => {
      if (status.current === "loading") {
        status.current = "error";
        setState("error");
      }
    }, HOTEL_DOCUMENT_TIMEOUT_MS);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [probe, enabled]);

  const acknowledge = useCallback((message: unknown) => {
    const data = message as { type?: string; requestId?: string } | null;
    if (data?.type !== "dt-hotel-document-ready" || data.requestId !== requestId) return false;
    // A late response from this same document may recover a slow initial load.
    status.current = "ready";
    setState("ready");
    return true;
  }, [requestId]);
  const fail = useCallback(() => {
    // Subsequent navigation/subresource errors must not obscure a loaded search.
    if (status.current !== "loading") return;
    status.current = "error";
    setState("error");
  }, []);
  return { state: enabled ? state : "ready" as HotelDocumentState, probe, acknowledge, fail };
}

export const hotelDocumentCopy = {
  en: {
    loading: "Loading hotels…",
    error: "Unable to open hotels. Please check your connection and try again.",
    retry: "Retry",
  },
  ar: {
    loading: "جاري تحميل الفنادق…",
    error: "تعذر فتح الفنادق. يرجى التحقق من اتصالك والمحاولة مرة أخرى.",
    retry: "إعادة المحاولة",
  },
  tr: {
    loading: "Oteller yükleniyor…",
    error: "Oteller açılamadı. Lütfen bağlantınızı kontrol edip tekrar deneyin.",
    retry: "Tekrar dene",
  },
};