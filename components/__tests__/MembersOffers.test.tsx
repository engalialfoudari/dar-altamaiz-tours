import React from "react";
import { Animated, Image, Platform } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { renderHook, act } from "@testing-library/react-native";
import { LuxuryHome } from "../LuxuryHome";
import { MembersOffersScreen, useCountdown } from "../MembersOffersScreen";
import HomeScreen from "../../app/(tabs)/index";

const mockGetToken = jest.fn();
const mockAuthState = {
  getToken: mockGetToken,
  isSignedIn: true,
  isLoaded: true,
  sessionId: "session-a",
  userId: "user-a",
};

const makeOffer = (id: number, code: string) => ({
  id,
  code,
  discountPct: 10,
  maxUsesTotal: null,
  usesCount: 0,
  startsAt: null,
  endsAt: null,
  destinationCountry: null,
  destinationRegion: null,
  destinationCity: null,
  targetHotelId: null,
  targetHotelName: null,
  imageUrl: null,
  titleEn: code,
  titleAr: code,
  descriptionEn: null,
  descriptionAr: null,
  state: "active" as const,
  available: true,
});

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
}));

jest.mock("@clerk/expo", () => ({
  useAuth: () => mockAuthState,
  useClerk: () => ({ signOut: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ postAuth: "home" }),
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

jest.mock("@/utils/notifications", () => ({
  scheduleRetentionNotifications: jest.fn(),
}));

jest.mock("@/lib/cartContext", () => ({
  useCart: () => ({ addItems: jest.fn() }),
}));

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    WebView: React.forwardRef((props: object, _ref: unknown) => <View {...props} />),
  };
});

jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return new Proxy({}, {
    get: () => View,
  });
});

jest.mock("@/components/ProfileScreen", () => ({
  ProfileScreen: () => null,
}));

jest.mock("@/components/BottomTabBar", () => {
  const actual = jest.requireActual("@/components/BottomTabBar");
  return {
    ...actual,
    BottomTabBar: () => null,
  };
});

