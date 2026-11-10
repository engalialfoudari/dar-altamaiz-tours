import { AppState, Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { waitForNativeGoogleReturn } from "./nativeGoogleBrowser";

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
  openBrowserAsync: jest.fn(),
  dismissBrowser: jest.fn(() => Promise.resolve()),
}));

const authorizationUrl = "https://accounts.example.test/authorize";
const redirectUrl = "dttours://sso-callback";
const callback = `${redirectUrl}?rotating_token_nonce=one-use-proof`;
let receive: (event: { url: string }) => void;
let remove: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.replaceProperty(Platform, "OS", "ios");
  remove = jest.fn();
  jest.spyOn(Linking, "addEventListener").mockImplementation((_event, listener) => {
    receive = listener;
    return { remove };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it.each(["dismiss", "cancel"])("accepts a delayed Android callback after browser %s", async type => {
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({ type } as WebBrowser.WebBrowserAuthSessionResult);
  const result = waitForNativeGoogleReturn(authorizationUrl, redirectUrl);
  await Promise.resolve();
  jest.advanceTimersByTime(700);
  receive({ url: callback });
  await expect(result).resolves.toBe(callback);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it("accepts the equivalent Android triple-slash callback", async () => {
  jest.mocked(WebBrowser.openAuthSessionAsync).mockImplementation(() => new Promise(() => {}));
  const result = waitForNativeGoogleReturn(authorizationUrl, redirectUrl);
  const url = "dttours:///sso-callback?rotating_token_nonce=one-use-proof";
  receive({ url });
  await expect(result).resolves.toBe(url);
});

it("treats closing Google as cancellation, not a sign-in timeout", async () => {
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({ type: "cancel" });
  const result = waitForNativeGoogleReturn(authorizationUrl, redirectUrl);
  await Promise.resolve();
  jest.advanceTimersByTime(1_500);
  await expect(result).resolves.toBeNull();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it("ignores wrong routes, schemes, and callbacks without the one-use proof", async () => {
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({ type: "dismiss" });
  const result = waitForNativeGoogleReturn(authorizationUrl, redirectUrl);
  receive({ url: "other://sso-callback?rotating_token_nonce=wrong" });
  receive({ url: "dttours://sso-callback-attacker?rotating_token_nonce=wrong" });
  receive({ url: redirectUrl });
  await Promise.resolve();
  jest.advanceTimersByTime(1_500);
  await expect(result).resolves.toBeNull();
});

it("still rejects a genuine timeout and removes the URL listener", async () => {
  jest.mocked(WebBrowser.openAuthSessionAsync).mockImplementation(() => new Promise(() => {}));
  const result = waitForNativeGoogleReturn(authorizationUrl, redirectUrl, 2_000);
  const assertion = expect(result).rejects.toThrow("Google sign-in timed out");
  jest.advanceTimersByTime(2_000);
  await assertion;
  expect(remove).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it("rejects an invalid browser success rather than consuming unrelated credentials", async () => {
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
    type: "success", url: "dttours://?rotating_token_nonce=wrong-route",
  });
  await expect(waitForNativeGoogleReturn(authorizationUrl, redirectUrl)).rejects.toThrow("valid sign-in response");
  expect(remove).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it("cleans up when the browser cannot open", async () => {
  jest.mocked(WebBrowser.openAuthSessionAsync).mockRejectedValue(new Error("Browser unavailable"));
  await expect(waitForNativeGoogleReturn(authorizationUrl, redirectUrl)).rejects.toThrow("Browser unavailable");
  expect(remove).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

describe("Android Custom Tab lifecycle", () => {
  let stateChanged: (state: "active" | "background") => void;
  let removeState: jest.Mock;
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "android");
    removeState = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
      stateChanged = listener;
      return { remove: removeState };
    });
    jest.mocked(WebBrowser.openBrowserAsync).mockResolvedValue({ type: "opened" } as WebBrowser.WebBrowserResult);
  });

  it("ignores a stale active event from the native picker while Google is still open", async () => {
    const result = waitForNativeGoogleReturn(authorizationUrl, redirectUrl);
    await Promise.resolve();
    stateChanged("active");
    jest.advanceTimersByTime(20_000);
    receive({ url: callback });
    await expect(result).resolves.toBe(callback);
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
    expect(removeState).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("accepts a verified callback more than 1.5 seconds after a real return", async () => {
    const result = waitForNativeGoogleReturn(authorizationUrl, redirectUrl);
    stateChanged("background");
    await Promise.resolve();
    stateChanged("active");
    jest.advanceTimersByTime(6_000);
    receive({ url: callback });
    await expect(result).resolves.toBe(callback);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("cancels after a real browser exit without activating an account", async () => {
    const result = waitForNativeGoogleReturn(authorizationUrl, redirectUrl);
    await Promise.resolve();
    stateChanged("background");
    stateChanged("active");
    jest.advanceTimersByTime(10_000);
    await expect(result).resolves.toBeNull();
    expect(removeState).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("stops the cancellation timer if Google takes the app back into the background", async () => {
    const result = waitForNativeGoogleReturn(authorizationUrl, redirectUrl);
    await Promise.resolve();
    stateChanged("background");
    stateChanged("active");
    jest.advanceTimersByTime(1_000);
    stateChanged("background");
    jest.advanceTimersByTime(15_000);
    receive({ url: callback });
    await expect(result).resolves.toBe(callback);
  });

  it("rejects unrelated callbacks and still bounds an abandoned flow", async () => {
    const result = waitForNativeGoogleReturn(authorizationUrl, redirectUrl, 30_000);
    const assertion = expect(result).rejects.toThrow("timed out");
    await Promise.resolve();
    receive({ url: redirectUrl });
    receive({ url: "other://sso-callback?rotating_token_nonce=wrong" });
    jest.advanceTimersByTime(30_000);
    await assertion;
    expect(removeState).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
