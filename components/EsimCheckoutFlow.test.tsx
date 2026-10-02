import React from "react";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { AppState, Image, Linking, StyleSheet } from "react-native";
import { ConnectedEsimCatalogScreen } from "./ConnectedEsimCatalogScreen";
import { EsimCatalogScreen } from "./EsimCatalogScreen";
import { PaymentMethodLogo } from "./PaymentMethodLogo";
import { EsimIcon } from "./EsimIcon";
import { isValidE164, normalizeNationalPhone, parseBilling, serializeBilling } from "./esimBilling";
import { resolveEsimDeepLink } from "@/utils/home-navigation";

const mockQuote = jest.fn();
const mockCreate = jest.fn();
const mockSendGuestCode = jest.fn();
const mockSendRecoveryCode = jest.fn();
const mockRecoverOrders = jest.fn();
const mockDownloadGuestDocument = jest.fn();
const mockSharedFiles: Array<{ uri: string; html: string; deleted: boolean }> = [];
let mockCatalogRefreshError = false;
let mockDetailRefreshError = false;
let mockDetailFetchedAfterMount = true;
let mockDetailFetching = false;
let mockDetailStale = false;
let mockCatalogQueryOptions: any;
let mockDetailQueryOptions: any;
let mockPackageInStock: boolean | undefined = true;
let mockPrivateTestEnabled = true;
let mockOwnedOrderDetail: any = null;
let mockUuidCounter = 0;
const mockOrderDetailRead = jest.fn(async (orderId: string) => ({
  data: mockOwnedOrderDetail?.orderId === orderId ? mockOwnedOrderDetail : undefined,
}));

jest.mock("expo-crypto", () => ({
  randomUUID: () => `3ca9656a-31fa-4eac-a7a0-${String(++mockUuidCounter).padStart(12, "0")}`,
}));
let mockSignedIn = true;
let mockIsLoaded = true;
let mockSessionId: string | null = "session-test";
let mockUnstableGetToken = false;
const mockRequestToken = jest.fn(async (): Promise<string | null> => "signed-in-test-token");

jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    exists = true;
    constructor(_cache: string, name: string) { this.uri = `file://test-cache/${name}`; }
    write(html: string) { mockSharedFiles.push({ uri: this.uri, html, deleted: false }); }
    delete() {
      const file = mockSharedFiles.find((item) => item.uri === this.uri);
      if (file) file.deleted = true;
    }
  },
  Paths: { cache: "test-cache" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync: jest.fn(),
}));

jest.mock("@clerk/expo", () => {
  const getToken = jest.fn(async () => "signed-in-test-token");
  return {
    useAuth: () => ({ isLoaded: mockIsLoaded, isSignedIn: mockSignedIn, sessionId: mockSignedIn ? mockSessionId : null, getToken: mockUnstableGetToken ? () => getToken() : getToken }),
    useUser: () => ({
      user: {
        firstName: "Maya",
        lastName: null,
        primaryEmailAddress: { emailAddress: "maya@example.com" },
      },
    }),
  };
});

jest.mock("@tanstack/react-query", () => {
  const client = {
    invalidateQueries: jest.fn(async () => undefined),
    removeQueries: jest.fn(),
  };
  return { useQueryClient: () => client };
});

jest.mock("@/lib/clerkTokenCoordinator", () => ({
  requestClerkToken: (...args: unknown[]) => mockRequestToken(...args as []),
}));

jest.mock("@/utils/esimPrivateTest", () => ({
  ...jest.requireActual("@/utils/esimPrivateTest"),
  isPrivateEsimTestEnabled: () => mockPrivateTestEnabled,
}));

jest.mock("@workspace/api-client-react", () => {
  const plan = {
    id: "sa-7d",
    title: "1 GB · 7 days",
    data: "1 GB",
    validityDays: 7,
    isUnlimited: false,
    get isInStock() { return mockPackageInStock; },
    operatorName: "Local network",
    priceKwd: 2.5,
    minPriceKwd: 2.5,
    coverage: ["Saudi Arabia"],
    network: ["4G"],
  };
  const destination = {
    slug: "saudi-arabia",
    title: "Saudi Arabia",
    countryCode: "SA",
    imageUrl: "",
    category: "local",
    minPriceKwd: 2.5,
    packages: [plan],
  };
  return {
    getGetEsimCatalogQueryKey: () => ["catalog"],
    getGetEsimCatalogDestinationQueryKey: (slug: string) => ["destination", slug],
    useGetEsimCatalog: (options: any) => {
      mockCatalogQueryOptions = options;
      return { isPending: false, isError: mockCatalogRefreshError, data: options?.query?.initialData, refetch: jest.fn() };
    },
    useGetEsimCatalogDestination: (_slug: string, options: any) => {
      mockDetailQueryOptions = options;
      return {
        isPending: false,
        isError: mockDetailRefreshError,
        isSuccess: !mockDetailRefreshError,
        isFetchedAfterMount: mockDetailFetchedAfterMount,
        isFetching: mockDetailFetching,
        isRefetchError: mockDetailRefreshError,
        isStale: mockDetailStale,
        data: options?.query?.initialData,
        refetch: jest.fn(),
      };
    },
    useGetMyEsimBillingProfile: () => ({
      data: { profile: null },
      isPending: false,
    }),
    useListMyEsimOrders: () => ({
      isPending: false,
      isError: false,
      data: {
        orders: [{
          orderId: "owned-1",
          product: { destination: "Saudi Arabia", title: "1 GB · 7 days" },
          status: "completed",
          createdAt: "2026-09-25T00:00:00Z",
        }],
      },
      refetch: jest.fn(),
    }),
    useGetMyEsimOrder: (orderId: string) => ({
      isPending: false,
      isError: false,
      data: mockOwnedOrderDetail?.orderId === orderId ? mockOwnedOrderDetail : null,
      refetch: () => mockOrderDetailRead(orderId),
    }),
    useCreateEsimOrder: () => ({ mutateAsync: (...args: unknown[]) => mockCreate(...args) }),
    useQuoteEsimPackage: () => ({ mutateAsync: (...args: unknown[]) => mockQuote(...args) }),
    useSendEsimPrivateGuestCode: () => ({ mutateAsync: (...args: unknown[]) => mockSendGuestCode(...args) }),
    useSendEsimGuestRecoveryCode: () => ({ mutateAsync: (...args: unknown[]) => mockSendRecoveryCode(...args) }),
    useRecoverEsimGuestOrders: () => ({ mutateAsync: (...args: unknown[]) => mockRecoverOrders(...args) }),
    downloadEsimGuestDocument: (...args: unknown[]) => mockDownloadGuestDocument(...args),
    downloadMyEsimDocument: jest.fn(),
  };
});

jest.mock("@workspace/api-client-react/esim-static", () => {
  const plan = {
    id: "sa-7d",
    title: "1 GB · 7 days",
    data: "1 GB",
    validityDays: 7,
    isUnlimited: false,
    get isInStock() { return mockPackageInStock; },
    operatorName: "Local network",
    priceKwd: 2.5,
    minPriceKwd: 2.5,
    coverage: ["Saudi Arabia"],
    network: ["4G"],
  };
  const destination = {
    slug: "saudi-arabia",
    title: "Saudi Arabia",
    countryCode: "SA",
    imageUrl: "",
    category: "local",
    minPriceKwd: 2.5,
    packages: [plan],
  };
  const asia = { ...destination, slug: "asia", title: "Asia", countryCode: "", category: "regional" };
  const worldPlan = {
    ...plan,
    id: "discover-in-3days-300mb",
    title: "300 MB · 3 days",
    data: "300 MB",
    validityDays: 3,
    isInStock: true,
    priceKwd: 0.313,
    minPriceKwd: 0.313,
  };
  const world = { ...destination, slug: "world", title: "Global", countryCode: "", category: "global", packages: [worldPlan] };
  const destinations = [destination, asia, world];
  return {
    bundledEsimCatalog: { destinations: destinations.map((item) => ({ ...item, packageCount: 1 })) },
    getBundledEsimDestination: (slug: string) => {
      const found = destinations.find((item) => item.slug === slug);
      return found ? { destination: found } : undefined;
    },
  };
});

async function renderConnected(element: React.ReactElement) {
  const screen = render(element);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return screen;
}

function acknowledgeEmail(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByTestId("esim-email-acknowledgement"));
}

