import React from "react";
import { Linking, Platform } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { ProfileScreen, startWebGoogleRedirect } from "./ProfileScreen";

const mockGetToken = jest.fn();
const mockSetActive = jest.fn();
const mockSignInPassword = jest.fn();
const mockSignInFinalize = jest.fn();
const mockSignInCreate = jest.fn();
const mockClientSignInReload = jest.fn();
const mockBrowserGoogleFinalize = jest.fn();
const mockSendPasswordResetCode = jest.fn();
const mockVerifyPasswordResetCode = jest.fn();
const mockSubmitResetPassword = jest.fn();
const mockStartGoogleAuthenticationFlow = jest.fn();
const mockSignUpPassword = jest.fn();
const mockSendEmailCode = jest.fn();
const mockVerifyEmailCode = jest.fn();
const mockSignUpFinalize = jest.fn();
const mockSignOut = jest.fn();
let mockIsClerkLoaded = true;
let mockIsSignedIn = false;
let mockSessionId: string | null = null;
let mockUserId: string | null = null;
let mockExternalVerificationRedirectURL: URL | null = null;

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
  dismissBrowser: jest.fn(() => Promise.resolve()),
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("expo-auth-session", () => ({
  makeRedirectUri: jest.fn((options?: { scheme?: string; path?: string }) => (
    options?.scheme
      ? `${options.scheme}://${options.path ?? ""}`
      : `https://dt-tour.com${options?.path ? `/${options.path}` : ""}`
  )),
}));

jest.mock("@clerk/expo", () => ({
  useClerk: () => ({
    client: {
      signIn: {
        reload: mockClientSignInReload,
      },
    },
    setActive: mockSetActive,
  }),
  useAuth: () => ({
    getToken: (...args: unknown[]) => mockGetToken(...args),
    isLoaded: mockIsClerkLoaded,
    isSignedIn: mockIsSignedIn,
    sessionId: mockSessionId,
    userId: mockUserId,
    signOut: mockSignOut,
  }),
  useSignIn: () => ({
    signIn: {
      create: mockSignInCreate,
      resetPasswordEmailCode: {
        sendCode: mockSendPasswordResetCode,
        verifyCode: mockVerifyPasswordResetCode,
        submitPassword: mockSubmitResetPassword,
      },
      firstFactorVerification: {
        get externalVerificationRedirectURL() {
          return mockExternalVerificationRedirectURL;
        },
      },
      password: mockSignInPassword,
      status: "complete",
      finalize: mockSignInFinalize,
    },
  }),
  useSignUp: () => ({
    signUp: {
      password: mockSignUpPassword,
      status: "complete",
      verifications: {
        sendEmailCode: mockSendEmailCode,
        verifyEmailCode: mockVerifyEmailCode,
      },
      finalize: mockSignUpFinalize,
    },
  }),
}));

jest.mock("@clerk/expo/google", () => ({
  useSignInWithGoogle: () => ({
    startGoogleAuthenticationFlow: mockStartGoogleAuthenticationFlow,
  }),
}));

const booking = {
  orderId: "booking-123",
  rhOrderId: "hotel-456",
  status: "confirmed",
  isPaid: true,
  createdAt: "2026-09-01T10:00:00.000Z",
  hotelName: "Test Hotel",
  checkin: "2026-10-10",
  checkout: "2026-10-12",
  nights: "2",
  roomName: "Deluxe room",
  rooms: "1",
  totalKWD: "120.000",
  cancelBefore: "2026-10-08T23:59:59.000Z",
  canCancel: true,
};

const pendingPaymentBooking = {
  ...booking,
  orderId: "payment-789",
  rhOrderId: null,
  status: "pending_payment",
  isPaid: false,
  hotelName: "Payment Hotel",
  canCancel: false,
  cancelBefore: null,
};

function response(body: unknown, ok = true) {
  return {
    ok,
    json: jest.fn().mockResolvedValue(body),
  };
}

