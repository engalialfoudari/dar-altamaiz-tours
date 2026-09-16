import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { BackHandler, Pressable, Text, View } from "react-native";

import { WebIframeShell, WebShell } from "../app/(tabs)/index";
import { shouldHideBottomTabBarForWeb } from "./BottomTabBar";

const mockBackHandlers: Array<() => boolean> = [];
const mockHeaderBackHandlers: Array<() => void> = [];

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => () => {}),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock("@clerk/expo", () => ({
  useAuth: jest.fn(() => ({ getToken: jest.fn(() => new Promise(() => {})) })),
  useClerk: jest.fn(() => ({ signOut: jest.fn() })),
}));

jest.mock("@/lib/cartContext", () => ({
  useCart: jest.fn(() => ({ addItems: jest.fn() })),
}));

Object.assign(global.window, {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
});

jest.mock("react-native-webview", () => ({
  WebView: "WebView",
}));

jest.mock("@/components/AppHeader", () => ({
  AppHeader: ({ onBack }: { onBack: () => void }) => {
    mockHeaderBackHandlers.push(onBack);
    return null;
  },
}));

jest.mock("@/components/InfoModal", () => ({
  InfoModal: () => null,
}));

jest.mock("@/components/SpecialRequestsScreen", () => ({
  SpecialRequestsScreen: () => null,
}));

jest.mock("@/components/ProfileScreen", () => ({
  ProfileScreen: () => null,
}));

jest.mock("@/components/LuxuryHome", () => ({
  LuxuryHome: () => null,
}));

jest.mock("@/components/PackageBuilderScreen", () => ({
  PackageBuilderScreen: () => null,
}));

jest.mock("@/components/ContactScreen", () => ({
  ContactScreen: () => null,
}));

jest.mock("@/components/PackagesScreen", () => ({
  PackagesScreen: () => null,
}));

jest.mock("@/components/FlightResultsScreen", () => ({
  FlightResultsScreen: () => null,
}));

jest.mock("@/components/FlightSearchScreen", () => ({
  FlightSearchScreen: () => null,
}));

jest.mock("./BottomTabBar", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  const actual = jest.requireActual("./BottomTabBar");

  const pressableTab = (key: "trips" | "bookings", label: string, onTabPress: (tab: {
    key: "trips" | "bookings";
    labelEn: string;
    url: string;
  }) => void) => (
    <Pressable
      key={key}
      testID={`tab-${key}`}
      onPress={() => onTabPress({
        key,
        labelEn: label,
        url: key === "trips"
          ? "https://dt-tours.com/index.php/tours/search/"
          : "https://dt-tours.com/index.php/general/my_booking",
      })}
    >
      <Text>{label}</Text>
    </Pressable>
  );

  return {
    ...actual,
    TABS: [
      { key: "home", labelEn: "Home", url: "https://dt-tours.com/", isNative: true },
      { key: "trips", labelEn: "Packages", url: "https://dt-tours.com/index.php/tours/search/" },
      { key: "bookings", labelEn: "Bookings", url: "https://dt-tours.com/index.php/general/my_booking" },
      { key: "settings", labelEn: "Contact", url: "https://dt-tours.com/general/contact_us/" },
      { key: "requests", labelEn: "Special Requests", url: "", isNative: true },
      { key: "profile", labelEn: "My Account", url: "", isNative: true },
    ],
    BottomTabBar: ({ onTabPress }: {
      onTabPress: (tab: {
        key: "trips" | "bookings";
        labelEn: string;
        url: string;
      }) => void;
    }) => (
      <View>
        {pressableTab("trips", "Packages", onTabPress)}
        {pressableTab("bookings", "Bookings", onTabPress)}
      </View>
    ),
  };
});

type ShellComponent = typeof WebShell | typeof WebIframeShell;
type Destination = "packages" | "bookings" | null;

function HotelPortalTabHarness({ Shell }: { Shell: ShellComponent }) {
  const [hotelPortalVisible, setHotelPortalVisible] = useState(true);
  const [destination, setDestination] = useState<Destination>(null);

  const handleCloseHotelPortal = (nextDestination?: "packages" | "bookings") => {
    setHotelPortalVisible(false);
    setDestination(nextDestination ?? null);
  };

  return (
    <View>
      {hotelPortalVisible && <View testID="hotel-portal-visible" />}
      <Pressable testID="open-hotels" onPress={() => setHotelPortalVisible(true)}>
        <Text>Hotels</Text>
      </Pressable>
      <Shell
        initialUrl="https://dt-tours.com/"
        nativeHome={<View testID="native-home-screen" />}
        onBookingsPress={() => setDestination("bookings")}
        onNativeTravelTab={(screen) => setDestination(screen === "packages" ? "packages" : null)}
        hotelPortalVisible={hotelPortalVisible}
        onOpenHotelPortal={() => setHotelPortalVisible(true)}
        onCloseHotelPortal={handleCloseHotelPortal}
      />
      {destination === "packages" && <View testID="native-packages-screen" />}
      {destination === "bookings" && <View testID="booking-type-chooser" />}
    </View>
  );
}

