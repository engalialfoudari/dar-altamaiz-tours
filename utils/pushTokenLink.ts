/**
 * Shared push-token registration utilities.
 *
 * registerPushToken()     — cold-start registration with AsyncStorage guard.
 *                           Skips if the token hasn't changed since last send.
 *                           Can send a Clerk Bearer token so an authenticated
 *                           user gets their stable local userId linked.
 *
 * linkPushTokenAfterAuth() — called immediately after a successful login or
 *                           registration. Bypasses the AsyncStorage early-return
 *                           so the server can link the freshly-set session cookie
 *                           to the existing token row.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";

const API_BASE = (
  process.env["EXPO_PUBLIC_API_BASE"] ??
  "https://tours-dar-tamaiz--engalialfoudari.replit.app/api"
).replace(/\/$/, "");

const EAS_PROJECT_ID = "193bf2d0-8d16-482e-a165-8869c46042f7";

/** AsyncStorage key — bumped to force re-registration on all devices. */
export const PUSH_TOKEN_SENT_KEY = "push_token_sent_v4";

function reportError(
  errorType: string,
  message: string,
  stack?: string,
  context?: Record<string, unknown>,
): void {
  fetch(`${API_BASE}/logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ errorType, message: message.slice(0, 2000), stack, context }),
  }).catch(() => {});
}

/** Resolve the platform device identifier. */
async function getDeviceId(): Promise<string> {
  return (
    (Platform.OS === "ios"
      ? await Application.getIosIdForVendorAsync()
      : Application.getAndroidId()) ?? "unknown"
  );
}
/** Best-effort values for optional development-only feature payloads. */
export async function getPushRegistrationIdentity(): Promise<{ deviceId: string; expoPushToken: string | null }> {
  const deviceId = await getDeviceId();
  return { deviceId, expoPushToken: await AsyncStorage.getItem(PUSH_TOKEN_SENT_KEY) };
}

/**
 * Call the server's /register-device endpoint, sending the session cookie so
 * the server can link user_id when the user is authenticated.
 * Returns true on success.
 */
async function callRegisterDevice(deviceId: string, expoPushToken: string, authToken?: string | null): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/register-device`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ deviceId, expoPushToken }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      reportError(
        "push_token_register_failed",
        `Server rejected token: ${res.status} ${body}`,
        undefined,
        { expoPushToken: expoPushToken.slice(0, 30) },
      );
      return false;
    }
    return true;
  } catch (err: unknown) {
    reportError("push_token_register_network", String(err));
    return false;
  }
}

/**
 * Cold-start registration. Fetches the Expo push token, skips if it matches
 * the cached value (no change since last successful send), then registers with
 * the server. Updates the cache only on success.
 */
export async function registerPushToken(): Promise<void> {
  if (Platform.OS === "web") return;

  let N: any = null;
  try {
    N = require("expo-notifications");
  } catch { return; }
  if (!N) return;

  try {
    const { status } = await N.getPermissionsAsync();
    if (status !== "granted") return;

    let tokenData: { data: string };
    try {
      tokenData = await N.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    } catch (tokenErr: unknown) {
      reportError("push_token_fetch_failed", String(tokenErr), undefined, {
        projectId: EAS_PROJECT_ID,
        platform: Platform.OS,
      });
      return;
    }

    const expoPushToken: string = tokenData.data;
    if (!expoPushToken) {
      reportError("push_token_empty", "getExpoPushTokenAsync returned empty token");
      return;
    }

    const alreadySent = await AsyncStorage.getItem(PUSH_TOKEN_SENT_KEY);
    if (alreadySent === expoPushToken) return;

    const deviceId = await getDeviceId();
    const ok = await callRegisterDevice(deviceId, expoPushToken);
    if (ok) {
      await AsyncStorage.setItem(PUSH_TOKEN_SENT_KEY, expoPushToken);
    }
  } catch (err: unknown) {
    reportError("push_token_unexpected", String(err));
  }
}

/**
 * Re-register the device token immediately after a successful login or
 * account creation, so the server can link the authenticated session's
 * user_id to the token row.
 *
 * Deliberately skips the AsyncStorage cache check — the token itself may
 * not have changed, but the session cookie is now present, so the server
 * needs another call to set user_id on the existing row.
 */
export async function linkPushTokenAfterAuth(authToken?: string | null): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const cachedToken = await AsyncStorage.getItem(PUSH_TOKEN_SENT_KEY);
    if (!cachedToken) return; // token was never registered — nothing to link

    const deviceId = await getDeviceId();
    await callRegisterDevice(deviceId, cachedToken, authToken);
    // No need to update the cache — the token string hasn't changed.
  } catch { /* non-fatal */ }
}
