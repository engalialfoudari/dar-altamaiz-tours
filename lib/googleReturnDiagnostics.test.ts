import { Platform } from "react-native";
import { reportGoogleReturnFailure } from "./googleReturnDiagnostics";
import type { GoogleReturnDiagnostic } from "./nativeGoogleBrowser";

jest.mock("expo-updates", () => ({
  updateId: "01a1c6e6-c54a-710d-978b-8c29006460c9",
  isEmbeddedLaunch: false,
}));

const diagnostic: GoogleReturnDiagnostic = {
  outcome: "returned_without_callback", callbackCount: 1,
  lastCallbackStatus: "missing_proof", browserOpened: true,
  leftApp: true, returnedToApp: true, elapsedMs: 10_000,
};

beforeEach(() => {
  jest.replaceProperty(Platform, "OS", "android");
  jest.spyOn(global, "fetch").mockResolvedValue({ ok: true } as Response);
});
afterEach(() => jest.restoreAllMocks());

it("records only coarse failure facts and the loaded update, never raw callback data", () => {
  reportGoogleReturnFailure("https://api.example.test/api/", {
    ...diagnostic,
    url: "dttours://sso-callback?rotating_token_nonce=private-proof",
    email: "private@example.test",
    token: "private-token",
  } as GoogleReturnDiagnostic);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith("https://api.example.test/api/logs", expect.anything());
  const options = jest.mocked(fetch).mock.calls[0][1]!;
  const body = JSON.parse(options.body as string);
  expect(body.context).toEqual({
    ...diagnostic, source: "android_google_browser_return", diagnosticVersion: 1,
    updateId: "01a1c6e6-c54a-710d-978b-8c29006460c9", isEmbeddedLaunch: false,
  });
  expect(JSON.stringify(body)).not.toMatch(/private|rotating_token_nonce|email|token/);
  expect(options.headers).toEqual({ "Content-Type": "application/json" });
});

it("sanitizes unexpected runtime values rather than trusting a TypeScript type", () => {
  reportGoogleReturnFailure("https://api.example.test/api", {
    ...diagnostic,
    outcome: "private-token", lastCallbackStatus: "private-email",
    callbackCount: Infinity, elapsedMs: -1,
  } as unknown as GoogleReturnDiagnostic);
  const body = JSON.parse(jest.mocked(fetch).mock.calls[0][1]!.body as string);
  expect(body.context).toMatchObject({
    outcome: "unknown", lastCallbackStatus: "unknown", callbackCount: 0, elapsedMs: 0,
  });
  expect(JSON.stringify(body)).not.toContain("private");
});

it("does not report on iOS or web", () => {
  for (const platform of ["ios", "web"] as const) {
    jest.replaceProperty(Platform, "OS", platform);
    reportGoogleReturnFailure("https://api.example.test/api", diagnostic);
  }
  expect(fetch).not.toHaveBeenCalled();
});

it("ignores network failures", async () => {
  jest.mocked(fetch).mockRejectedValue(new Error("Offline"));
  expect(() => reportGoogleReturnFailure("https://api.example.test/api", diagnostic)).not.toThrow();
  await Promise.resolve();
});