function isDisabled(control: { props: { accessibilityState?: { disabled?: boolean }; disabled?: boolean } }) {
  return control.props.accessibilityState?.disabled ?? control.props.disabled ?? false;
}

describe("private eSIM deep links", () => {
  it("opens the requested world destination for a private test link and keeps the UAE fallback", () => {
    expect(resolveEsimDeepLink("?esimPrivateTest=1&esimDestination=world", false, true)).toEqual({
      open: true,
      privateTest: true,
      destination: "world",
    });
    expect(resolveEsimDeepLink("?esimPrivateTest=1", false, true)).toEqual({
      open: true,
      privateTest: true,
      destination: "united-arab-emirates",
    });
    expect(resolveEsimDeepLink("?esimPrivateTest=1&esimDestination=world", false, false)).toEqual({
      open: false,
      privateTest: false,
      destination: null,
    });
  });
});

describe("signed-in eSIM checkout", () => {
  beforeEach(() => {
    mockIsLoaded = true;
    mockSignedIn = true;
    mockSessionId = "session-test";
    mockRequestToken.mockReset().mockResolvedValue("signed-in-test-token");
    jest.useFakeTimers();
    mockQuote.mockReset();
    mockCreate.mockReset();
    mockSendGuestCode.mockReset();
  });
  afterEach(async () => {
    await act(async () => { await jest.runOnlyPendingTimersAsync(); });
    jest.useRealTimers();
  });

  const props = {
    lang: "en" as const,
    onClose: jest.fn(),
    selectedSlug: "saudi-arabia",
    onSelectDestination: jest.fn(),
  };

  it("shows only the five requested details, requires them, and renders four branded payment methods", async () => {
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    await waitFor(() => expect(screen.getByTestId("esim-package-sa-7d")).toBeTruthy());
    fireEvent.press(screen.getByTestId("esim-package-sa-7d"));
    fireEvent.press(screen.getByTestId("esim-buy-now"));

    expect(screen.getByTestId("esim-firstName").props.value).toBe("Maya");
    expect(screen.getByTestId("esim-lastName").props.value).toBe("");
    expect(screen.getByTestId("esim-email").props.value).toBe("maya@example.com");
    expect(screen.queryByTestId("esim-confirmEmail")).toBeNull();
    for (const field of ["addressLine1", "addressLine2", "city", "stateProvince", "postalCode"]) {
      expect(screen.queryByTestId(`esim-${field}`)).toBeNull();
    }
    expect(screen.getByTestId("esim-country")).toBeTruthy();
    expect(screen.getByTestId("esim-phoneNumber")).toBeTruthy();
    expect(screen.getByTestId("esim-phone-dial-country")).toBeTruthy();
    expect(screen.queryByTestId("esim-pay")).toBeNull();

    fireEvent.press(screen.getByTestId("esim-details-next"));
    expect(screen.getByTestId("esim-lastName")).toBeTruthy();
    expect(screen.queryByTestId("esim-pay")).toBeNull();
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId("esim-lastName"), "Al Rashid");
    fireEvent.changeText(screen.getByTestId("esim-email"), "not-an-email");
    fireEvent.press(screen.getByTestId("esim-details-next"));
    expect(screen.queryByTestId("esim-pay")).toBeNull();

    fireEvent.changeText(screen.getByTestId("esim-email"), "maya@example.com");
    fireEvent.changeText(screen.getByTestId("esim-phoneNumber"), "501 234 56");
    fireEvent.press(screen.getByTestId("esim-country"));
    fireEvent.changeText(screen.getByTestId("esim-country-search"), "Kuwait");
    fireEvent.press(screen.getByTestId("esim-country-option-KW"));
    fireEvent.press(screen.getByTestId("esim-phone-dial-country"));
    fireEvent.changeText(screen.getByTestId("esim-phone-dial-country-search"), "Kuwait");
    expect(screen.getAllByText(/\+965\s+Kuwait/).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId("esim-phone-dial-country-option-KW"));
    fireEvent.press(screen.getByTestId("esim-details-next"));
    expect(screen.getByTestId("esim-pay")).toBeTruthy();
    const methods = ["knet", "cc", "apple-pay", "samsung-pay"] as const;
    methods.forEach((method) => expect(screen.getByTestId(`esim-payment-${method}`)).toBeTruthy());
    const logos = screen.UNSAFE_getAllByType(PaymentMethodLogo);
    expect(logos.map((logo) => logo.props.method)).toEqual(methods);
    expect(within(screen.getByTestId("esim-payment-cc")).getByText("Visa / Mastercard")).toBeTruthy();
    expect(screen.queryByText("No payment fee")).toBeNull();
    expect(screen.queryByText("2.5% payment fee")).toBeNull();
    methods.forEach((method) => {
      const option = screen.getByTestId(`esim-payment-${method}`);
      expect(option.props.accessibilityState.disabled).toBe(false);
    });
    expect(screen.getByTestId("esim-payment-cc").props.accessibilityState.checked).toBe(true);
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("opens the completed My eSIMs list when launched from Account", async () => {
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} initialShowOrders />);
    await waitFor(() => expect(screen.getByTestId("esim-order-owned-1")).toBeTruthy());
    expect(screen.getByText("My eSIMs")).toBeTruthy();
    expect(screen.queryByTestId("esim-package-sa-7d")).toBeNull();
  });

  it("opens the specific purchased eSIM selected in Account", async () => {
    mockOwnedOrderDetail = {
      orderId: "owned-1", status: "completed", amountKwd: 3.25,
      product: { destination: "Saudi Arabia", title: "1 GB · 7 days" },
      createdAt: "2026-10-02T12:00:00Z", activation: null,
    };
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} initialShowOrders initialOrderId="owned-1" />);
    await waitFor(() => expect(screen.getByTestId("esim-download")).toBeTruthy());
    expect(screen.getByText("1 GB · 7 days")).toBeTruthy();
    expect(screen.queryByTestId("esim-order-owned-1")).toBeNull();
    expect(screen.queryByTestId("esim-package-sa-7d")).toBeNull();
  });
});