describe("BottomTabBar keyboard handling", () => {
  it("does not duplicate Special Requests in the bottom navigation", () => {
    const actual = jest.requireActual("./BottomTabBar") as {
      TABS: Array<{ key: string }>;
    };
    expect(actual.TABS.map((tab) => tab.key)).not.toContain("requests");
  });

  it("hides when Safari reports the focused field as a cross-origin iframe", () => {
    expect(shouldHideBottomTabBarForWeb({
      layoutHeight: 800,
      visibleHeight: 480,
      fullViewportHeight: 800,
      activeTagName: "IFRAME",
    })).toBe(true);
  });

  it("accepts a direct keyboard message from an embedded page", () => {
    expect(shouldHideBottomTabBarForWeb({
      layoutHeight: 800,
      visibleHeight: 800,
      fullViewportHeight: 800,
      iframeReportedOpen: true,
    })).toBe(true);
  });

  it("does not hide for Safari browser chrome movement", () => {
    expect(shouldHideBottomTabBarForWeb({
      layoutHeight: 800,
      visibleHeight: 720,
      fullViewportHeight: 800,
      activeTagName: "IFRAME",
    })).toBe(false);
  });
});

describe.each([
  ["native WebShell", WebShell],
  ["browser WebIframeShell", WebIframeShell],
])("%s hotel portal tab transitions", (shellName, Shell) => {
  beforeEach(() => {
    mockBackHandlers.length = 0;
    mockHeaderBackHandlers.length = 0;
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
      mockBackHandlers.push(handler);
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("closes the portal and opens Packages from one tab press", () => {
    const { getByTestId, queryByTestId } = render(
      <HotelPortalTabHarness Shell={Shell} />,
    );

    expect(getByTestId("hotel-portal-visible")).toBeTruthy();

    fireEvent.press(getByTestId("tab-trips"));

    expect(queryByTestId("hotel-portal-visible")).toBeNull();
    expect(getByTestId("native-packages-screen")).toBeTruthy();
  });

  if (Shell === WebShell) {
    it("keeps the same hotel document when leaving and reopening Hotels", () => {
      const { getByTestId } = render(
        <HotelPortalTabHarness Shell={Shell} />,
      );
      const originalPortal = getByTestId("hotel-portal-webview");

      fireEvent.press(getByTestId("tab-trips"));
      fireEvent.press(getByTestId("open-hotels"));

      expect(getByTestId("hotel-portal-webview")).toBe(originalPortal);
    });
  }

  it("closes the portal and opens the booking chooser from one tab press", () => {
    const { getByTestId, queryByTestId } = render(
      <HotelPortalTabHarness Shell={Shell} />,
    );

    expect(getByTestId("hotel-portal-visible")).toBeTruthy();

    fireEvent.press(getByTestId("tab-bookings"));

    expect(queryByTestId("hotel-portal-visible")).toBeNull();
    expect(getByTestId("booking-type-chooser")).toBeTruthy();
  });

  it.each([
    ["Packages", "tab-trips", "native-packages-screen"],
    ["Bookings", "tab-bookings", "booking-type-chooser"],
  ])("keeps the %s destination when a stale portal back callback fires", (_destination, tabId, destinationId) => {
    const { getByTestId, queryByTestId } = render(
      <HotelPortalTabHarness Shell={Shell} />,
    );
    const staleAndroidBack = mockBackHandlers[0];
    const staleBrowserBack = mockHeaderBackHandlers[0];

    fireEvent.press(getByTestId(tabId));

    expect(queryByTestId("hotel-portal-visible")).toBeNull();
    expect(getByTestId(destinationId)).toBeTruthy();

    if (shellName === "native WebShell") {
      expect(staleAndroidBack).toBeDefined();
      expect(staleAndroidBack?.()).toBe(true);
    } else {
      expect(staleAndroidBack).toBeUndefined();
      expect(staleBrowserBack).toBeDefined();
      staleBrowserBack?.();
    }

    expect(queryByTestId("hotel-portal-visible")).toBeNull();
    expect(getByTestId(destinationId)).toBeTruthy();
  });
});