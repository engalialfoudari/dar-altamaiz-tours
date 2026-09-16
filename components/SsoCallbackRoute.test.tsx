import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import SsoCallbackRoute, {
  completeExistingWebGoogleSession,
  completeNativeGoogleCallback,
  completeWebGoogleCallback,
} from "../app/sso-callback";

const mockRedirect = jest.fn(() => null);
const mockRouterReplace = jest.fn();
const mockSetActive = jest.fn();
const mockGetToken = jest.fn();
let mockSessionId: string | null = null;
const mockSignInReload = jest.fn();
const mockSignUpCreate = jest.fn();
const mockSignIn = {
  reload: mockSignInReload,
  firstFactorVerification: { status: "complete" },
  createdSessionId: "sess_google_web",
};
const mockSignUp = {
  create: mockSignUpCreate,
  createdSessionId: null,
};
let mockLocalSearchParams: Record<string, string> = {};

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("@clerk/expo", () => ({
  useAuth: () => ({ getToken: mockGetToken, sessionId: mockSessionId }),
  useClerk: () => ({
    client: { signIn: { reload: mockSignInReload } },
    setActive: mockSetActive,
  }),
  useSignIn: () => ({ signIn: mockSignIn }),
  useSignUp: () => ({ signUp: mockSignUp }),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => ({ replace: mockRouterReplace }),
}));

