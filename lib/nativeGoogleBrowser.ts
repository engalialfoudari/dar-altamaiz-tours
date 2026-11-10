import { AppState, Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";

function isGoogleCallback(value: string, redirectUrl: string): boolean {
  try {
    const actual = new URL(value);
    const expected = new URL(redirectUrl);
    // Android can deliver scheme:///path instead of scheme://path.
    const route = (url: URL) => `${url.host}${url.pathname}`.replace(/^\/+|\/+$/g, "");
    return actual.protocol === expected.protocol
      && route(actual) === route(expected)
      && !!actual.searchParams.get("rotating_token_nonce");
  } catch {
    return false;
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
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let cancellation: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let browserOpened = false;
    let leftApp = false;
    let appStateSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
    const finish = (url: string | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      if (cancellation) clearTimeout(cancellation);
      if (deadline) clearTimeout(deadline);
      subscription.remove();
      appStateSubscription?.remove();
      if (error) reject(error);
      else resolve(url);
      if (url) void WebBrowser.dismissBrowser().catch(() => {});
    };
    const receive = (url: string) => {
      if (isGoogleCallback(url, redirectUrl)) finish(url);
    };
    const subscription = Linking.addEventListener("url", ({ url }) => receive(url));
    deadline = setTimeout(() => {
      finish(null, new Error("Google sign-in timed out. Please try again."));
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
            finish(null);
          }
        }, error => finish(null, error));
        return;
      }
      void WebBrowser.openAuthSessionAsync(authorizationUrl, redirectUrl).then(result => {
        if (settled) return;
        if (result.type === "success") {
          if (!isGoogleCallback(result.url, redirectUrl)) {
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