function installFetchMock() {
  const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/me")) {
      return Promise.resolve(response({ user: { id: 1 } }));
    }
    if (url.endsWith("/auth/profile")) {
      return Promise.resolve(response({
        ok: true,
        user: {
          id: 1,
          name: "Test Customer",
          email: "test@example.com",
          loyaltyTier: "new",
          pointsBalance: 20,
          bookingCount: 2,
        },
        bookings: [booking, pendingPaymentBooking],
      }));
    }
    if (url.endsWith("/loyalty/balance")) {
      return Promise.resolve(response({ ok: true, expiringSoonPoints: 0 }));
    }
    if (url.endsWith("/my-price-locks")) {
      return Promise.resolve(response({
        ok: true,
        locks: [{
          id: 88,
          hotelName: "Held Hotel",
          roomName: "Held room",
          checkin: "2026-11-01",
          checkout: "2026-11-03",
          nights: 2,
          lockedPriceKwd: "99.000",
          expiresAt: "2099-11-01T12:00:00.000Z",
          status: "active",
          guestToken: "guest-token",
        }],
      }));
    }
    if (url.endsWith("/hotel-booking/cancel")) {
      return Promise.resolve(response({ ok: true }));
    }
    if (url.endsWith("/auth/logout")) {
      return Promise.resolve(response({ ok: true }));
    }
    if (url.endsWith("/auth/clerk/exchange")) {
      return Promise.resolve(response({ ok: true, user: { id: 1 } }));
    }
    if (url.endsWith("/hotel-booking/retry-payment")) {
      return Promise.resolve(response({ ok: true, url: "https://payment.example/booking-123" }));
    }
    if (url.endsWith("/privacy/requests")) {
      return Promise.resolve(response({ ok: true }));
    }
    return Promise.resolve(response({}, false));
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function installSignedOutThenProfileFetch() {
  let authenticated = false;
  const fetchMock = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/auth/me")) {
      return Promise.resolve(response({ user: authenticated ? { id: 1 } : null }));
    }
    if (url.endsWith("/auth/clerk/exchange")) {
      authenticated = true;
      return Promise.resolve(response({ ok: true, user: { id: 1 } }));
    }
    if (url.endsWith("/auth/update-profile")) {
      return Promise.resolve(response({ ok: true }));
    }
    if (url.endsWith("/auth/profile")) {
      authenticated = true;
      return Promise.resolve(response({
        ok: true,
        user: {
          id: 1,
          name: "Test Customer",
          email: "test@example.com",
          loyaltyTier: "new",
          pointsBalance: 20,
          bookingCount: 0,
        },
        bookings: [],
      }));
    }
    if (url.endsWith("/loyalty/balance")) {
      return Promise.resolve(response({ ok: true, expiringSoonPoints: 0 }));
    }
    if (url.endsWith("/my-price-locks")) {
      return Promise.resolve(response({ ok: true, locks: [] }));
    }
    return Promise.resolve(response({}, false));
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return {
    fetchMock,
    authenticate: () => {
      authenticated = true;
    },
  };
}