describe("guest eSIM checkout", () => {
  beforeEach(() => { mockIsLoaded = true; mockSignedIn = false; mockQuote.mockReset(); mockCreate.mockReset(); mockSendGuestCode.mockReset().mockResolvedValue({ ok: true }); });
  afterEach(() => { mockSignedIn = true; mockIsLoaded = true; mockSessionId = "session-test"; });
  it("lets a guest select, fill details, choose Pay method, quote and prepare an order without login", async () => {
    const screen = await renderConnected(<ConnectedEsimCatalogScreen lang="en" selectedSlug="saudi-arabia" onClose={jest.fn()} onSelectDestination={jest.fn()} />);
    expect(screen.queryByTestId("esim-my-esims")).toBeNull();
    fireEvent.press(screen.getByTestId("esim-package-sa-7d"));
    fireEvent.press(screen.getByTestId("esim-buy-now"));
    for (const [field, value] of Object.entries({ firstName: "Maya", lastName: "Al Rashid", email: "maya@example.com", phoneNumber: "50123456" })) {
      fireEvent.changeText(screen.getByTestId(`esim-${field}`), value);
    }
    fireEvent.press(screen.getByTestId("esim-country"));
    fireEvent.changeText(screen.getByTestId("esim-country-search"), "Kuwait");
    fireEvent.press(screen.getByTestId("esim-country-option-KW"));
    fireEvent.press(screen.getByTestId("esim-details-next"));
    fireEvent.press(screen.getByTestId("esim-payment-cc"));
    mockQuote.mockResolvedValueOnce({ amountFils: 2563, baseAmountFils: 2500, paymentFeeFils: 63, amountKwd: 2.563, discountFils: 0, paymentMethod: "cc", product: { slug: "saudi-arabia", packageId: "sa-7d", title: "1 GB" } });
    fireEvent.press(screen.getByTestId("esim-pay"));
    await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());
    expect(screen.getByText("Payment method fee")).toBeTruthy();
    expect(screen.getByText("+ 0.063 KWD")).toBeTruthy();
    const confirm = screen.getByTestId("esim-confirm-checkout");
    expect(isDisabled(confirm)).toBe(true);
    expect(screen.getByText("I confirm this email address is correct")).toBeTruthy();
    expect(screen.queryByTestId("esim-send-guest-code")).toBeNull();
    expect(screen.queryByTestId("esim-guest-code")).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
    acknowledgeEmail(screen);
    expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(false);
    mockCreate.mockResolvedValueOnce({ order: { amountKwd: 2.563 }, paymentUrl: null });
    fireEvent.press(screen.getByTestId("esim-confirm-checkout"));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0].data.requestKey).toMatch(/^esim_[0-9a-f-]{36}$/);
    expect(mockCreate.mock.calls[0][0].data.billingAddress).toBe("Country: Kuwait");
    expect(mockCreate.mock.calls[0][0].data.customerMobile).toBe("+96550123456");
    expect(mockCreate.mock.calls[0][0].data.emailAcknowledged).toBe(true);
    expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty("privateGuestCode");
    expect(mockSendGuestCode).not.toHaveBeenCalled();
    expect(screen.UNSAFE_getAllByType(EsimIcon).length).toBeGreaterThan(0);
  });
  it("requires email acknowledgement before creating a guest order", async () => {
    const screen = await renderConnected(<ConnectedEsimCatalogScreen lang="en" selectedSlug="saudi-arabia" onClose={jest.fn()} onSelectDestination={jest.fn()} />);
    fireEvent.press(screen.getByTestId("esim-package-sa-7d"));
    fireEvent.press(screen.getByTestId("esim-buy-now"));
    for (const [field, value] of Object.entries({ firstName: "Maya", lastName: "Al Rashid", email: "maya@example.com", phoneNumber: "50123456" })) {
      fireEvent.changeText(screen.getByTestId(`esim-${field}`), value);
    }
    fireEvent.press(screen.getByTestId("esim-country"));
    fireEvent.changeText(screen.getByTestId("esim-country-search"), "Kuwait");
    fireEvent.press(screen.getByTestId("esim-country-option-KW"));
    fireEvent.press(screen.getByTestId("esim-details-next"));
    mockQuote.mockResolvedValueOnce({ amountFils: 2563, baseAmountFils: 2500, paymentFeeFils: 63, amountKwd: 2.563, discountFils: 0, paymentMethod: "cc", product: { slug: "saudi-arabia", packageId: "sa-7d", title: "1 GB" } });
    fireEvent.press(screen.getByTestId("esim-pay"));
    await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());
    expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(true);
    fireEvent.press(screen.getByTestId("esim-confirm-checkout"));
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSendGuestCode).not.toHaveBeenCalled();
  });
  it("parses only a labelled legacy Country and ignores other legacy address fields", () => {
    expect(parseBilling("12 Main, Kuwait")).toEqual({ country: "" });
    expect(parseBilling("Address line 1: 12 Main\nCity: Kuwait\nCountry: Kuwait")).toEqual({ country: "Kuwait" });
    expect(serializeBilling({ country: "Kuwait" })).toBe("Country: Kuwait");
    expect(normalizeNationalPhone("(501) 234-56")).toBe("50123456");
    expect(isValidE164("965", "501 234 56")).toBe(true);
    expect(isValidE164("1", "12345")).toBe(false);
    expect(isValidE164("123456789012345", "1")).toBe(false);
  });
  it("shows SVG icons on destinations and plans, including a failed remote flag fallback", () => {
    const screen = render(<EsimCatalogScreen lang="en" selectedSlug={null} onClose={jest.fn()} onSelectDestination={jest.fn()} />);
    const flag = screen.UNSAFE_getAllByType(Image).find((image) => String(image.props.source.uri).includes("flagcdn.com"));
    expect(flag).toBeTruthy();
    expect(flag!.props.source.uri).toContain("/w320/sa.png");
    expect(flag!.props.resizeMode).toBe("stretch");
    expect(StyleSheet.flatten(flag!.props.style)).toMatchObject({ width: 52, height: 32 });
    expect(StyleSheet.flatten(flag!.parent!.props.style)).toMatchObject({ backgroundColor: "transparent" });
    act(() => flag!.props.onError());
    expect(screen.UNSAFE_getAllByType(EsimIcon).some((icon) => icon.props.name === "compass")).toBe(true);
    expect(screen.getByTestId("esim-destination-saudi-arabia")).toBeTruthy();
  });
  it("uses recognizable regional and world maps on cards that open the correct destination", () => {
    const select = jest.fn();
    const screen = render(<EsimCatalogScreen lang="en" selectedSlug={null} onClose={jest.fn()} onSelectDestination={select} />);
    fireEvent.press(screen.getByTestId("esim-category-regional"));
    expect(screen.getByTestId("esim-region-icon-asia")).toBeTruthy();
    fireEvent.press(screen.getByTestId("esim-destination-asia"));
    expect(select).toHaveBeenCalledWith("asia");

    fireEvent.press(screen.getByTestId("esim-category-global"));
    expect(screen.getByTestId("esim-region-icon-world")).toBeTruthy();
    fireEvent.press(screen.getByTestId("esim-destination-world"));
    expect(select).toHaveBeenCalledWith("world");
  });
});

