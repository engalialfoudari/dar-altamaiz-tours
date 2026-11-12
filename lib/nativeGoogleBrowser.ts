import { AppState, Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";

type CallbackStatus = "accepted" | "wrong_scheme" | "wrong_route" | "missing_proof" | "invalid_url";

export type GoogleReturnDiagnostic = {
  outcome: "returned_without_callback" | "browser_not_opened" | "browser_error" | "timeout";
  callbackCount: number;
  lastCallbackStatus: CallbackStatus | "none";
  browserOpened: boolean;
  leftApp: boolean;
  returnedToApp: boolean;
  elapsedMs: number;
};

function callbackStatus(value: string, redirectUrl: string): CallbackStatus {
  try {
    const actual = new URL(value);
    const expected = new URL(redirectUrl);
    // Android can deliver scheme:///path instead of scheme://path.
    const route = (url: URL) => `${url.host}${url.pathname}`.replace(/^\/+|\/+$/g, "");
    if (actual.protocol !== expected.protocol) return "wrong_scheme";
    if (route(actual) !== route(expected)) return "wrong_route";
    return actual.searchParams.get("rotating_token_nonce") ? "accepted" : "missing_proof";
  } catch {
    return "invalid_url";
  }
}

/**
 * Android's openAuthSessionAsync polyfill races any "active" AppState event
 * against the redirect. After the native account picker that event can still
 * be arriving when the browser opens, so it is not evidence of cancellation.
 * Own the Android lifecycle: only a foreground return after a real departure
 * can start cancellation, and a verified URL always wins the return grace.
 */
export function waitForNativeGoogleReturn(
  authorizationUrl: string,
  redirectUrl: string,
  timeoutMs = 120_000,
  onDiagnostic?: (diagnostic: GoogleReturnDiagnostic) => void,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let cancellation: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let browserOpened = false;
    let leftApp = false;
    let returnedToApp = false;
    let callbackCount = 0;
    let lastCallbackStatus: CallbackStatus | "none" = "none";
    const startedAt = Date.now();
    let appStateSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
    const finish = (
      url: string | null,
      error?: unknown,
      outcome: GoogleReturnDiagnostic["outcome"] = error ? "browser_error" : "returned_without_callback",
    ) => {
      if (settled) return;
      settled = true;
      if (cancellation) clearTimeout(cancellation);
      if (deadline) clearTimeout(deadline);
      subscription.remove();
      appStateSubscription?.remove();
      // Never report URL strings, query values, errors or account information.
      // Observability must not affect whether an account can be activated.
      if (!url && Platform.OS === "android" && onDiagnostic) {
        try {
          onDiagnostic({
            outcome, callbackCount, lastCallbackStatus, browserOpened,
            leftApp, returnedToApp, elapsedMs: Math.max(0, Date.now() - startedAt),
          });
        } catch { /* Diagnostic reporting cannot break authentication. */ }
      }
      if (error) reject(error);
      else resolve(url);
      // SDK 54 exposes dismissBrowser on iOS only. On Android its JS wrapper
      // returns undefined; chaining .catch throws in the Linking event handler.
      // Android returns through the app's deep link, not this iOS API.
      if (url && Platform.OS === "ios") {
        try { void Promise.resolve(WebBrowser.dismissBrowser()).catch(() => {}); } catch {}
      }
    };
    const receive = (url: string) => {
      if (settled) return;
      callbackCount = Math.min(callbackCount + 1, 100);
      lastCallbackStatus = callbackStatus(url, redirectUrl);
      if (lastCallbackStatus === "accepted") finish(url);
    };
    const subscription = Linking.addEventListener("url", ({ url }) => receive(url));
    deadline = setTimeout(() => {
      finish(null, new Error("Google sign-in timed out. Please try again."), "timeout");
    }, timeoutMs);
    try {
      if (Platform.OS === "android") {
        appStateSubscription = AppState.addEventListener("change", state => {
          if (settled) return;
          if (state !== "active") {
            // Opening the Custom Tab can background the app before its
            // "opened" promise resolves. Record that departure as well.
            leftApp = true;
            if (cancellation) clearTimeout(cancellation);
            cancellation = undefined;
          } else if (browserOpened && leftApp && !cancellation) {
            returnedToApp = true;
            // The URL event and Expo Router params are delivered separately.
            // Do not discard a successful callback on a slow Android bridge.
            cancellation = setTimeout(() => finish(null), 10_000);
          }
        });
        void WebBrowser.openBrowserAsync(authorizationUrl).then(result => {
          if (settled) return;
          if (result.type === "opened") {
            browserOpened = true;
          } else {
            finish(null, undefined, "browser_not_opened");
          }
        }, error => finish(null, error));
        return;
      }
      void WebBrowser.openAuthSessionAsync(authorizationUrl, redirectUrl).then(result => {
        if (settled) return;
        if (result.type === "success") {
          if (callbackStatus(result.url, redirectUrl) !== "accepted") {
            finish(null, new Error("Google did not return a valid sign-in response."));
          } else {
            receive(result.url);
          }
          return;
        }
        // Give Android's URL event a chance to arrive after browser dismissal.
        // An actual cancellation clears the spinner without showing a false error.
        cancellation = setTimeout(() => finish(null), 1_500);
      }, error => finish(null, error));
    } catch (error) {
      finish(null, error);
    }
  });
}
