import { Platform } from "react-native";
import * as Updates from "expo-updates";
import type { GoogleReturnDiagnostic } from "./nativeGoogleBrowser";

/**
 * A fixed allowlist prevents a callback URL, nonce, error message, or other
 * unexpected property from ever being included in this public log request.
 */
export function reportGoogleReturnFailure(
  apiBase: string,
  diagnostic: GoogleReturnDiagnostic,
): void {
  if (Platform.OS !== "android") return;
  const outcomes = ["returned_without_callback", "browser_not_opened", "browser_error", "timeout"];
  const statuses = ["none", "accepted", "wrong_scheme", "wrong_route", "missing_proof", "invalid_url"];
  const boundedNumber = (value: number, max: number) =>
    Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
  const updateId = typeof Updates.updateId === "string"
    && /^[a-f0-9-]{36}$/i.test(Updates.updateId) ? Updates.updateId : null;
  // Use the existing /logs sanitizer's allowed keys. Do not require a backend
  // publication or allow arbitrary context properties through that boundary.
  const context = {
    source: "android_google_browser_return",
    feature: "native_google_return_v1",
    platform: "android",
    buildVersion: updateId ?? "unavailable",
    code: outcomes.includes(diagnostic.outcome) ? diagnostic.outcome : "unknown",
    stage: statuses.includes(diagnostic.lastCallbackStatus)
      ? diagnostic.lastCallbackStatus : "unknown",
    status: [
      `callbacks=${boundedNumber(diagnostic.callbackCount, 100)}`,
      `opened=${diagnostic.browserOpened === true ? 1 : 0}`,
      `left=${diagnostic.leftApp === true ? 1 : 0}`,
      `returned=${diagnostic.returnedToApp === true ? 1 : 0}`,
      `elapsed_ms=${boundedNumber(diagnostic.elapsedMs, 300_000)}`,
      `embedded=${Updates.isEmbeddedLaunch === true ? 1 : 0}`,
    ].join(";"),
  };
  try {
    void fetch(`${apiBase.replace(/\/$/, "")}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        errorType: "native_google_return",
        message: "Android Google browser return did not complete",
        context,
      }),
    }).catch(() => {});
  } catch { /* Logging is optional and must never prevent sign-in. */ }
}