describe("ProfileScreen Account actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsClerkLoaded = true;
    mockIsSignedIn = false;
    mockSessionId = null;
    mockUserId = null;
    mockExternalVerificationRedirectURL = null;
    mockGetToken.mockReset().mockResolvedValue(null);
    mockClientSignInReload.mockReset();
    mockBrowserGoogleFinalize.mockReset();
    mockSendPasswordResetCode.mockReset();
    mockVerifyPasswordResetCode.mockReset();
    mockSubmitResetPassword.mockReset();
    installFetchMock();
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: "cancel" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens the Account login screen when Clerk JS has not loaded", () => {
    mockIsClerkLoaded = false;

    const { getByText, queryByTestId } = render(<ProfileScreen language="en" />);

    expect(getByText("My Account")).toBeTruthy();
    expect(getByText("Login")).toBeTruthy();
    expect(queryByTestId("booking-details-booking-123")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("lets Google sign-in respond when sign-in is ready but account auth is still loading", async () => {
    const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
    mockIsClerkLoaded = false;
    mockSignInCreate.mockResolvedValue(undefined);

    const view = render(<ProfileScreen language="en" />);
    fireEvent.press(view.getByTestId("google-auth-button"));

    await waitFor(() => expect(mockSignInCreate).toHaveBeenCalledWith({
      strategy: "oauth_google",
      redirectUrl: "https://dt-tour.com/app/sso-callback",
    }));
    await waitFor(() => expect(view.getByText("Google sign-in redirect was not created")).toBeTruthy());
    platformReplacement.restore();
  });

  it("lets a customer reset a forgotten password by email code", async () => {
    const { authenticate } = installSignedOutThenProfileFetch();
    mockSignInCreate.mockResolvedValue({ error: null });
    mockSendPasswordResetCode.mockResolvedValue({ error: null });
    mockVerifyPasswordResetCode.mockResolvedValue({ error: null });
    mockSubmitResetPassword.mockImplementation(async () => {
      authenticate();
      return { error: null };
    });
    mockSignInFinalize.mockResolvedValue(undefined);

    const view = render(<ProfileScreen language="en" />);
    await waitFor(() => expect(view.getByTestId("forgot-password")).toBeTruthy());
    fireEvent.press(view.getByTestId("forgot-password"));
    fireEvent.changeText(view.getByTestId("password-reset-email"), "test@example.com");
    fireEvent.press(view.getByTestId("password-reset-submit"));

    await waitFor(() => expect(mockSignInCreate).toHaveBeenCalledWith({
      identifier: "test@example.com",
    }));
    expect(mockSendPasswordResetCode).toHaveBeenCalledTimes(1);
    fireEvent.changeText(view.getByTestId("password-reset-code"), "123456");
    fireEvent.changeText(view.getByTestId("password-reset-new-password"), "new-password");
    fireEvent.press(view.getByTestId("password-reset-submit"));

    await waitFor(() => expect(mockVerifyPasswordResetCode).toHaveBeenCalledWith({
      code: "123456",
    }));
    expect(mockSubmitResetPassword).toHaveBeenCalledWith({
      password: "new-password",
      signOutOfOtherSessions: true,
    });
    await waitFor(() => expect(view.getByText("Welcome, Test Customer")).toBeTruthy());
  });

  it("opens and closes booking details when a booking card is pressed", async () => {
    const { getAllByText, getByTestId, getByText, queryByText } = render(<ProfileScreen language="en" />);

    await waitFor(() => expect(getByTestId("booking-details-booking-123")).toBeTruthy());
    fireEvent.press(getByTestId("booking-details-booking-123"));

    expect(getByText("Booking details")).toBeTruthy();
    expect(getAllByText("Test Hotel")).toHaveLength(2);
    expect(getAllByText("hotel-456")).toHaveLength(2);

    fireEvent.press(getByTestId("booking-details-close"));
    expect(queryByText("Booking details")).toBeNull();
  });

  it("refreshes a synchronized session without remounting Account or repeating portal synchronization", async () => {
    const onAuthenticated = jest.fn();
    const { getByTestId, rerender } = render(
      <ProfileScreen language="en" sessionRefreshVersion={0} onAuthenticated={onAuthenticated} />,
    );

    await waitFor(() => expect(getByTestId("booking-details-booking-123")).toBeTruthy());
    expect(onAuthenticated).toHaveBeenCalledTimes(1);

    rerender(
      <ProfileScreen language="en" sessionRefreshVersion={1} onAuthenticated={onAuthenticated} />,
    );

    await waitFor(() => {
      const profileRequests = (global.fetch as jest.Mock).mock.calls.filter(
        ([input]) => String(input).endsWith("/auth/profile"),
      );
      expect(profileRequests).toHaveLength(2);
    });
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it("coalesces duplicate session refresh signals while the same account batch is running", async () => {
    let resolveProfile!: (value: ReturnType<typeof response>) => void;
    const pendingProfile = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveProfile = resolve;
    });
    const baseFetch = installFetchMock();
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/auth/profile")) return pendingProfile;
      return baseFetch(input, init);
    }) as unknown as typeof fetch;

    const view = render(<ProfileScreen language="en" sessionRefreshVersion={0} />);
    await waitFor(() => {
      const profileRequests = (global.fetch as jest.Mock).mock.calls.filter(
        ([input]) => String(input).endsWith("/auth/profile"),
      );
      expect(profileRequests).toHaveLength(1);
    });

    view.rerender(<ProfileScreen language="en" sessionRefreshVersion={1} />);
    view.rerender(<ProfileScreen language="en" sessionRefreshVersion={2} />);
    expect((global.fetch as jest.Mock).mock.calls.filter(
      ([input]) => String(input).endsWith("/auth/profile"),
    )).toHaveLength(1);

    await act(async () => {
      resolveProfile(response({
        ok: true,
        user: {
          id: 1,
          name: "Test Customer",
          email: "test@example.com",
          loyaltyTier: "new",
          pointsBalance: 20,
          bookingCount: 0,
        },
        bookings: [],
      }));
      await pendingProfile;
    });
    await waitFor(() => expect(view.getByText("Test Customer")).toBeTruthy());
  });

  it("ignores an old account profile response after Clerk switches sessions", async () => {
    mockIsSignedIn = true;
    mockSessionId = "session-a";
    mockUserId = "user-a";
    let resolveOldProfile!: (value: ReturnType<typeof response>) => void;
    const oldProfileResponse = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveOldProfile = resolve;
    });
    let oldProfileSignal: AbortSignal | undefined;
    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/me")) return Promise.resolve(response({ user: { id: 1 } }));
      if (url.endsWith("/auth/profile")) {
        if (mockSessionId === "session-a") {
          oldProfileSignal = init?.signal ?? undefined;
          return oldProfileResponse;
        }
        return Promise.resolve(response({
          ok: true,
          user: {
            id: 2,
            name: "Second Customer",
            email: "second@example.com",
            loyaltyTier: "silver",
            pointsBalance: 40,
            bookingCount: 0,
          },
          bookings: [],
        }));
      }
      if (url.endsWith("/loyalty/balance")) {
        return Promise.resolve(response({ ok: true, expiringSoonPoints: 0 }));
      }
      if (url.endsWith("/my-price-locks")) {
        return Promise.resolve(response({ ok: true, locks: [] }));
      }
      return Promise.resolve(response({}, false));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const view = render(<ProfileScreen language="en" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/profile"),
      expect.any(Object),
    ));

    mockSessionId = "session-b";
    mockUserId = "user-b";
    view.rerender(<ProfileScreen language="en" />);
    expect(oldProfileSignal?.aborted).toBe(true);
    await waitFor(() => expect(view.getByText("Second Customer")).toBeTruthy());

    await act(async () => {
      resolveOldProfile(response({
        ok: true,
        user: {
          id: 1,
          name: "First Customer",
          email: "first@example.com",
          loyaltyTier: "gold",
          pointsBalance: 999,
          bookingCount: 1,
        },
        bookings: [booking],
      }));
      await Promise.resolve();
    });

    expect(view.queryByText("First Customer")).toBeNull();
    expect(view.queryByTestId("booking-details-booking-123")).toBeNull();
    expect(view.getByText("Second Customer")).toBeTruthy();
  });

  it("clears account data immediately when Clerk signs out during a request", async () => {
    mockIsSignedIn = true;
    mockSessionId = "session-a";
    mockUserId = "user-a";
    let holdSignedOutMe = false;
    let resolveSignedOutMe!: (value: ReturnType<typeof response>) => void;
    const signedOutMeResponse = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveSignedOutMe = resolve;
    });
    const baseFetch = installFetchMock();
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (holdSignedOutMe && String(input).endsWith("/auth/me")) return signedOutMeResponse;
      return baseFetch(input, init);
    }) as unknown as typeof fetch;

    const view = render(<ProfileScreen language="en" />);
    await waitFor(() => expect(view.getByText("Test Customer")).toBeTruthy());
    expect(view.getByTestId("booking-details-booking-123")).toBeTruthy();

    holdSignedOutMe = true;
    mockIsSignedIn = false;
    mockSessionId = null;
    mockUserId = null;
    view.rerender(<ProfileScreen language="en" />);

    expect(view.queryByText("Test Customer")).toBeNull();
    expect(view.queryByTestId("booking-details-booking-123")).toBeNull();

    await act(async () => {
      resolveSignedOutMe(response({ user: null }));
      await Promise.resolve();
    });
  });

  it("aborts an old account privacy request after Clerk switches sessions", async () => {
    mockIsSignedIn = true;
    mockSessionId = "session-a";
    mockUserId = "user-a";
    let resolvePrivacyRequest!: (value: ReturnType<typeof response>) => void;
    const privacyResponse = new Promise<ReturnType<typeof response>>((resolve) => {
      resolvePrivacyRequest = resolve;
    });
    let privacySignal: AbortSignal | undefined;
    const baseFetch = installFetchMock();
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/privacy/requests")) {
        privacySignal = init?.signal ?? undefined;
        return privacyResponse;
      }
      return baseFetch(input, init);
    }) as unknown as typeof fetch;

    const view = render(<ProfileScreen language="en" />);
    await waitFor(() => expect(view.getByTestId("privacy-request-export")).toBeTruthy());
    fireEvent.press(view.getByTestId("privacy-request-export"));
    await waitFor(() => expect(privacySignal).toBeDefined());

    mockSessionId = "session-b";
    mockUserId = "user-b";
    view.rerender(<ProfileScreen language="en" />);
    expect(privacySignal?.aborted).toBe(true);
    await act(async () => {
      resolvePrivacyRequest(response({ ok: true }));
      await Promise.resolve();
    });

    expect(view.queryByText(
      "Your data-copy request was received. We will process it after verification where needed.",
    )).toBeNull();
  });

  it.each([
    {
      name: "booking cancellation",
      endpoint: "/hotel-booking/cancel",
      start: (view: ReturnType<typeof render>) => {
        fireEvent.press(view.getByTestId("cancel-booking-booking-123"));
        fireEvent.press(view.getByTestId("confirm-cancel-booking"));
      },
    },
    {
      name: "payment retry",
      endpoint: "/hotel-booking/retry-payment",
      start: (view: ReturnType<typeof render>) => {
        fireEvent.press(view.getByTestId("continue-payment-payment-789"));
      },
    },
  ])("aborts an old account $name after Clerk signs out", async ({ endpoint, start }) => {
    mockIsSignedIn = true;
    mockSessionId = "session-a";
    mockUserId = "user-a";
    const pendingMutation = new Promise<ReturnType<typeof response>>(() => {});
    let mutationSignal: AbortSignal | undefined;
    const baseFetch = installFetchMock();
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith(endpoint)) {
        mutationSignal = init?.signal ?? undefined;
        return pendingMutation;
      }
      return baseFetch(input, init);
    }) as unknown as typeof fetch;

    const view = render(<ProfileScreen language="en" />);
    await waitFor(() => expect(view.getByTestId("booking-details-booking-123")).toBeTruthy());
    start(view);
    await waitFor(() => expect(mutationSignal).toBeDefined());

    mockIsSignedIn = false;
    mockSessionId = null;
    mockUserId = null;
    view.rerender(<ProfileScreen language="en" />);

    expect(mutationSignal?.aborted).toBe(true);
  });

  it("keeps payment, cancellation, support, and sign-out actions reachable", async () => {
    const onLoggedOut = jest.fn();
    const onOpenHotelPortal = jest.fn();
    const { getByTestId, getByText } = render(
      <ProfileScreen language="en" onLoggedOut={onLoggedOut} onOpenHotelPortal={onOpenHotelPortal} />,
    );

    await waitFor(() => expect(getByTestId("booking-details-booking-123")).toBeTruthy());

    fireEvent.press(getByTestId("booking-details-booking-123"));
    fireEvent.press(getByTestId("booking-details-support"));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining("booking-123"));
    fireEvent.press(getByTestId("booking-details-done"));

    fireEvent.press(getByTestId("account-support"));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining("my%20account"));

    fireEvent.press(getByTestId("continue-price-lock-88"));
    expect(onOpenHotelPortal).toHaveBeenCalledWith(expect.stringContaining("resumeLock=88"));

    fireEvent.press(getByTestId("cancel-booking-booking-123"));
    fireEvent.press(getByTestId("confirm-cancel-booking"));
    await waitFor(() => expect(getByText("Booking cancelled")).toBeTruthy());

    fireEvent.press(getByTestId("account-sign-out"));
    await waitFor(() => expect(onLoggedOut).toHaveBeenCalledTimes(1));
  });

  it("lets Account update the hotel price display controls with an immediate preview", async () => {
    const onHotelDisplayPreferencesChange = jest.fn();
    const { getByTestId, getByText, rerender } = render(
      <ProfileScreen language="en" onHotelDisplayPreferencesChange={onHotelDisplayPreferencesChange} />,
    );

    await waitFor(() => expect(getByTestId("account-settings-entry")).toBeTruthy());
    fireEvent.press(getByTestId("account-settings-entry"));
    expect(getByTestId("hotel-price-display-settings")).toBeTruthy();
    fireEvent.press(getByTestId("price-display-total-stay"));
    expect(onHotelDisplayPreferencesChange).toHaveBeenCalledWith({
      priceDisplay: "total-stay",
      currency: "KWD",
    });
    rerender(
      <ProfileScreen
        language="en"
        hotelDisplayPreferences={{ priceDisplay: "total-stay", currency: "KWD" }}
        onHotelDisplayPreferencesChange={onHotelDisplayPreferencesChange}
      />,
    );
    fireEvent.press(getByTestId("hotel-currency-USD"));
    expect(onHotelDisplayPreferencesChange).toHaveBeenLastCalledWith({
      priceDisplay: "total-stay",
      currency: "USD",
    });
    expect(getByText("KWD 10.000")).toBeTruthy();
    expect(getByText("Total stay · Display only")).toBeTruthy();
    fireEvent.press(getByTestId("account-settings-back"));
    expect(getByTestId("account-settings-entry")).toBeTruthy();
  });

  it("starts the native payment continuation without opening the booking details sheet", async () => {
    const fetchMock = installFetchMock();
    const { getByTestId, queryByTestId } = render(<ProfileScreen language="en" />);

    await waitFor(() => expect(getByTestId("booking-details-booking-123")).toBeTruthy());
    fireEvent.press(getByTestId("continue-payment-payment-789"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/hotel-booking/retry-payment"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ orderId: "payment-789", source: "native" }),
      }),
    ));
    expect(queryByTestId("booking-details-close")).toBeNull();
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      "https://payment.example/booking-123",
      "dttours://hotel-payment-return",
    );
  });

  it("sends authenticated privacy export and deletion requests after confirmation", async () => {
    mockGetToken.mockResolvedValue("privacy-clerk-token");
    const fetchMock = installFetchMock();
    const { getByTestId, getByText, getAllByText } = render(<ProfileScreen language="en" />);

    await waitFor(() => expect(getByTestId("privacy-requests-section")).toBeTruthy());
    fireEvent.press(getByTestId("privacy-request-export"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/privacy/requests"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ type: "access" }),
      }),
    ));
    await waitFor(() => expect(getByText("Your data-copy request was received. We will process it after verification where needed.")).toBeTruthy());

    fireEvent.press(getByTestId("privacy-request-delete"));
    expect(getAllByText("Request account deletion").length).toBeGreaterThan(0);
    expect(getByText(/Booking, payment, refund, legal, and legal-hold records may be protected/)).toBeTruthy();
    fireEvent.press(getByTestId("confirm-privacy-delete"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/privacy/requests"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ type: "deletion" }),
      }),
    ));
    expect(getByText("We sent a verification link to your account email. Deletion will not start until you open it and confirm the request.")).toBeTruthy();
    const privacyCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith("/privacy/requests"),
    );
    expect(privacyCalls).toHaveLength(2);
    for (const [, init] of privacyCalls) {
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer privacy-clerk-token",
      );
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
    }
  });

  it("returns from Google through the installed-app scheme and exchanges the Clerk session", async () => {
    const onClose = jest.fn();
    let authenticated = false;
    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/me")) {
        return Promise.resolve(response({ user: authenticated ? { id: 1 } : null }));
      }
      if (url.endsWith("/auth/clerk/exchange")) {
        authenticated = true;
        return Promise.resolve(response({ ok: true, user: { id: 1 } }));
      }
      if (url.endsWith("/auth/profile")) {
        return Promise.resolve(response({
          ok: true,
          user: {
            id: 1,
            name: "Test Customer",
            email: "test@example.com",
            loyaltyTier: "new",
            pointsBalance: 20,
            bookingCount: 2,
          },
          bookings: [booking],
        }));
      }
      if (url.endsWith("/loyalty/balance")) {
        return Promise.resolve(response({ ok: true, expiringSoonPoints: 0 }));
      }
      if (url.endsWith("/my-price-locks")) {
        return Promise.resolve(response({ ok: true, locks: [] }));
      }
      return Promise.resolve(response({}, false));
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    mockStartGoogleAuthenticationFlow.mockResolvedValue({
      createdSessionId: "sess_google",
      setActive: mockSetActive,
    });
    mockSetActive.mockResolvedValue(undefined);
    mockGetToken.mockResolvedValue("clerk-session-token");

    const { getByTestId, getByText } = render(
      <ProfileScreen language="en" onClose={onClose} />,
    );
    await waitFor(() => expect(getByTestId("google-auth-button")).toBeTruthy());
    fireEvent.press(getByTestId("google-auth-button"));

    await waitFor(() => expect(mockStartGoogleAuthenticationFlow).toHaveBeenCalledTimes(1));
    expect(mockSetActive).toHaveBeenCalledWith({ session: "sess_google" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/clerk/exchange"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { Authorization: "Bearer clerk-session-token" },
      }),
    );
    await waitFor(() => expect(getByTestId("booking-details-booking-123")).toBeTruthy());
    await waitFor(() => expect(getByText("Welcome, Test Customer")).toBeTruthy());
    fireEvent.press(getByTestId("welcome-continue"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("falls back to browser OAuth when Android reports account reauth status 16", async () => {
    const platformReplacement = jest.replaceProperty(Platform, "OS", "android");
    installSignedOutThenProfileFetch();
    mockStartGoogleAuthenticationFlow.mockRejectedValue(
      new Error("[16] Account reauth failed."),
    );
    mockExternalVerificationRedirectURL = new URL(
      "https://accounts.google.com/o/oauth2/auth?client_id=test",
    );
    mockSignInCreate.mockResolvedValue({ error: null });
    mockBrowserGoogleFinalize.mockResolvedValue({ error: null });
    mockClientSignInReload.mockResolvedValue({
      __internal_future: {
        firstFactorVerification: { status: "verified" },
        createdSessionId: "sess_browser_fallback",
        finalize: mockBrowserGoogleFinalize,
      },
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: "success",
      url: "dttours://?rotating_token_nonce=nonce-16",
    });
    mockSetActive.mockResolvedValue(undefined);
    mockGetToken.mockResolvedValue("fallback-clerk-token");

    const view = render(<ProfileScreen language="en" />);
    await waitFor(() => expect(view.getByTestId("google-auth-button")).toBeTruthy());
    fireEvent.press(view.getByTestId("google-auth-button"));

    await waitFor(() => expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      mockExternalVerificationRedirectURL.toString(),
      "dttours://sso-callback",
    ));
    expect(mockClientSignInReload).toHaveBeenCalledWith({
      rotatingTokenNonce: "nonce-16",
    });
    expect(mockSetActive).toHaveBeenCalledWith({
      session: "sess_browser_fallback",
    });
    await waitFor(() => expect(view.getByText("Welcome, Test Customer")).toBeTruthy());
    platformReplacement.restore();
  });


  it("shows the named welcome before password login continues to native Home", async () => {
    const onClose = jest.fn();
    const onLoginSuccess = jest.fn();
    const { authenticate } = installSignedOutThenProfileFetch();
    mockSignInPassword.mockResolvedValue({ error: null });
    mockSignInFinalize.mockImplementation(async () => {
      authenticate();
    });

    const view = render(
      <ProfileScreen
        language="en"
        onClose={onClose}
        onLoginSuccess={onLoginSuccess}
      />,
    );
    await waitFor(() => expect(view.getByText("Sign In")).toBeTruthy());
    fireEvent.changeText(view.getByPlaceholderText("name@example.com"), "test@example.com");
    fireEvent.changeText(view.getByPlaceholderText("Enter your password"), "password");
    fireEvent.press(view.getByText("Sign In"));

    await waitFor(() => expect(view.getByText("Welcome, Test Customer")).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
    expect(onLoginSuccess).not.toHaveBeenCalled();
    fireEvent.press(view.getByTestId("welcome-continue"));
    expect(onLoginSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the named welcome before verified email registration continues to native Home", async () => {
    const onClose = jest.fn();
    installSignedOutThenProfileFetch();
    mockSignUpPassword.mockResolvedValue({ error: null });
    mockSendEmailCode.mockResolvedValue(undefined);
    mockVerifyEmailCode.mockResolvedValue(undefined);
    mockSignUpFinalize.mockResolvedValue(undefined);

    const view = render(<ProfileScreen language="en" onClose={onClose} />);
    await waitFor(() => expect(view.getByText("Register")).toBeTruthy());
    fireEvent.press(view.getByText("Register"));
    fireEvent.changeText(view.getByPlaceholderText("Enter your full name"), "Test Customer");
    fireEvent.changeText(view.getByPlaceholderText("name@example.com"), "test@example.com");
    fireEvent.changeText(view.getByPlaceholderText("Enter your password"), "password");
    fireEvent.press(view.getByText("Create Account"));
    await waitFor(() => expect(view.getByTestId("clerk-verification-code")).toBeTruthy());
    fireEvent.changeText(view.getByTestId("clerk-verification-code"), "123456");
    fireEvent.press(view.getByTestId("clerk-verification-submit"));

    await waitFor(() => expect(view.getByText("Welcome, Test Customer")).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.press(view.getByTestId("welcome-continue"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("starts web Google sign-in with a full-page redirect to the callback route", async () => {
    const navigate = jest.fn();
    const create = jest.fn().mockResolvedValue(undefined);
    const externalVerificationRedirectURL = new URL(
      "https://accounts.google.com/o/oauth2/auth?client_id=test",
    );

    await startWebGoogleRedirect(
      {
        create,
        firstFactorVerification: { externalVerificationRedirectURL },
      },
      "https://dt-tour.com/app/sso-callback",
      navigate,
    );

    expect(create).toHaveBeenCalledWith({
      strategy: "oauth_google",
      redirectUrl: "https://dt-tour.com/app/sso-callback",
    });
    expect(navigate).toHaveBeenCalledWith(externalVerificationRedirectURL.toString());
  });

  it("reconciles the local profile when the web Clerk session completes after the OAuth return", async () => {
    const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
    mockIsSignedIn = false;
    mockGetToken.mockResolvedValue(null);
    const baseFetch = installFetchMock();
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/auth/me")) {
        const headers = new Headers(init?.headers);
        const authenticated = headers.get("Authorization") === "Bearer returned-clerk-token";
        return Promise.resolve(response({ user: authenticated ? { id: 1 } : null }));
      }
      return baseFetch(input, init);
    }) as unknown as typeof fetch;

    const view = render(<ProfileScreen language="en" />);
    await waitFor(() => expect(view.getByTestId("google-auth-button")).toBeTruthy());

    mockIsSignedIn = true;
    mockGetToken.mockResolvedValue("returned-clerk-token");
    view.rerender(<ProfileScreen language="en" />);

    await waitFor(() => expect(view.getByText("Test Customer")).toBeTruthy());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me"),
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    platformReplacement.restore();
  });

  it("returns web sign-out to /app instead of the public homepage", async () => {
    const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
    mockIsSignedIn = true;

    const { getByTestId } = render(<ProfileScreen language="en" />);
    await waitFor(() => expect(getByTestId("account-sign-out")).toBeTruthy());
    fireEvent.press(getByTestId("account-sign-out"));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({
      redirectUrl: "https://dt-tour.com/app",
    }));
    expect(AuthSession.makeRedirectUri).toHaveBeenCalledWith({ path: "app" });
    platformReplacement.restore();
  });
});
