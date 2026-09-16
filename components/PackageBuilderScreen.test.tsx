jest.mock("react-native-webview", () => ({ WebView: "WebView" }));

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react-native";

import { PackageBuilderScreen } from "./PackageBuilderScreen";

const start = new Date("2026-08-23T12:00:00.000Z").getTime();
const cooldownMs = 2 * 60 * 1000;

type Entitlement = {
  allowed: boolean;
  isPremium: boolean;
  cycleRequests: number;
  cyclesUsedToday: number;
  remaining: number | null;
  maxPerCycle: number;
  blockUntil: number | null;
};

const blockedEntitlement: Entitlement = {
  allowed: false,
  isPremium: false,
  cycleRequests: 3,
  cyclesUsedToday: 4,
  remaining: 0,
  maxPerCycle: 3,
  blockUntil: start + cooldownMs,
};

const availableEntitlement: Entitlement = {
  allowed: true,
  isPremium: false,
  cycleRequests: 0,
  cyclesUsedToday: 0,
  remaining: 3,
  maxPerCycle: 3,
  blockUntil: null,
};

function entitlementResponse(builder: Entitlement) {
  return {
    ok: true,
    json: async () => ({ ok: true, builder }),
  } as Response;
}

function renderBuilder() {
  render(
    <PackageBuilderScreen
      visible
      lang="en"
      prefill={{ destination: "Bahrain", nights: 3 }}
      onClose={jest.fn()}
      onUpgrade={jest.fn()}
    />,
  );
}

describe("PackageBuilderScreen cooldown entitlement", () => {
  const fetchMock = jest.fn();
  const responseResolvers: Array<(response: Response) => void> = [];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(start);
    fetchMock.mockReset();
    responseResolvers.length = 0;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          responseResolvers.push(resolve);
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function respondWith(builder: Entitlement) {
    await waitFor(() => expect(responseResolvers).toHaveLength(1));
    const resolve = responseResolvers.shift();
    if (!resolve) throw new Error("Expected a pending entitlement request");

    await act(async () => {
      resolve(entitlementResponse(builder));
      await Promise.resolve();
    });
  }

  it("shows the retry countdown and removes builder controls when allowance is exhausted", async () => {
    renderBuilder();
    await respondWith(blockedEntitlement);

    expect(screen.getByTestId("pb-quota-timer")).toBeTruthy();
    expect(screen.getByText("00:02")).toBeTruthy();
    expect(screen.queryByTestId("pb-destination")).toBeNull();
    expect(screen.queryByTestId("pb-next")).toBeNull();
  });

  it("refreshes entitlement after cooldown expiry and restores the builder", async () => {
    renderBuilder();
    await respondWith(blockedEntitlement);

    await act(async () => {
      jest.advanceTimersByTime(cooldownMs);
    });

    await respondWith(availableEntitlement);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("pb-quota-block")).toBeNull();
    expect(screen.getByTestId("pb-next").props.accessibilityState?.disabled).toBe(false);
  });

  it("keeps premium users available even when a cooldown timestamp is present", async () => {
    renderBuilder();
    await respondWith({
      ...availableEntitlement,
      isPremium: true,
      remaining: null,
      blockUntil: start + cooldownMs,
    });

    expect(screen.getByText("Unlimited with your subscription")).toBeTruthy();
    expect(screen.queryByTestId("pb-quota-block")).toBeNull();
    expect(screen.getByTestId("pb-next").props.accessibilityState?.disabled).toBe(false);
  });
});