describe("SSO callback route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionId = null;
    mockLocalSearchParams = {};
  });

  it("completes and activates the Clerk session for a native callback", async () => {
    const finalize = jest.fn().mockResolvedValue({ error: null });
    const reloadSignIn = jest.fn().mockResolvedValue({
      __internal_future: {
        firstFactorVerification: { status: "verified" },
        createdSessionId: "sess_google_native",
        finalize,
      },
    });
    const setActive = jest.fn().mockResolvedValue(undefined);
    const getToken = jest.fn().mockResolvedValue("native-clerk-token");
    const exchange = jest.fn().mockResolvedValue({ name: "Google Customer" });

    const result = await completeNativeGoogleCallback({
      rotatingTokenNonce: "native-nonce",
      reloadSignIn,
      signUp: mockSignUp,
      setActive,
      getToken,
      exchange,
    });

    expect(reloadSignIn).toHaveBeenCalledWith({ rotatingTokenNonce: "native-nonce" });
    expect(finalize).toHaveBeenCalled();
    expect(setActive).toHaveBeenCalledWith({ session: "sess_google_native" });
    expect(exchange).toHaveBeenCalledWith("native-clerk-token");
    expect(result).toEqual({ name: "Google Customer" });
  });

  it("completes the Clerk redirect nonce and activates a transferable Google session", async () => {
    const signIn = {
      reload: jest.fn().mockResolvedValue(undefined),
      firstFactorVerification: { status: "transferable" },
      createdSessionId: null,
    };
    const signUp = {
      create: jest.fn().mockResolvedValue(undefined),
      createdSessionId: "sess_google_web",
    };
    const setActive = jest.fn().mockResolvedValue(undefined);
    const getToken = jest.fn().mockResolvedValue("web-clerk-token");
    const exchange = jest.fn().mockResolvedValue({ name: "Google Customer" });

    const result = await completeWebGoogleCallback({
      rotatingTokenNonce: "nonce-from-clerk",
      signIn,
      signUp,
      setActive,
      getToken,
      exchange,
    });

    expect(signIn.reload).toHaveBeenCalledWith({
      rotatingTokenNonce: "nonce-from-clerk",
    });
    expect(signUp.create).toHaveBeenCalledWith({ transfer: true });
    expect(setActive).toHaveBeenCalledWith({ session: "sess_google_web" });
    expect(exchange).toHaveBeenCalledWith("web-clerk-token");
    expect(result).toEqual({ name: "Google Customer" });
  });

  it("accepts the active Clerk session when the web callback has no rotating nonce", async () => {
    const getToken = jest.fn().mockResolvedValue("active-web-clerk-token");
    const exchange = jest.fn().mockResolvedValue({ name: "Google Customer" });

    const result = await completeExistingWebGoogleSession({ getToken, exchange });

    expect(exchange).toHaveBeenCalledWith("active-web-clerk-token");
    expect(result).toEqual({ name: "Google Customer" });
  });

  it("shows the named welcome before web Google continues directly to Home", async () => {
    const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { search: "?rotating_token_nonce=nonce" },
    });
    mockSignInReload.mockResolvedValue(undefined);
    mockSetActive.mockResolvedValue(undefined);
    mockGetToken.mockResolvedValue("web-clerk-token");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        ok: true,
        user: { name: "Google Customer" },
      }),
    }) as unknown as typeof fetch;

    const view = render(<SsoCallbackRoute />);
    await waitFor(() => expect(view.getByText("Welcome, Google Customer")).toBeTruthy());
    expect(mockRouterReplace).not.toHaveBeenCalled();
    fireEvent.press(view.getByTestId("web-sso-continue"));
    expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: "/",
      params: { postAuth: "home" },
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    platformReplacement.restore();
  });

  it("opens Home automatically when the customer leaves the welcome untouched", async () => {
    const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { search: "?rotating_token_nonce=nonce" },
    });
    mockSignInReload.mockResolvedValue(undefined);
    mockSetActive.mockResolvedValue(undefined);
    mockGetToken.mockResolvedValue("web-clerk-token");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        ok: true,
        user: { name: "Google Customer" },
      }),
    }) as unknown as typeof fetch;

    const view = render(<SsoCallbackRoute />);
    await waitFor(() => expect(view.getByText("Welcome, Google Customer")).toBeTruthy());
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: "/",
      params: { postAuth: "home" },
    }), { timeout: 4_000 });

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    platformReplacement.restore();
  });

  it("keeps completing when Clerk publishes the newly activated session", async () => {
    const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { search: "?rotating_token_nonce=nonce" },
    });
    mockSignInReload.mockResolvedValue(undefined);
    mockSetActive.mockImplementation(async ({ session }: { session: string }) => {
      mockSessionId = session;
    });
    mockGetToken.mockResolvedValue("web-clerk-token");
    let resolveExchange!: (value: {
      ok: boolean;
      json: () => Promise<{ ok: boolean; user: { name: string } }>;
    }) => void;
    global.fetch = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolveExchange = resolve;
    })) as unknown as typeof fetch;

    const view = render(<SsoCallbackRoute />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    view.rerender(<SsoCallbackRoute />);
    const request = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(request.signal?.aborted).toBe(false);

    resolveExchange({
      ok: true,
      json: async () => ({ ok: true, user: { name: "Google Customer" } }),
    });
    await waitFor(() => expect(view.getByText("Welcome, Google Customer")).toBeTruthy());

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    platformReplacement.restore();
  });

  it("aborts an abandoned exchange and ignores its late completion", async () => {
    const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { search: "?rotating_token_nonce=nonce" },
    });
    mockSignInReload.mockResolvedValue(undefined);
    mockSetActive.mockResolvedValue(undefined);
    mockGetToken.mockResolvedValue("web-clerk-token");
    let resolveExchange!: (value: {
      ok: boolean;
      json: () => Promise<{ ok: boolean; user: { name: string } }>;
    }) => void;
    const exchangeResponse = new Promise<{
      ok: boolean;
      json: () => Promise<{ ok: boolean; user: { name: string } }>;
    }>((resolve) => {
      resolveExchange = resolve;
    });
    const originalSessionStorage = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    const removeItem = jest.fn();
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: { getItem: jest.fn(() => null), removeItem },
    });
    global.fetch = jest.fn().mockReturnValue(exchangeResponse) as unknown as typeof fetch;

    const view = render(<SsoCallbackRoute />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const request = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(request.signal?.aborted).toBe(false);

    view.unmount();
    expect(request.signal?.aborted).toBe(true);
    resolveExchange({
      ok: true,
      json: async () => ({ ok: true, user: { name: "Late Customer" } }),
    });
    await exchangeResponse;
    await Promise.resolve();

    expect(removeItem).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();

    if (originalSessionStorage) {
      Object.defineProperty(window, "sessionStorage", originalSessionStorage);
    } else {
      delete (window as typeof window & { sessionStorage?: Storage }).sessionStorage;
    }
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    platformReplacement.restore();
  });
});