describe("MembersOffers integration", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockGetToken.mockReset();
    mockGetToken.mockResolvedValue("test-token");
    Object.assign(mockAuthState, {
      getToken: mockGetToken,
      isSignedIn: true,
      isLoaded: true,
      sessionId: "session-a",
      userId: "user-a",
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  describe("authenticated offer requests", () => {
    it("leaves Members Offers and navigates the native hotel WebView to the selected offer", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "android");
      const offer = {
        ...makeOffer(15, "SAVOY-OFFER"),
        destinationCountry: "United Kingdom",
        destinationCity: "London",
        targetHotelId: "the-savoy",
        targetHotelName: "The Savoy",
      };
      global.fetch = jest.fn((input) => {
        if (String(input).includes("/member-offers")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ offers: [offer] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      }) as unknown as typeof fetch;

      const view = render(<HomeScreen />);
      await waitFor(() => expect(view.getByTestId("nav-members-offers")).toBeTruthy());
      fireEvent.press(view.getByTestId("nav-members-offers"));
      await waitFor(() => expect(view.getByLabelText("Use Offer")).toBeTruthy());

      fireEvent.press(view.getByLabelText("Use Offer"));

      await waitFor(() => expect(view.queryByTestId("members-offers-screen")).toBeNull());
      await waitFor(() => {
        const source = view.getByTestId("hotel-portal-webview").props.source;
        const url = new URL(source.uri);
        expect(url.searchParams.get("hotelId")).toBe("the-savoy");
        expect(url.searchParams.get("brandQuery")).toBe("The Savoy");
        expect(url.searchParams.get("fallbackCity")).toBe("London");
        expect(url.searchParams.get("pickDates")).toBe("1");
      });
      platformReplacement.restore();
    });

    it("unmounts Members Offers and aborts its pending request when Home's screen back button is pressed", async () => {
      jest.useFakeTimers();
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      const animationLoop = jest.spyOn(Animated, "loop").mockReturnValue({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn(),
      } as unknown as Animated.CompositeAnimation);
      const testWindow = global.window as typeof global.window & {
        addEventListener?: jest.Mock;
        removeEventListener?: jest.Mock;
      };
      const originalAddEventListener = testWindow.addEventListener;
      const originalRemoveEventListener = testWindow.removeEventListener;
      testWindow.addEventListener = jest.fn();
      testWindow.removeEventListener = jest.fn();
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const timeoutSpy = jest.spyOn(global, "setTimeout");
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
      let memberOffersTimeoutId: ReturnType<typeof setTimeout> | undefined;
      let abortCount = 0;
      global.fetch = jest.fn((input, init) => new Promise((_resolve, reject) => {
        if (String(input).includes("/member-offers")) {
          const requestTimeoutIndex = timeoutSpy.mock.calls.findLastIndex(([, delay]) => delay === 15_000);
          memberOffersTimeoutId = timeoutSpy.mock.results[requestTimeoutIndex]?.value;
        }
        init?.signal?.addEventListener("abort", () => {
          abortCount += 1;
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        });
      })) as unknown as typeof fetch;

      const view = render(<HomeScreen />);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        fireEvent.press(view.getByTestId("nav-members-offers"));
        await Promise.resolve();
      });

      expect(view.getByTestId("members-offers-screen")).toBeTruthy();
      const memberOfferCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([url]) => String(url).includes("/member-offers"),
      );
      expect(memberOfferCalls).toHaveLength(1);
      expect(memberOffersTimeoutId).toBeDefined();

      await act(async () => {
        fireEvent.press(view.getByTestId("members-offers-back"));
        await Promise.resolve();
      });

      expect(view.queryByTestId("members-offers-screen")).toBeNull();
      expect(abortCount).toBe(1);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(memberOffersTimeoutId);
      expect(view.queryByText("Something went wrong")).toBeNull();
      expect(warn).not.toHaveBeenCalled();

      view.unmount();
      warn.mockRestore();
      timeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
      testWindow.addEventListener = originalAddEventListener;
      testWindow.removeEventListener = originalRemoveEventListener;
      animationLoop.mockRestore();
      platformReplacement.restore();
    });

    it("aborts the web request and clears its timer when the screen unmounts", async () => {
      jest.useFakeTimers();
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      let abortCount = 0;
      global.fetch = jest.fn((_input, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          abortCount += 1;
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        });
      })) as unknown as typeof fetch;

      const view = render(
        <MembersOffersScreen
          lang="en"
          onClose={jest.fn()}
          onOpenHotelPortalUrl={jest.fn()}
        />,
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const timerCountWhileMounted = jest.getTimerCount();
      expect(timerCountWhileMounted).toBeGreaterThan(0);

      view.unmount();

      expect(abortCount).toBe(1);
      expect(jest.getTimerCount()).toBeLessThan(timerCountWhileMounted);
      await act(async () => {
        jest.advanceTimersByTime(15_000);
        await Promise.resolve();
      });
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
      platformReplacement.restore();
    });

    it("clears native authentication timers when the screen unmounts", async () => {
      jest.useFakeTimers();
      const platformReplacement = jest.replaceProperty(Platform, "OS", "ios");
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      let resolveToken!: (token: string | null) => void;
      mockGetToken.mockImplementation(() => new Promise((resolve) => {
        resolveToken = resolve;
      }));
      global.fetch = jest.fn() as unknown as typeof fetch;

      const view = render(
        <MembersOffersScreen
          lang="en"
          onClose={jest.fn()}
          onOpenHotelPortalUrl={jest.fn()}
        />,
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(mockGetToken).toHaveBeenCalledTimes(1);
      const timerCountWhileMounted = jest.getTimerCount();
      expect(timerCountWhileMounted).toBeGreaterThan(1);

      view.unmount();

      expect(jest.getTimerCount()).toBeLessThan(timerCountWhileMounted);
      await act(async () => {
        jest.advanceTimersByTime(15_000);
        await Promise.resolve();
      });
      expect(global.fetch).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      await act(async () => {
        resolveToken("late-token");
        await Promise.resolve();
      });
      warn.mockRestore();
      platformReplacement.restore();
    });

    it("reuses a slow native token request after the screen closes and reopens", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "ios");
      let resolveToken!: (token: string | null) => void;
      mockGetToken.mockImplementation(() => new Promise((resolve) => {
        resolveToken = resolve;
      }));
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ offers: [] }),
      }) as unknown as typeof fetch;
      const props = {
        lang: "en" as const,
        onClose: jest.fn(),
        onOpenHotelPortalUrl: jest.fn(),
      };

      const first = render(<MembersOffersScreen {...props} />);
      await waitFor(() => expect(mockGetToken).toHaveBeenCalledTimes(1));
      first.unmount();

      const reopened = render(<MembersOffersScreen {...props} />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockGetToken).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveToken("shared-native-token");
        await Promise.resolve();
      });
      await waitFor(() => expect(reopened.getByText("No offers available")).toBeTruthy());
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/member-offers"),
        expect.objectContaining({
          headers: { Authorization: "Bearer shared-native-token" },
        }),
      );
      platformReplacement.restore();
    });

    it("does not reuse a slow token request after the signed-in account changes", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "ios");
      const tokenResolvers: Array<(token: string | null) => void> = [];
      mockGetToken.mockImplementation(() => new Promise((resolve) => {
        tokenResolvers.push(resolve);
      }));
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ offers: [makeOffer(2, "NEW-ACCOUNT-OFFER")] }),
      }) as unknown as typeof fetch;
      const props = {
        lang: "en" as const,
        onClose: jest.fn(),
        onOpenHotelPortalUrl: jest.fn(),
      };

      const view = render(<MembersOffersScreen {...props} />);
      await waitFor(() => expect(mockGetToken).toHaveBeenCalledTimes(1));

      Object.assign(mockAuthState, {
        sessionId: "session-b",
        userId: "user-b",
      });
      view.rerender(<MembersOffersScreen {...props} />);
      await waitFor(() => expect(mockGetToken).toHaveBeenCalledTimes(2));

      await act(async () => {
        tokenResolvers[1]("new-account-token");
        await Promise.resolve();
      });
      await waitFor(() => expect(view.getAllByText("NEW-ACCOUNT-OFFER").length).toBeGreaterThan(0));

      await act(async () => {
        tokenResolvers[0]("old-account-token");
        await Promise.resolve();
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/member-offers"),
        expect.objectContaining({
          headers: { Authorization: "Bearer new-account-token" },
        }),
      );
      platformReplacement.restore();
    });

    it("uses the web session cookie even before Clerk reports sign-in", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      Object.assign(mockAuthState, {
        getToken: mockGetToken,
        isSignedIn: false,
        isLoaded: true,
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ offers: [] }),
      }) as unknown as typeof fetch;
      const props = {
        lang: "en" as const,
        onClose: jest.fn(),
        onOpenHotelPortalUrl: jest.fn(),
      };

      const view = render(<MembersOffersScreen {...props} />);

      await waitFor(() => expect(view.getByText("No offers available")).toBeTruthy());
      expect(global.fetch).toHaveBeenCalledTimes(1);

      Object.assign(mockAuthState, {
        isSignedIn: true,
      });
      view.rerender(<MembersOffersScreen {...props} onClose={jest.fn()} />);

      await waitFor(() => expect(view.getByText("No offers available")).toBeTruthy());
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/member-offers"),
        expect.objectContaining({
          headers: {},
          credentials: "include",
          signal: expect.any(Object),
        }),
      );
      expect(mockGetToken).not.toHaveBeenCalled();
      platformReplacement.restore();
    });

    it("does not restart a web request when Clerk callback identities change", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      let resolveRequest!: (value: Response) => void;
      global.fetch = jest.fn(() => new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      })) as unknown as typeof fetch;
      const props = {
        lang: "en" as const,
        onClose: jest.fn(),
        onOpenHotelPortalUrl: jest.fn(),
      };
      const view = render(<MembersOffersScreen {...props} />);

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
      mockAuthState.getToken = jest.fn(mockGetToken);
      view.rerender(<MembersOffersScreen {...props} onClose={jest.fn()} />);
      mockAuthState.getToken = jest.fn(mockGetToken);
      view.rerender(<MembersOffersScreen {...props} onClose={jest.fn()} />);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      await act(async () => {
        resolveRequest({
          ok: true,
          status: 200,
          json: async () => ({ offers: [] }),
        } as Response);
        await Promise.resolve();
      });
      await waitFor(() => expect(view.getByText("No offers available")).toBeTruthy());
      platformReplacement.restore();
    });

    it("uses the signed-in web session cookie without waiting for a Clerk token", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      mockGetToken.mockResolvedValue("token-that-web-must-not-request");
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ offers: [] }),
      }) as unknown as typeof fetch;

      const view = render(
        <MembersOffersScreen
          lang="en"
          onClose={jest.fn()}
          onOpenHotelPortalUrl={jest.fn()}
        />,
      );

      await waitFor(() => expect(view.getByText("No offers available")).toBeTruthy());
      expect(mockGetToken).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/member-offers"),
        expect.objectContaining({
          headers: {},
          credentials: "include",
          signal: expect.any(Object),
        }),
      );
      platformReplacement.restore();
    });

    it("loads web offers from the session cookie even when Clerk never finishes loading", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      Object.assign(mockAuthState, {
        isLoaded: false,
        isSignedIn: undefined,
        sessionId: null,
        userId: null,
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ offers: [] }),
      }) as unknown as typeof fetch;

      const view = render(
        <MembersOffersScreen
          lang="en"
          onClose={jest.fn()}
          onOpenHotelPortalUrl={jest.fn()}
        />,
      );

      await waitFor(() => expect(view.getByText("No offers available")).toBeTruthy());
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/member-offers"),
        expect.objectContaining({ credentials: "include" }),
      );
      expect(mockGetToken).not.toHaveBeenCalled();
      platformReplacement.restore();
    });

    it("shows sign-in instead of spinning when the web session cookie is unauthorized", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      Object.assign(mockAuthState, {
        isLoaded: false,
        isSignedIn: undefined,
        sessionId: null,
        userId: null,
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      }) as unknown as typeof fetch;

      const view = render(
        <MembersOffersScreen
          lang="en"
          onClose={jest.fn()}
          onOpenHotelPortalUrl={jest.fn()}
        />,
      );

      await waitFor(() => expect(view.getByText("Sign in to see offers")).toBeTruthy());
      platformReplacement.restore();
    });

    it("keeps the signed-out state when the previous session responds late", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      let resolveRequest!: (value: Response) => void;
      global.fetch = jest.fn()
        .mockImplementationOnce(() => new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }))
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({}),
        } as Response) as unknown as typeof fetch;
      const props = {
        lang: "en" as const,
        onClose: jest.fn(),
        onOpenHotelPortalUrl: jest.fn(),
      };
      const view = render(<MembersOffersScreen {...props} />);

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
      Object.assign(mockAuthState, {
        isSignedIn: false,
        sessionId: null,
        userId: null,
      });
      view.rerender(<MembersOffersScreen {...props} />);

      await waitFor(() => expect(view.getByText("Sign in to see offers")).toBeTruthy());
      expect(global.fetch).toHaveBeenCalledTimes(2);
      await act(async () => {
        resolveRequest({
          ok: true,
          json: async () => ({ offers: [makeOffer(1, "OLD-OFFER")] }),
        } as Response);
        await Promise.resolve();
      });

      expect(view.getByText("Sign in to see offers")).toBeTruthy();
      expect(view.queryByText("OLD-OFFER")).toBeNull();
      platformReplacement.restore();
    });

    it("does not let the previous account replace the current account's offers", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      const resolvers: Array<(value: Response) => void> = [];
      global.fetch = jest.fn(() => new Promise<Response>((resolve) => {
        resolvers.push(resolve);
      })) as unknown as typeof fetch;
      const props = {
        lang: "en" as const,
        onClose: jest.fn(),
        onOpenHotelPortalUrl: jest.fn(),
      };
      const view = render(<MembersOffersScreen {...props} />);

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
      Object.assign(mockAuthState, {
        sessionId: "session-b",
        userId: "user-b",
      });
      view.rerender(<MembersOffersScreen {...props} />);
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

      await act(async () => {
        resolvers[1]({
          ok: true,
          json: async () => ({ offers: [makeOffer(2, "NEW-OFFER")] }),
        } as Response);
      });
      await waitFor(() => expect(view.getAllByText("NEW-OFFER").length).toBeGreaterThan(0));

      await act(async () => {
        resolvers[0]({
          ok: true,
          json: async () => ({ offers: [makeOffer(1, "OLD-OFFER")] }),
        } as Response);
        await Promise.resolve();
      });

      expect(view.getAllByText("NEW-OFFER").length).toBeGreaterThan(0);
      expect(view.queryByText("OLD-OFFER")).toBeNull();
      platformReplacement.restore();
    });

    it("leaves the loading state and offers a retry when the web request times out", async () => {
      jest.useFakeTimers();
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      global.fetch = jest.fn((_input, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        });
      })) as unknown as typeof fetch;

      const view = render(
        <MembersOffersScreen
          lang="en"
          onClose={jest.fn()}
          onOpenHotelPortalUrl={jest.fn()}
        />,
      );

      expect(view.queryByText("Try Again")).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(15_000);
        await Promise.resolve();
      });

      expect(view.getByText("Something went wrong")).toBeTruthy();
      expect(view.getByText("Try Again")).toBeTruthy();
      expect(mockGetToken).not.toHaveBeenCalled();
      platformReplacement.restore();
    });

    it("reuses the active load when retry is pressed rapidly", async () => {
      jest.useFakeTimers();
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      const requests: Array<{
        signal?: AbortSignal;
        resolve: (value: Response) => void;
        reject: (reason?: unknown) => void;
      }> = [];
      global.fetch = jest.fn((_input, init) => new Promise<Response>((resolve, reject) => {
        requests.push({ signal: init?.signal, resolve, reject });
      })) as unknown as typeof fetch;

      const view = render(
        <MembersOffersScreen
          lang="en"
          onClose={jest.fn()}
          onOpenHotelPortalUrl={jest.fn()}
        />,
      );

      await waitFor(() => expect(requests).toHaveLength(1));
      await act(async () => {
        requests[0].reject(new Error("Initial request failed"));
        await Promise.resolve();
      });
      const retry = view.getByText("Try Again");
      const timerCountBeforeRetry = jest.getTimerCount();

      act(() => {
        fireEvent.press(retry);
        fireEvent.press(retry);
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(requests[1].signal?.aborted).toBe(false);
      expect(jest.getTimerCount()).toBe(timerCountBeforeRetry + 1);

      await act(async () => {
        requests[1].resolve({
          ok: true,
          json: async () => ({ offers: [makeOffer(2, "CURRENT-OFFER")] }),
        } as Response);
        await Promise.resolve();
      });
      await waitFor(() => expect(view.getAllByText("CURRENT-OFFER").length).toBeGreaterThan(0));

      expect(view.getAllByText("CURRENT-OFFER").length).toBeGreaterThan(0);
      platformReplacement.restore();
    });

    it("keeps using a Clerk bearer token on native devices", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "ios");
      mockGetToken.mockResolvedValue("native-token");
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ offers: [] }),
      }) as unknown as typeof fetch;

      const view = render(
        <MembersOffersScreen
          lang="en"
          onClose={jest.fn()}
          onOpenHotelPortalUrl={jest.fn()}
        />,
      );

      await waitFor(() => expect(view.getByText("No offers available")).toBeTruthy());
      expect(mockGetToken).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/member-offers"),
        expect.objectContaining({
          headers: { Authorization: "Bearer native-token" },
          credentials: undefined,
          signal: expect.any(Object),
        }),
      );
      platformReplacement.restore();
    });

    it("opens all three offer profiles with the correct passive hotel handoff", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      const onOpenHotelPortalUrl = jest.fn();
      const offers = [
        {
          ...makeOffer(11, "INTL-HOTEL"),
          destinationCountry: "United Arab Emirates",
          destinationCity: "Dubai",
          targetHotelId: "atlantis-the-royal",
          targetHotelName: "Atlantis The Royal",
        },
        {
          ...makeOffer(12, "INTL-CITY"),
          destinationCountry: "France",
          destinationCity: "Paris",
        },
        {
          ...makeOffer(13, "KUWAIT-HOTEL"),
          destinationCountry: "Kuwait",
          destinationCity: "Kuwait City",
          targetHotelId: "four-seasons-kuwait",
          targetHotelName: "Four Seasons Hotel Kuwait",
        },
      ];
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ offers }),
      }) as unknown as typeof fetch;

      const view = render(
        <MembersOffersScreen
          lang="en"
          onClose={jest.fn()}
          onOpenHotelPortalUrl={onOpenHotelPortalUrl}
        />,
      );
      await waitFor(() => expect(view.getAllByLabelText("Use Offer")).toHaveLength(3));

      for (const button of view.getAllByLabelText("Use Offer")) fireEvent.press(button);

      expect(onOpenHotelPortalUrl).toHaveBeenCalledTimes(3);
      const urls = onOpenHotelPortalUrl.mock.calls.map(([url]) => new URL(url));
      expect(urls.map((url) => url.searchParams.get("city"))).toEqual([
        "Dubai",
        "Paris",
        "Kuwait City",
      ]);
      expect(urls.map((url) => url.searchParams.get("hotelId"))).toEqual([
        "atlantis-the-royal",
        null,
        "four-seasons-kuwait",
      ]);
      expect(urls.map((url) => url.searchParams.get("fallbackCity"))).toEqual([
        "Dubai",
        null,
        "Kuwait City",
      ]);
      expect(urls.every((url) => url.searchParams.get("autoSearch") === "0")).toBe(true);
      expect(urls.every((url) => url.searchParams.get("pickDates") === "1")).toBe(true);
      platformReplacement.restore();
    });

    it("replaces a failed remote offer image with bundled photography", async () => {
      const platformReplacement = jest.replaceProperty(Platform, "OS", "web");
      const failedImageUrl = "https://member-offer-images.invalid/failed.jpg";
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          offers: [{
            ...makeOffer(14, "FAILED-IMAGE"),
            destinationCity: "Dubai",
            imageUrl: failedImageUrl,
          }],
        }),
      }) as unknown as typeof fetch;

      const view = render(
        <MembersOffersScreen
          lang="en"
          onClose={jest.fn()}
          onOpenHotelPortalUrl={jest.fn()}
        />,
      );
      await waitFor(() => expect(view.getAllByText("FAILED-IMAGE").length).toBeGreaterThan(0));
      const image = view.UNSAFE_getByType(Image);
      expect(image.props.source).toEqual({ uri: failedImageUrl });

      fireEvent(image, "error");

      expect(view.UNSAFE_getByType(Image).props.source).not.toEqual({ uri: failedImageUrl });
      platformReplacement.restore();
    });
  });

  describe("LuxuryHome card callback", () => {
    it("calls onMembersOffers when the card is pressed", () => {
      const onMembersOffers = jest.fn();
      
      const { getByTestId } = render(
        <LuxuryHome
          lang="en"
          onChangeLang={jest.fn()}
          onFlights={jest.fn()}
          onHotels={jest.fn()}
          onAIBuilder={jest.fn()}
          onWhereToGo={jest.fn()}
          onOpenUrl={jest.fn()}
          onExplore={jest.fn()}
          onMembersOffers={onMembersOffers}
          isOffline={false}
        />
      );

      const card = getByTestId("nav-members-offers");
      fireEvent.press(card);

      expect(onMembersOffers).toHaveBeenCalledTimes(1);
    });
  });

  describe("useCountdown helper", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns empty string if expiry is null", () => {
      const { result } = renderHook(() => useCountdown(null, "en"));
      expect(result.current.timeLeft).toBe("");
      expect(result.current.isExpired).toBe(false);
    });

    it("returns Expired for a past date", () => {
      const past = new Date(Date.now() - 10000).toISOString();
      const { result } = renderHook(() => useCountdown(past, "en"));
      
      expect(result.current.isExpired).toBe(true);
      expect(result.current.timeLeft).toBe("Expired");
    });

    it("returns translated Expired for Arabic", () => {
      const past = new Date(Date.now() - 10000).toISOString();
      const { result } = renderHook(() => useCountdown(past, "ar"));
      
      expect(result.current.isExpired).toBe(true);
      expect(result.current.timeLeft).toBe("منتهي");
    });

    it("formats future dates correctly (en)", () => {
      // 1 day, 2 hours, 3 minutes, 4 seconds
      const future = new Date(Date.now() + 1 * 86400000 + 2 * 3600000 + 3 * 60000 + 4 * 1000 + 500).toISOString();
      const { result } = renderHook(() => useCountdown(future, "en"));
      
      expect(result.current.isExpired).toBe(false);
      expect(result.current.timeLeft).toContain("1d");
      expect(result.current.timeLeft).toContain("2h");
      expect(result.current.timeLeft).toContain("3m");
      expect(result.current.timeLeft).toContain("4s");
    });

    it("formats future dates correctly (ar)", () => {
      const future = new Date(Date.now() + 1 * 86400000 + 2 * 3600000 + 3 * 60000 + 4 * 1000 + 500).toISOString();
      const { result } = renderHook(() => useCountdown(future, "ar"));
      
      expect(result.current.isExpired).toBe(false);
      expect(result.current.timeLeft).toContain("1ي");
      expect(result.current.timeLeft).toContain("2س");
      expect(result.current.timeLeft).toContain("3د");
      expect(result.current.timeLeft).toContain("4ث");
    });
  });
});