describe("email acknowledgement in private guest eSIM checkout", () => {
  const props = { lang: "en" as const, selectedSlug: "world", onClose: jest.fn(), onSelectDestination: jest.fn() };

  const openWorldReview = async (
    screen: ReturnType<typeof render>,
    method: "knet" | "cc" | "apple-pay" | "samsung-pay" = "cc",
  ) => {
    expect(mockDetailQueryOptions.query.initialData.destination.packages[0].isInStock).toBe(true);
    fireEvent.press(screen.getByTestId("esim-package-discover-in-3days-300mb"));
    fireEvent.press(screen.getByTestId("esim-buy-now"));
    for (const [field, value] of Object.entries({
      firstName: "Maya",
      lastName: "Al Rashid",
      email: "maya@example.com",
      phoneNumber: "50123456",
    })) {
      fireEvent.changeText(screen.getByTestId(`esim-${field}`), value);
    }
    fireEvent.press(screen.getByTestId("esim-country"));
    fireEvent.changeText(screen.getByTestId("esim-country-search"), "Kuwait");
    fireEvent.press(screen.getByTestId("esim-country-option-KW"));
    fireEvent.press(screen.getByTestId("esim-details-next"));
    fireEvent.press(screen.getByTestId(`esim-payment-${method}`));
    const feeFils = method === "knet" ? 0 : 8;
    mockQuote.mockResolvedValueOnce({
      amountFils: 313 + feeFils,
      baseAmountFils: 313,
      paymentFeeFils: feeFils,
      amountKwd: (313 + feeFils) / 1000,
      discountFils: 0,
      paymentMethod: method,
      product: { slug: "world", packageId: "discover-in-3days-300mb", title: "300 MB · 3 days" },
    });
    fireEvent.press(screen.getByTestId("esim-pay"));
    await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());
  };

  beforeEach(() => {
    mockPrivateTestEnabled = true;
    mockSignedIn = false;
    mockIsLoaded = true;
    mockPackageInStock = true;
    mockDetailFetchedAfterMount = true;
    mockDetailFetching = false;
    mockDetailStale = false;
    mockDetailRefreshError = false;
    mockQuote.mockReset();
    mockCreate.mockReset();
    mockSendGuestCode.mockReset();
  });

  afterEach(() => {
    mockPrivateTestEnabled = true;
    mockSignedIn = true;
    mockIsLoaded = true;
    mockPackageInStock = true;
  });

  it("requires acknowledgement and attaches it for the selected private world package", async () => {
    const actualPolicy = jest.requireActual("@/utils/esimPrivateTest") as typeof import("@/utils/esimPrivateTest");
    expect(actualPolicy.isPrivateEsimTestEnabled(false, "true")).toBe(true);
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    await openWorldReview(screen);

    expect(screen.queryByTestId("esim-send-guest-code")).toBeNull();
    expect(screen.queryByTestId("esim-guest-code")).toBeNull();
    expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();

    acknowledgeEmail(screen);
    mockCreate.mockResolvedValueOnce({ order: { amountKwd: 0.321 }, paymentUrl: null });
    fireEvent.press(screen.getByTestId("esim-confirm-checkout"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0].data).toMatchObject({
      slug: "world",
      packageId: "discover-in-3days-300mb",
      expectedAmountFils: 321,
      emailAcknowledged: true,
    });
    expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty("privateGuestCode");
    expect(mockSendGuestCode).not.toHaveBeenCalled();
    expect(mockQuote).toHaveBeenCalledWith({
      data: { slug: "world", packageId: "discover-in-3days-300mb", paymentMethod: "cc" },
    });
  });

  it("still requires acknowledgement when the private flag is off in a published build", async () => {
    mockPrivateTestEnabled = false;
    const actualPolicy = jest.requireActual("@/utils/esimPrivateTest") as typeof import("@/utils/esimPrivateTest");
    expect(actualPolicy.isPrivateEsimTestEnabled(false, "false")).toBe(false);
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    await openWorldReview(screen);

    expect(screen.queryByTestId("esim-send-guest-code")).toBeNull();
    expect(screen.queryByTestId("esim-guest-code")).toBeNull();
    expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
    acknowledgeEmail(screen);
    mockCreate.mockResolvedValueOnce({ order: { amountKwd: 0.321 }, paymentUrl: null });
    fireEvent.press(screen.getByTestId("esim-confirm-checkout"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0].data.emailAcknowledged).toBe(true);
    expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty("privateGuestCode");
    expect(mockSendGuestCode).not.toHaveBeenCalled();
  });

  it.each(["knet", "cc", "apple-pay", "samsung-pay"] as const)(
    "allows private guest checkout with %s and the matching final amount",
    async (method) => {
      const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} privateTest />);
      await openWorldReview(screen, method);
      const expectedAmountFils = method === "knet" ? 313 : 321;
      expect(mockQuote).toHaveBeenCalledWith({
        data: { slug: "world", packageId: "discover-in-3days-300mb", paymentMethod: method },
      });
      expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(true);
      expect(mockCreate).not.toHaveBeenCalled();
      acknowledgeEmail(screen);
      mockCreate.mockResolvedValueOnce({ order: { amountKwd: expectedAmountFils / 1000 }, paymentUrl: null });
      fireEvent.press(screen.getByTestId("esim-confirm-checkout"));
      await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
      expect(mockCreate.mock.calls[0][0].data).toMatchObject({
        slug: "world",
        packageId: "discover-in-3days-300mb",
        paymentMethod: method,
        expectedAmountFils,
        emailAcknowledged: true,
      });
      expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty("promoCode");
      expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty("privateGuestCode");
      expect(mockSendGuestCode).not.toHaveBeenCalled();
    },
  );

  it("clears acknowledgement when the guest changes email and requests a fresh review", async () => {
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    await openWorldReview(screen);
    acknowledgeEmail(screen);
    expect(screen.getByTestId("esim-email-acknowledgement").props.accessibilityState.checked).toBe(true);

    fireEvent.press(screen.getByTestId("esim-cancel-checkout"));
    fireEvent.press(screen.getByTestId("esim-checkout-back"));
    fireEvent.changeText(screen.getByTestId("esim-email"), "maya+corrected@example.com");
    fireEvent.press(screen.getByTestId("esim-details-next"));
    mockQuote.mockResolvedValueOnce({
      amountFils: 321,
      baseAmountFils: 313,
      paymentFeeFils: 8,
      amountKwd: 0.321,
      discountFils: 0,
      paymentMethod: "cc",
      product: { slug: "world", packageId: "discover-in-3days-300mb", title: "300 MB · 3 days" },
    });
    fireEvent.press(screen.getByTestId("esim-pay"));
    await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());

    expect(screen.getByTestId("esim-email-acknowledgement").props.accessibilityState.checked).toBe(false);
    expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(true);
    expect(mockQuote).toHaveBeenCalledTimes(2);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("disables checkout again if the buyer unchecks the email acknowledgement", async () => {
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    await openWorldReview(screen);
    expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(true);

    acknowledgeEmail(screen);
    expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(false);
    acknowledgeEmail(screen);
    expect(screen.getByTestId("esim-email-acknowledgement").props.accessibilityState.checked).toBe(false);
    expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(true);
    fireEvent.press(screen.getByTestId("esim-confirm-checkout"));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("starts a new checkout with acknowledgement cleared", async () => {
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    await openWorldReview(screen);
    acknowledgeEmail(screen);
    fireEvent.press(screen.getByTestId("esim-cancel-checkout"));
    fireEvent.press(screen.getByTestId("esim-checkout-back"));
    fireEvent.press(screen.getByTestId("esim-checkout-back"));

    fireEvent.press(screen.getByTestId("esim-buy-now"));
    fireEvent.changeText(screen.getByTestId("esim-lastName"), "Al Rashid");
    fireEvent.changeText(screen.getByTestId("esim-phoneNumber"), "50123456");
    fireEvent.press(screen.getByTestId("esim-country"));
    fireEvent.changeText(screen.getByTestId("esim-country-search"), "Kuwait");
    fireEvent.press(screen.getByTestId("esim-country-option-KW"));
    fireEvent.press(screen.getByTestId("esim-details-next"));
    mockQuote.mockResolvedValueOnce({
      amountFils: 321,
      baseAmountFils: 313,
      paymentFeeFils: 8,
      amountKwd: 0.321,
      discountFils: 0,
      paymentMethod: "cc",
      product: { slug: "world", packageId: "discover-in-3days-300mb", title: "300 MB · 3 days" },
    });
    fireEvent.press(screen.getByTestId("esim-pay"));
    await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());

    expect(screen.getByTestId("esim-email-acknowledgement").props.accessibilityState.checked).toBe(false);
    expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(true);
  });

  it("keeps the private package and price cap without restricting supported payment methods", () => {
    const policy = jest.requireActual("@/utils/esimPrivateTest") as typeof import("@/utils/esimPrivateTest");
    for (const method of ["knet", "cc", "apple-pay", "samsung-pay"]) {
      expect(policy.isPrivateEsimTrialQuote("world", "discover-in-3days-300mb", method, "", 321)).toBe(true);
    }
    expect(policy.isPrivateEsimTrialQuote("world", "discover-in-3days-300mb", "cash", "", 313)).toBe(false);
    expect(policy.isPrivateEsimTrialQuote("world", "discover-in-3days-300mb", "knet", "", 322)).toBe(false);
    expect(policy.isPrivateEsimTrialQuote("world", "discover-in-3days-300mb", "knet", "PROMO", 313)).toBe(false);
    expect(policy.isPrivateEsimTrialQuote("kuwait", "another-plan", "knet", "", 313)).toBe(false);
  });

  it("blocks an unsupported private package before opening customer details or requesting payment", async () => {
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} selectedSlug="saudi-arabia" privateTest />);
    fireEvent.press(screen.getByTestId("esim-package-sa-7d"));
    fireEvent.press(screen.getByTestId("esim-buy-now"));
    expect(screen.queryByTestId("esim-firstName")).toBeNull();
    expect(screen.getAllByText(/The private test only supports Global/).length).toBeGreaterThan(0);
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("guest eSIM recovery after reopening", () => {
  beforeEach(() => {
    mockIsLoaded = true;
    mockSignedIn = false;
    mockSendRecoveryCode.mockReset().mockResolvedValue({ ok: true });
    mockRecoverOrders.mockReset();
    mockDownloadGuestDocument.mockReset();
    mockSharedFiles.length = 0;
  });
  afterEach(() => { mockSignedIn = true; });

  it("requires a fresh email code, shows the completed guest order and saves its invoice and instructions", async () => {
    const props = { lang: "en" as const, selectedSlug: null, onClose: jest.fn(), onSelectDestination: jest.fn() };
    const initial = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    fireEvent.press(initial.getByTestId("esim-recover-guest"));
    expect(initial.queryByText("INSTALL-ONLY")).toBeNull();
    initial.unmount();

    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    fireEvent.press(screen.getByTestId("esim-recover-guest"));
    expect(screen.queryByTestId("esim-recovery-download")).toBeNull();
    fireEvent.changeText(screen.getByTestId("esim-recovery-email"), "Guest@inbox.test");
    fireEvent.press(screen.getByTestId("esim-recovery-send"));
    await waitFor(() => expect(mockSendRecoveryCode).toHaveBeenCalledWith({ data: { email: "Guest@inbox.test" } }));
    const order = {
      orderId: "fixture-guest-paid-0001", status: "completed", amountKwd: 2.5,
      product: { destination: "Testland", title: "Fixture 1 GB" },
      createdAt: "2026-09-01T00:00:00Z",
      activation: { id: "fixture", code: "INSTALL-ONLY", status: "completed", sims: [] },
    };
    mockRecoverOrders.mockRejectedValueOnce(new Error("Invalid code")).mockResolvedValueOnce({ orders: [order] });
    fireEvent.changeText(screen.getByTestId("esim-recovery-code"), "0000000000000000");
    fireEvent.press(screen.getByTestId("esim-recovery-verify"));
    await waitFor(() => expect(screen.getByText("Invalid or expired code. Request a new one.")).toBeTruthy());
    expect(screen.queryByTestId("esim-recovery-download")).toBeNull();
    fireEvent.changeText(screen.getByTestId("esim-recovery-code"), "ABCDEF1234567890");
    fireEvent.press(screen.getByTestId("esim-recovery-verify"));
    await waitFor(() => expect(screen.getByTestId(`esim-recovery-order-${order.orderId}`)).toBeTruthy());
    expect(screen.queryByTestId("esim-recovery-download")).toBeNull();
    fireEvent.press(screen.getByTestId(`esim-recovery-order-${order.orderId}`));
    expect(screen.getByText("Code: INSTALL-ONLY")).toBeTruthy();

    const html = "<html><h1>Paid eSIM invoice</h1><h2>Installation instructions</h2>INSTALL-ONLY</html>";
    mockDownloadGuestDocument.mockResolvedValueOnce(html);
    const Sharing = require("expo-sharing") as typeof import("expo-sharing");
    jest.spyOn(Sharing, "isAvailableAsync").mockResolvedValueOnce(true);
    const share = jest.spyOn(Sharing, "shareAsync").mockResolvedValueOnce();
    fireEvent.press(screen.getByTestId("esim-recovery-download"));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(mockDownloadGuestDocument).toHaveBeenCalledWith(
      { email: "Guest@inbox.test", code: "ABCDEF1234567890", orderId: order.orderId },
      { responseType: "text" },
    );
    expect(mockSharedFiles[0].html).toBe(html);
    expect(share).toHaveBeenCalledWith(mockSharedFiles[0].uri, expect.objectContaining({ mimeType: "text/html" }));
    await waitFor(() => expect(mockSharedFiles[0].deleted).toBe(true));
    fireEvent.press(screen.getByTestId("esim-recovery-close"));
    expect(screen.queryByText("Code: INSTALL-ONLY")).toBeNull();
    share.mockRestore();
  });
});

describe("bundled eSIM catalog", () => {
  beforeEach(() => {
    mockCatalogRefreshError = false;
    mockDetailRefreshError = false;
    mockDetailFetchedAfterMount = false;
    mockDetailFetching = true;
    mockDetailStale = true;
    mockCatalogQueryOptions = undefined;
    mockDetailQueryOptions = undefined;
  });

  it("shows bundled destinations and destination packages immediately while refreshing", () => {
    const browse = render(<EsimCatalogScreen lang="en" selectedSlug={null} onClose={jest.fn()} onSelectDestination={jest.fn()} />);
    expect(browse.getByTestId("esim-destination-saudi-arabia")).toBeTruthy();
    expect(mockCatalogQueryOptions.query.initialDataUpdatedAt).toBe(0);

    const detail = render(<EsimCatalogScreen lang="en" selectedSlug="saudi-arabia" onClose={jest.fn()} onSelectDestination={jest.fn()} />);
    expect(detail.getByTestId("esim-package-sa-7d")).toBeTruthy();
    expect(mockDetailQueryOptions.query.initialDataUpdatedAt).toBe(0);
    fireEvent.press(detail.getByTestId("esim-package-sa-7d"));
    expect(detail.getAllByText("Saudi Arabia").length).toBeGreaterThan(0);
    expect(detail.getByTestId("esim-coverage-link")).toBeTruthy();
  });

  it("opens a searchable plan coverage sheet and expandable eSIM answers", () => {
    const screen = render(<EsimCatalogScreen lang="en" selectedSlug="saudi-arabia" onClose={jest.fn()} onSelectDestination={jest.fn()} />);
    expect(screen.queryByTestId("esim-coverage-link")).toBeNull();
    fireEvent.press(screen.getByTestId("esim-package-sa-7d"));
    fireEvent.press(screen.getByTestId("esim-coverage-link"));
    expect(screen.getByText("Covered countries (1)")).toBeTruthy();
    expect(screen.getByText("4G")).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("esim-coverage-search"), "not-a-country");
    expect(screen.getByText("No matching countries.")).toBeTruthy();
    fireEvent.press(screen.getByTestId("esim-coverage-close"));
    fireEvent.press(screen.getByTestId("esim-faq-0"));
    expect(screen.getByText(/Check the destinations covered/)).toBeTruthy();
    fireEvent.press(screen.getByTestId("esim-faq-1"));
    expect(screen.queryByText(/Check the destinations covered/)).toBeNull();
  });

  it("keeps bundled catalog and destination content visible when background refresh fails", () => {
    mockCatalogRefreshError = true;
    mockDetailRefreshError = true;
    mockDetailFetching = false;
    const browse = render(<EsimCatalogScreen lang="en" selectedSlug={null} onClose={jest.fn()} onSelectDestination={jest.fn()} />);
    expect(browse.getByTestId("esim-destination-saudi-arabia")).toBeTruthy();
    expect(browse.queryByText("Coverage is unavailable")).toBeNull();

    const detail = render(<EsimCatalogScreen lang="en" selectedSlug="saudi-arabia" onClose={jest.fn()} onSelectDestination={jest.fn()} />);
    expect(detail.getByTestId("esim-package-sa-7d")).toBeTruthy();
    expect(detail.queryByText("We couldn't load packages for this destination.")).toBeNull();
  });
});

describe("checkout security transitions", () => {
  const props = { lang: "en" as const, selectedSlug: "saudi-arabia", onClose: jest.fn(), onSelectDestination: jest.fn() };
  const fill = (screen: ReturnType<typeof render>) => {
    fireEvent.press(screen.getByTestId("esim-package-sa-7d"));
    fireEvent.press(screen.getByTestId("esim-buy-now"));
    for (const [field, value] of Object.entries({ firstName: "Maya", lastName: "Al Rashid", email: "maya@example.com", phoneNumber: "50123456" })) {
      fireEvent.changeText(screen.getByTestId(`esim-${field}`), value);
    }
    fireEvent.press(screen.getByTestId("esim-country"));
    fireEvent.changeText(screen.getByTestId("esim-country-search"), "Kuwait");
    fireEvent.press(screen.getByTestId("esim-country-option-KW"));
    fireEvent.press(screen.getByTestId("esim-details-next"));
  };
  beforeEach(() => {
    mockIsLoaded = true; mockSignedIn = true; mockSessionId = "session-test";
    mockPackageInStock = true;
    mockDetailFetchedAfterMount = true;
    mockDetailFetching = false;
    mockDetailStale = false;
    mockDetailRefreshError = false;
    mockUnstableGetToken = false;
    mockQuote.mockReset(); mockCreate.mockReset(); mockSendGuestCode.mockReset();
    mockRequestToken.mockReset().mockResolvedValue("signed-in-test-token");
  });
  afterEach(() => { mockIsLoaded = true; mockSignedIn = true; mockSessionId = "session-test"; mockUnstableGetToken = false; });

  it("does not restart signed-in auth on every render when Clerk changes getToken identity", async () => {
    mockUnstableGetToken = true;
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    await waitFor(() => expect(mockRequestToken).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
    screen.rerender(<ConnectedEsimCatalogScreen {...props} />);
    await act(async () => { await Promise.resolve(); });
    expect(mockRequestToken).toHaveBeenCalledTimes(1);
  });

  it("keeps browsing responsive through token getter changes and refocus, then closes to Home", async () => {
    let onActive: ((state: string) => void) | undefined;
    const appStateSpy = jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => {
      onActive = callback as (state: string) => void;
      return { remove: jest.fn() };
    });
    mockUnstableGetToken = true;
    const onClose = jest.fn();
    const onSelectDestination = jest.fn();
    let screen: ReturnType<typeof render> | undefined;
    try {
      // This parent mirrors Home's selectedSlug/onClose handoff; no checkout or payment is invoked.
      function HomeHandoff() {
        const [slug, setSlug] = React.useState<string | null>(null);
        const [open, setOpen] = React.useState(true);
        return open
          ? <ConnectedEsimCatalogScreen
              lang="en"
              selectedSlug={slug}
              onSelectDestination={(next) => { onSelectDestination(next); setSlug(next); }}
              onClose={() => { onClose(); setOpen(false); }}
            />
          : null;
      }
      screen = render(<HomeHandoff />);
      await waitFor(() => expect(screen!.getByTestId("esim-my-esims")).toBeTruthy());
      const initialCalls = mockRequestToken.mock.calls.length;
      expect(initialCalls).toBe(1);
      expect(screen.getByTestId("esim-destination-saudi-arabia")).toBeTruthy();
      fireEvent.changeText(screen.getByTestId("esim-search"), "Saudi");
      expect(screen.getByTestId("esim-destination-saudi-arabia")).toBeTruthy();
      screen.rerender(<HomeHandoff />);
      await act(async () => { await Promise.resolve(); });
      expect(mockRequestToken).toHaveBeenCalledTimes(initialCalls);

      act(() => onActive?.("active"));
      await waitFor(() => expect(mockRequestToken).toHaveBeenCalledTimes(initialCalls + 1));
      await waitFor(() => expect(screen!.getByTestId("esim-my-esims")).toBeTruthy());
      fireEvent.press(screen.getByTestId("esim-destination-saudi-arabia"));
      expect(onSelectDestination).toHaveBeenCalledWith("saudi-arabia");
      expect(screen.getByTestId("esim-package-sa-7d")).toBeTruthy();
      fireEvent.press(screen.getByTestId("esim-back"));
      expect(screen.getByTestId("esim-search")).toBeTruthy();
      fireEvent.press(screen.getByTestId("esim-back"));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("esim-search")).toBeNull();
      expect(mockQuote).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    } finally {
      screen?.unmount();
      appStateSpy.mockRestore();
    }
  });

  it("explains a private-test plan rejection without claiming KNET failed", async () => {
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    await waitFor(() => expect(mockRequestToken).toHaveBeenCalled());
    fill(screen);
    mockQuote.mockResolvedValueOnce({ amountFils: 2563, baseAmountFils: 2500, paymentFeeFils: 63, amountKwd: 2.563, discountFils: 0, paymentMethod: "cc", product: { slug: "saudi-arabia", packageId: "sa-7d" } });
    fireEvent.press(screen.getByTestId("esim-pay"));
    await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());
    mockCreate.mockRejectedValueOnce({ status: 403 });
    acknowledgeEmail(screen);
    fireEvent.press(screen.getByTestId("esim-confirm-checkout"));
    await waitFor(() => expect(screen.getAllByText("This plan or account isn't enabled for the private test. No payment link was created.").length).toBeGreaterThan(0));
    expect(mockCreate.mock.calls[0][0].data.emailAcknowledged).toBe(true);
    expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty("privateGuestCode");
    expect(mockSendGuestCode).not.toHaveBeenCalled();
  });

  it("never sends an anonymous quote when a signed-in token fails, and retries auth", async () => {
    mockRequestToken.mockResolvedValueOnce(null);
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    fill(screen);
    fireEvent.press(screen.getByTestId("esim-pay"));
    expect(mockQuote).not.toHaveBeenCalled();
    await waitFor(() => expect(mockRequestToken).toHaveBeenCalled());
    await act(async () => { fireEvent.press(screen.getByTestId("esim-auth-retry")); await Promise.resolve(); });
    await waitFor(() => expect(screen.queryByTestId("esim-auth-retry")).toBeNull());
    mockQuote.mockResolvedValueOnce({ amountFils: 2563, baseAmountFils: 2500, paymentFeeFils: 63, amountKwd: 2.563, discountFils: 0, paymentMethod: "cc", product: { slug: "saudi-arabia", packageId: "sa-7d" } });
    fireEvent.press(screen.getByTestId("esim-pay"));
    await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());
    expect(screen.queryByText(/payment fee/i)).toBeNull();
  });

  it("does not treat Clerk loading as guest checkout", () => {
    mockIsLoaded = false;
    mockSignedIn = false;
    const screen = render(<ConnectedEsimCatalogScreen {...props} />);
    fill(screen);
    expect(screen.queryByTestId("esim-confirmEmail")).toBeNull();
    fireEvent.press(screen.getByTestId("esim-pay"));
    expect(mockQuote).not.toHaveBeenCalled();
    expect(screen.getByTestId("esim-auth-retry")).toBeTruthy();
  });

  it("blocks order submission if a signed-in token becomes pending after quote review", async () => {
    let onActive: ((state: string) => void) | undefined;
    const appStateSpy = jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => {
      onActive = callback as (state: string) => void;
      return { remove: jest.fn() };
    });
    let screen: ReturnType<typeof render> | undefined;
    try {
      screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
      await waitFor(() => expect(mockRequestToken).toHaveBeenCalled());
      await act(async () => { await Promise.resolve(); });
      fill(screen);
      mockQuote.mockResolvedValueOnce({ amountFils: 2563, baseAmountFils: 2500, paymentFeeFils: 63, amountKwd: 2.563, discountFils: 0, paymentMethod: "cc", product: { slug: "saudi-arabia", packageId: "sa-7d" } });
      fireEvent.press(screen.getByTestId("esim-pay"));
      await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());
      mockRequestToken.mockImplementationOnce(() => new Promise<string | null>(() => undefined));
      act(() => onActive?.("active"));
      await waitFor(() => expect(screen.getByTestId("esim-auth-retry-review")).toBeTruthy());
      acknowledgeEmail(screen);
      fireEvent.press(screen.getByTestId("esim-confirm-checkout"));
      expect(mockCreate).not.toHaveBeenCalled();
      expect(screen.getAllByText(/Waiting for your sign-in to finish/).length).toBeGreaterThan(0);
    } finally { screen?.unmount(); appStateSpy.mockRestore(); }
  });

  it("clears the review acknowledgement when the signed-in session changes", async () => {
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    await waitFor(() => expect(mockRequestToken).toHaveBeenCalledTimes(1));
    fill(screen);
    mockQuote.mockResolvedValueOnce({ amountFils: 2563, baseAmountFils: 2500, paymentFeeFils: 63, amountKwd: 2.563, discountFils: 0, paymentMethod: "cc", product: { slug: "saudi-arabia", packageId: "sa-7d" } });
    fireEvent.press(screen.getByTestId("esim-pay"));
    await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());
    acknowledgeEmail(screen);
    expect(screen.getByTestId("esim-email-acknowledgement").props.accessibilityState.checked).toBe(true);

    mockSessionId = "different-buyer-session";
    screen.rerender(<ConnectedEsimCatalogScreen {...props} />);
    await waitFor(() => expect(mockRequestToken).toHaveBeenCalledTimes(2));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByTestId("esim-confirm-checkout")).toBeNull();

    fill(screen);
    mockQuote.mockResolvedValueOnce({ amountFils: 2563, baseAmountFils: 2500, paymentFeeFils: 63, amountKwd: 2.563, discountFils: 0, paymentMethod: "cc", product: { slug: "saudi-arabia", packageId: "sa-7d" } });
    fireEvent.press(screen.getByTestId("esim-pay"));
    await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());
    expect(screen.getByTestId("esim-email-acknowledgement").props.accessibilityState.checked).toBe(false);
    expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each([
    "This eSIM checkout cannot be resumed",
    "Private trial order already exists with different customer details",
    "The selected eSIM package is temporarily out of stock",
    undefined,
  ])("does not disguise a checkout conflict as a price refresh (%s)", async (message) => {
    mockSignedIn = false;
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    try {
      const screen = render(<ConnectedEsimCatalogScreen {...props} />);
      fill(screen);
      mockQuote.mockResolvedValueOnce({
        amountFils: 2563, baseAmountFils: 2500, paymentFeeFils: 63, amountKwd: 2.563,
        discountFils: 0, paymentMethod: "cc",
        product: { slug: "saudi-arabia", packageId: "sa-7d" },
      });
      fireEvent.press(screen.getByTestId("esim-pay"));
      await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());
      mockCreate.mockRejectedValueOnce({ status: 409, data: { error: message } });
      acknowledgeEmail(screen);
      fireEvent.press(screen.getByTestId("esim-confirm-checkout"));
      await waitFor(() => expect(screen.getByText("Checkout needs review")).toBeTruthy());
      expect(screen.queryByText("Quote refreshed — review again")).toBeNull();
      expect(mockQuote).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(true);
      fireEvent.press(screen.getByTestId("esim-confirm-checkout"));
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(openUrl).not.toHaveBeenCalled();
      expect(mockSendGuestCode).not.toHaveBeenCalled();
    } finally {
      openUrl.mockRestore();
    }
  });

  it("preserves the original guest request key and review until a pending payment URL is ready", async () => {
    mockSignedIn = false;
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValueOnce();
    try {
      const screen = render(<ConnectedEsimCatalogScreen {...props} />);
      fill(screen);
      mockQuote.mockResolvedValueOnce({ amountFils: 2563, baseAmountFils: 2500, paymentFeeFils: 63, amountKwd: 2.563, discountFils: 0, paymentMethod: "cc", product: { slug: "saudi-arabia", packageId: "sa-7d" } });
      fireEvent.press(screen.getByTestId("esim-pay"));
      await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());
      acknowledgeEmail(screen);
      expect(screen.getByTestId("esim-email-acknowledgement").props.accessibilityState.checked).toBe(true);
      mockCreate.mockResolvedValueOnce({ order: { amountKwd: 2.563 }, paymentUrl: null });
      fireEvent.press(screen.getByTestId("esim-confirm-checkout"));
      await waitFor(() => expect(screen.getByText("Retry secure payment link")).toBeTruthy());
      expect(screen.getByTestId("esim-cancel-checkout").props.accessibilityState?.disabled ?? screen.getByTestId("esim-cancel-checkout").props.disabled).toBe(true);
      expect(screen.getByTestId("esim-email-acknowledgement").props.accessibilityState.checked).toBe(true);
      mockCreate.mockResolvedValueOnce({ order: { amountKwd: 2.563 }, paymentUrl: "https://www.upayments.com/pay/test-invoice" });
      fireEvent.press(screen.getByTestId("esim-confirm-checkout"));
      await waitFor(() => expect(openUrl).toHaveBeenCalledWith("https://www.upayments.com/pay/test-invoice"));
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(mockCreate.mock.calls[1][0].data.requestKey).toBe(mockCreate.mock.calls[0][0].data.requestKey);
      expect(mockCreate.mock.calls[0][0].data).toMatchObject({ email: "maya@example.com", emailAcknowledged: true });
      expect(mockCreate.mock.calls[1][0].data).toMatchObject({ email: "maya@example.com", emailAcknowledged: true });
      expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty("privateGuestCode");
      expect(mockSendGuestCode).not.toHaveBeenCalled();
      expect(screen.getByText(/Check your email for your order confirmation/)).toBeTruthy();
    } finally { openUrl.mockRestore(); }
  });
});

