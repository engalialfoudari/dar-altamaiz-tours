import { Linking } from "react-native";
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
 * Android may dismiss its Custom Tab before delivering the Linking event.
 * A dismissal is cancellation, not a timeout, and must not win that race.
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
    const finish = (url: string | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      if (cancellation) clearTimeout(cancellation);
      if (deadline) clearTimeout(deadline);
      subscription.remove();
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