describe("stock-backed eSIM checkout", () => {
  const props = { lang: "en" as const, selectedSlug: "saudi-arabia", onClose: jest.fn(), onSelectDestination: jest.fn() };
  const fillCustomerDetails = (screen: ReturnType<typeof render>) => {
    fireEvent.press(screen.getByTestId("esim-package-sa-7d"));
    fireEvent.press(screen.getByTestId("esim-buy-now"));
    for (const [field, value] of Object.entries({ firstName: "Maya", lastName: "Al Rashid", email: "maya@example.com", phoneNumber: "50123456" })) {
      fireEvent.changeText(screen.getByTestId(`esim-${field}`), value);
    }
    fireEvent.press(screen.getByTestId("esim-country"));
    fireEvent.changeText(screen.getByTestId("esim-country-search"), "Kuwait");
    fireEvent.press(screen.getByTestId("esim-country-option-KW"));
    fireEvent.press(screen.getByTestId("esim-details-next"));
  };

  beforeEach(() => {
    mockPackageInStock = undefined;
    mockDetailFetchedAfterMount = false;
    mockDetailFetching = false;
    mockDetailStale = true;
    mockDetailRefreshError = false;
    mockIsLoaded = true;
    mockSignedIn = true;
    mockSessionId = "session-test";
    mockRequestToken.mockReset().mockResolvedValue("signed-in-test-token");
    mockQuote.mockReset();
    mockCreate.mockReset();
    mockSendGuestCode.mockReset();
  });
  afterEach(() => {
    mockPackageInStock = undefined;
    mockIsLoaded = true;
    mockSignedIn = true;
    mockSessionId = "session-test";
  });

  it("disables buying and displays an out-of-stock hint when the catalog package is unavailable", async () => {
    mockPackageInStock = false;
    mockDetailFetchedAfterMount = true;
    mockDetailStale = false;
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    fireEvent.press(screen.getByTestId("esim-package-sa-7d"));

    const buyButton = screen.getByTestId("esim-buy-now");
    expect(buyButton.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("This eSIM is currently out of stock.")).toBeTruthy();
    fireEvent.press(buyButton);
    expect(screen.queryByTestId("esim-firstName")).toBeNull();
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("allows an on-demand quote when the live catalogue has no stock flag, then respects the server checkout gate", async () => {
    mockPackageInStock = undefined;
    mockDetailFetchedAfterMount = true;
    mockDetailFetching = false;
    mockDetailStale = false;
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    await waitFor(() => expect(mockRequestToken).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.press(screen.getByTestId("esim-package-sa-7d"));

    const buyButton = screen.getByTestId("esim-buy-now");
    expect(buyButton.props.accessibilityState.disabled).toBe(false);
    expect(screen.getByText("Catalog listings aren't a booking guarantee. We'll confirm your eSIM after you order.")).toBeTruthy();
    fillCustomerDetails(screen);

    const currentQuote = {
      amountFils: 2563,
      baseAmountFils: 2500,
      paymentFeeFils: 63,
      amountKwd: 2.563,
      discountFils: 0,
      paymentMethod: "cc",
      product: { slug: "saudi-arabia", packageId: "sa-7d", title: "1 GB" },
    };
    mockQuote.mockResolvedValueOnce(currentQuote);
    fireEvent.press(screen.getByTestId("esim-pay"));
    await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());
    expect(mockQuote).toHaveBeenCalledWith({
      data: { slug: "saudi-arabia", packageId: "sa-7d", paymentMethod: "cc" },
    });

    // The backend rejects the capture-first checkout while its explicit
    // on-demand release gate is disabled; the client does not invent stock or
    // open a payment URL in response to that failure.
    mockCreate.mockRejectedValueOnce({ status: 503, data: { error: "On-demand eSIM checkout is disabled" } });
    acknowledgeEmail(screen);
    fireEvent.press(screen.getByTestId("esim-confirm-checkout"));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0].data).toMatchObject({
      slug: "saudi-arabia",
      packageId: "sa-7d",
      expectedAmountFils: 2563,
      emailAcknowledged: true,
    });
    expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty("privateGuestCode");
    expect(mockCreate.mock.calls[0][0].data.requestKey).toMatch(/^esim_/);
    expect(mockOrderDetailRead).not.toHaveBeenCalled();
  });

  it("allows an in-stock package through to the KNET, card, and wallet payment choices", async () => {
    mockPackageInStock = true;
    mockDetailFetchedAfterMount = true;
    mockDetailStale = false;
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    const buyButton = screen.getByTestId("esim-buy-now");
    fireEvent.press(screen.getByTestId("esim-package-sa-7d"));
    expect(buyButton.props.accessibilityState.disabled).toBe(false);

    fillCustomerDetails(screen);
    for (const method of ["knet", "cc", "apple-pay", "samsung-pay"]) {
      expect(screen.getByTestId(`esim-payment-${method}`)).toBeTruthy();
    }
    expect(screen.getByText("KNET")).toBeTruthy();
    expect(within(screen.getByTestId("esim-payment-cc")).getByText("Visa / Mastercard")).toBeTruthy();
    expect(screen.getByText("Apple Pay")).toBeTruthy();
    expect(screen.getByText("Samsung Pay")).toBeTruthy();
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("shows the server out-of-stock quote error without creating an order or payment", async () => {
    mockPackageInStock = true;
    mockDetailFetchedAfterMount = true;
    mockDetailStale = false;
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    await waitFor(() => expect(mockRequestToken).toHaveBeenCalled());
    fillCustomerDetails(screen);
    mockQuote.mockRejectedValueOnce({ status: 409 });

    fireEvent.press(screen.getByTestId("esim-pay"));

    await waitFor(() => expect(screen.getAllByText("This eSIM is out of stock. Choose another plan; no payment was created.").length).toBeGreaterThan(0));
    expect(mockQuote).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("esim-confirm-checkout")).toBeNull();
  });

  it("requires fresh customer confirmation after the final server price changes", async () => {
    mockPackageInStock = true;
    mockDetailFetchedAfterMount = true;
    mockDetailStale = false;
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    await waitFor(() => expect(mockRequestToken).toHaveBeenCalled());
    fillCustomerDetails(screen);
    mockQuote
      .mockResolvedValueOnce({
        amountFils: 2563, baseAmountFils: 2500, paymentFeeFils: 63, amountKwd: 2.563,
        discountFils: 0, paymentMethod: "cc",
        product: { slug: "saudi-arabia", packageId: "sa-7d", title: "1 GB" },
      })
      .mockResolvedValueOnce({
        amountFils: 2706, baseAmountFils: 2640, paymentFeeFils: 66, amountKwd: 2.706,
        discountFils: 0, paymentMethod: "cc",
        product: { slug: "saudi-arabia", packageId: "sa-7d", title: "1 GB" },
      });
    fireEvent.press(screen.getByTestId("esim-pay"));
    await waitFor(() => expect(screen.getByTestId("esim-confirm-checkout")).toBeTruthy());
    mockCreate.mockRejectedValueOnce({
      status: 409,
      data: { error: "The eSIM price changed. Review the latest quote before confirming checkout." },
    }).mockRejectedValueOnce({ status: 503 });
    acknowledgeEmail(screen);
    fireEvent.press(screen.getByTestId("esim-confirm-checkout"));

    await waitFor(() => expect(screen.getByText("Quote refreshed — review again")).toBeTruthy());
    expect(screen.getByText("2.706 KWD")).toBeTruthy();
    expect(isDisabled(screen.getByTestId("esim-confirm-checkout"))).toBe(true);
    expect(screen.getByTestId("esim-email-acknowledgement").props.accessibilityState.checked).toBe(false);
    expect(mockQuote).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].data.expectedAmountFils).toBe(2563);
    expect(mockCreate.mock.calls[0][0].data.emailAcknowledged).toBe(true);

    acknowledgeEmail(screen);
    fireEvent.press(screen.getByTestId("esim-confirm-checkout"));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
    expect(mockCreate.mock.calls[1][0].data.expectedAmountFils).toBe(2706);
    expect(mockCreate.mock.calls[1][0].data.emailAcknowledged).toBe(true);
    expect(mockCreate.mock.calls[1][0].data.requestKey).not.toBe(mockCreate.mock.calls[0][0].data.requestKey);
  });

  it.each([
    {
      name: "bundled availability is not yet refreshed",
      stock: undefined,
      fetched: false,
      fetching: false,
      stale: true,
      error: false,
      hint: "Checking the latest plan details…",
    },
    {
      name: "the live catalog confirms the package is out of stock",
      stock: false,
      fetched: true,
      fetching: false,
      stale: false,
      error: false,
      hint: "This eSIM is currently out of stock.",
    },
    {
      name: "a cached in-stock result is being refreshed",
      stock: true,
      fetched: true,
      fetching: true,
      stale: true,
      error: false,
      hint: "Checking the latest plan details…",
    },
    {
      name: "a cached in-stock result is stale",
      stock: true,
      fetched: true,
      fetching: false,
      stale: true,
      error: false,
      hint: "Checking the latest plan details…",
    },
    {
      name: "a live refresh failed after a cached in-stock result",
      stock: true,
      fetched: true,
      fetching: false,
      stale: true,
      error: true,
      hint: "We couldn't refresh this plan. Try again when the current plan details are available.",
    },
  ])("does not hand off when $name", async ({ stock, fetched, fetching, stale, error, hint }) => {
    mockPackageInStock = stock;
    mockDetailFetchedAfterMount = fetched;
    mockDetailFetching = fetching;
    mockDetailStale = stale;
    mockDetailRefreshError = error;
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    fireEvent.press(screen.getByTestId("esim-package-sa-7d"));

    const buyButton = screen.getByTestId("esim-buy-now");
    expect(buyButton.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(hint)).toBeTruthy();
    fireEvent.press(buyButton);

    expect(screen.queryByTestId("esim-firstName")).toBeNull();
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("capture-first eSIM payment return", () => {
  const orderId = "ESIM-0123456789ABCDEF0123456789ABCD";
  const props = {
    lang: "en" as const,
    onClose: jest.fn(),
    selectedSlug: null,
    initialShowOrders: true,
    paymentReturnSeq: 1,
    paymentReturnOrderId: orderId,
    paymentReturnRecovery: true,
    onSelectDestination: jest.fn(),
  };

  beforeEach(() => {
    mockSignedIn = true;
    mockIsLoaded = true;
    mockSessionId = "session-test";
    mockRequestToken.mockReset().mockResolvedValue("signed-in-test-token");
    mockCreate.mockReset();
    mockQuote.mockReset();
    mockOwnedOrderDetail = {
      orderId,
      status: "payment_pending",
      amountKwd: 0.321,
      product: { destination: "Global", title: "300 MB · 3 days" },
      createdAt: "2026-10-01T00:00:00Z",
      activation: null,
    };
    mockOrderDetailRead.mockReset().mockImplementation(async (requestedOrderId: string) => ({
      data: requestedOrderId === orderId ? mockOwnedOrderDetail : undefined,
    }));
  });

  afterEach(() => {
    mockSignedIn = true;
    mockIsLoaded = true;
    mockSessionId = "session-test";
    mockOwnedOrderDetail = null;
    jest.useRealTimers();
  });

  it("checks only the returned order for ten seconds, never resubmits payment, and reveals the QR after a read-only completion", async () => {
    jest.useFakeTimers();
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);

    expect(screen.getByTestId("esim-payment-status-message").props.children)
      .toBe("Checking this payment and eSIM order. Please don't pay again.");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });

    expect(mockOrderDetailRead).toHaveBeenCalled();
    expect(mockOrderDetailRead.mock.calls.every(([requestedOrderId]) => requestedOrderId === orderId)).toBe(true);
    expect(screen.getByTestId("esim-payment-status-message").props.children)
      .toBe("This order is taking longer to update. We'll keep checking this same order; please don't pay again.");
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();

    mockOwnedOrderDetail = {
      ...mockOwnedOrderDetail,
      status: "completed",
      activation: { id: "fixture", status: "completed", code: "INSTALL", sims: [] },
    };
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });
    expect(mockOrderDetailRead.mock.calls.every(([requestedOrderId]) => requestedOrderId === orderId)).toBe(true);
    expect(screen.getByTestId("esim-download")).toBeTruthy();
    expect(screen.queryByTestId("esim-payment-status-message")).toBeNull();
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    screen.unmount();
  });

  it("shows truthful payment-check messaging for Arabic users as well", async () => {
    const screen = await renderConnected(<ConnectedEsimCatalogScreen {...props} lang="ar" />);
    expect(screen.getByTestId("esim-payment-status-message").props.children)
      .toBe("نتحقق من الدفع وطلب الشريحة. يرجى عدم الدفع مرة أخرى.");
    screen.unmount();
  });

  it("stops a pending callback read when its signed-in session changes and never reads a guest callback by ID", async () => {
    jest.useFakeTimers();
    const signedInScreen = await renderConnected(<ConnectedEsimCatalogScreen {...props} />);
    expect(signedInScreen.getByTestId("esim-payment-status-message")).toBeTruthy();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
    });
    expect(mockOrderDetailRead).toHaveBeenCalledTimes(1);
    expect(mockOrderDetailRead).toHaveBeenCalledWith(orderId);

    mockSessionId = "different-account-session";
    signedInScreen.rerender(<ConnectedEsimCatalogScreen {...props} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(mockOrderDetailRead).toHaveBeenCalledTimes(1);
    expect(signedInScreen.queryByTestId("esim-payment-status-message")).toBeNull();
    signedInScreen.unmount();

    mockSignedIn = false;
    mockSessionId = null;
    mockOrderDetailRead.mockClear();
    const guestScreen = render(<ConnectedEsimCatalogScreen {...props} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(guestScreen.getByText(/recover the order with your purchase email/i)).toBeTruthy();
    expect(mockOrderDetailRead).not.toHaveBeenCalled();
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    guestScreen.unmount();
  });
});