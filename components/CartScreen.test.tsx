import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import { CartScreen } from "./CartScreen";

const mockClearCart = jest.fn();
const mockProduct = {
  id: "universal-adapter",
  name: { en: "Universal Travel Adapter Pro", ar: "محول سفر عالمي برو" },
  desc: { en: "Adapter", ar: "محول" },
  priceKwd: 12.5,
  category: "electrical" as const,
  image: 1,
};

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@/components/HotelPortalIcon", () => ({
  HotelPortalIcon: ({ name }: { name: string }) => {
    const { Text } = require("react-native");
    return <Text>{name}</Text>;
  },
}));

jest.mock("@/components/PaymentMethodLogo", () => ({
  PaymentMethodLogo: ({ method }: { method: string }) => {
    const { Text } = require("react-native");
    return <Text>{method}</Text>;
  },
}));

jest.mock("@/components/StoreTermsModal", () => ({
  StoreTermsModal: () => null,
}));

jest.mock("@/components/KuwaitAreaPicker", () => ({
  KuwaitAreaPicker: ({ value, lang, onChange }: { value: string; lang: "en" | "ar"; onChange: (value: string) => void }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable accessibilityLabel={lang === "ar" ? "اختر المنطقة" : "Select area"} onPress={() => onChange("Salmiya")}>
        <Text>{value || (lang === "ar" ? "اختر المنطقة" : "Select area")}</Text>
      </Pressable>
    );
  },
}));

jest.mock("@/components/DeliveryLocationPicker", () => ({
  DeliveryLocationPicker: ({ value, lang, onChange }: {
    value: { latitude: number; longitude: number } | null;
    lang: "en" | "ar";
    onChange: (value: { latitude: number; longitude: number }) => void;
  }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable
        accessibilityLabel={lang === "ar" ? "استخدم موقع التوصيل الحالي" : "Use current delivery location"}
        onPress={() => onChange({ latitude: 29.3375, longitude: 48.075 })}
      >
        <Text>{value ? "location-saved" : "location-required"}</Text>
      </Pressable>
    );
  },
}));

jest.mock("@/lib/cartContext", () => ({
  useCart: () => {
    const React = require("react");
    const [items, setItems] = React.useState([{ productId: "universal-adapter", quantity: 1 }]);
    return {
      items,
      removeFromCart: (productId: string) => setItems(current => current.filter(item => item.productId !== productId)),
      updateQuantity: (productId: string, quantity: number) => setItems(current => current.map(item => (
        item.productId === productId ? { ...item, quantity } : item
      ))),
      clearCart: mockClearCart,
      stockByProductId: { "universal-adapter": 10 },
      catalog: [mockProduct],
      setCatalog: jest.fn(),
    };
  },
}));

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock("@/utils/pushTokenLink", () => ({
  registerPushToken: jest.fn().mockResolvedValue(undefined),
  getPushRegistrationIdentity: jest.fn().mockResolvedValue({ deviceId: "test-device", expoPushToken: null }),
}));

function response(body: unknown, ok = true) {
  return { ok, json: jest.fn().mockResolvedValue(body) };
}

function installFetchMock(orderStatus: unknown = { paid: true }) {
  return jest.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/store/products")) return response({ products: [mockProduct] }) as Response;
    if (url.endsWith("/store/quote")) {
      return response({ ok: true, subtotalKwd: 25, feeKwd: 0.5, deliveryKwd: 1.5, chargeKwd: 27 }) as Response;
    }
    if (url.endsWith("/store/checkout")) {
      return response({
        ok: true,
        orderId: "STORE-123",
        url: "https://pay.upayments.com/checkout/STORE-123",
        subtotalKwd: 25,
        feeKwd: 0.5,
        deliveryKwd: 1.5,
        chargeKwd: 27,
      }) as Response;
    }
    if (url.endsWith("/store/orders/STORE-123/status")) return response(orderStatus) as Response;
    return response({ ok: true }) as Response;
  });
}

describe.each([
  {
    lang: "en" as const,
    cartTitle: "My Cart",
    checkout: "Checkout",
    addressTitle: "Add new address",
    area: "Select area",
    fields: ["Block", "Street", "House / Apt", "Mobile"],
    location: "Use current delivery location",
    continueLabel: "Save & Continue",
    paymentTitle: "Delivery & Payment",
    payLabel: "Pay with UPayment",
    validationTitle: "Please complete your details",
    successTitle: "Payment successful",
    notConfirmedTitle: "Payment not confirmed",
    preservedMessage: "Your cart was preserved.",
  },
  {
    lang: "ar" as const,
    cartTitle: "سلتي",
    checkout: "متابعة الطلب",
    addressTitle: "إضافة عنوان جديد",
    area: "اختر المنطقة",
    fields: ["القطعة", "الشارع", "المنزل / الشقة", "رقم الهاتف المحمول"],
    location: "استخدم موقع التوصيل الحالي",
    continueLabel: "حفظ ومتابعة",
    paymentTitle: "التوصيل والدفع",
    payLabel: "الدفع عبر UPayment",
    validationTitle: "يرجى إكمال البيانات",
    successTitle: "تم الدفع بنجاح",
    notConfirmedTitle: "لم يتم تأكيد الدفع",
    preservedMessage: "بقيت المنتجات في سلتك.",
  },
])("CartScreen $lang checkout flow", ({
  lang, cartTitle, checkout, addressTitle, area, fields, location,
  continueLabel, paymentTitle, payLabel, validationTitle, successTitle,
  notConfirmedTitle, preservedMessage,
}) => {
  beforeEach(() => {
    jest.clearAllMocks();
    installFetchMock();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: "success",
      url: "dttours://store-payment-return?orderId=STORE-123&status=success",
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const preparePayment = async (screen: ReturnType<typeof render>) => {
    await waitFor(() => expect(screen.getByText(cartTitle)).toBeTruthy());
    fireEvent.press(screen.getByText("plus"));
    fireEvent.press(screen.getByText(checkout));
    fireEvent.press(screen.getByLabelText(area));
    fields.forEach((placeholder, index) => {
      fireEvent.changeText(screen.getByPlaceholderText(placeholder), index === 3 ? "99999999" : String(index + 1));
    });
    fireEvent.press(screen.getByLabelText(location));
    fireEvent.press(screen.getByText(continueLabel));
    await waitFor(() => expect(screen.getByText(paymentTitle)).toBeTruthy());
    fireEvent.press(screen.getByTestId("store-terms-accept"));
    fireEvent.press(screen.getByText(payLabel));
    await waitFor(() => expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled());
  };

  const expectCheckoutStatePreserved = (screen: ReturnType<typeof render>) => {
    expect(mockClearCart).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText(lang === "ar" ? "arrow-forward" : "arrow-back"));
    expect(screen.getByDisplayValue("1")).toBeTruthy();
    expect(screen.getByDisplayValue("2")).toBeTruthy();
    expect(screen.getByDisplayValue("3")).toBeTruthy();
    expect(screen.getByDisplayValue("99999999")).toBeTruthy();
    expect(screen.getByText("location-saved")).toBeTruthy();
    fireEvent.press(screen.getByText(lang === "ar" ? "arrow-forward" : "arrow-back"));
    expect(screen.getByText("2")).toBeTruthy();
  };

  it("validates, preserves state on back, and hands off to UPayment", async () => {
    const screen = render(<CartScreen lang={lang} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText(cartTitle)).toBeTruthy());
    fireEvent.press(screen.getByText("plus"));
    expect(screen.getByText("2")).toBeTruthy();
    fireEvent.press(screen.getByText(checkout));
    expect(screen.getByText(addressTitle)).toBeTruthy();

    fireEvent.press(screen.getByText(continueLabel));
    expect(Alert.alert).toHaveBeenCalledWith(validationTitle, expect.any(String));

    fireEvent.press(screen.getByLabelText(area));
    fields.forEach((placeholder, index) => {
      fireEvent.changeText(screen.getByPlaceholderText(placeholder), index === 3 ? "99999999" : String(index + 1));
    });
    fireEvent.press(screen.getByText(continueLabel));
    expect(Alert.alert).toHaveBeenLastCalledWith(validationTitle, expect.stringContaining(lang === "ar" ? "الخريطة" : "map"));

    fireEvent.press(screen.getByLabelText(location));
    fireEvent.press(screen.getByText(continueLabel));
    await waitFor(() => expect(screen.getByText(paymentTitle)).toBeTruthy());

    fireEvent.press(screen.getByText(lang === "ar" ? "arrow-forward" : "arrow-back"));
    expect(screen.getByDisplayValue("1")).toBeTruthy();
    expect(screen.getByDisplayValue("2")).toBeTruthy();
    expect(screen.getByDisplayValue("3")).toBeTruthy();
    expect(screen.getByDisplayValue("99999999")).toBeTruthy();
    expect(screen.getByText("location-saved")).toBeTruthy();

    fireEvent.press(screen.getByText(lang === "ar" ? "arrow-forward" : "arrow-back"));
    expect(screen.getByText("2")).toBeTruthy();
    fireEvent.press(screen.getByText(checkout));
    fireEvent.press(screen.getByText(continueLabel));
    await waitFor(() => expect(screen.getByText(paymentTitle)).toBeTruthy());

    fireEvent.press(screen.getByTestId("store-terms-accept"));
    await waitFor(() => expect(screen.getByText(payLabel)).toBeTruthy());
    fireEvent.press(screen.getByText(payLabel));

    await waitFor(() => expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      "https://pay.upayments.com/checkout/STORE-123",
      "dttours://store-payment-return",
    ));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(successTitle, expect.any(String)));
    expect(mockClearCart).toHaveBeenCalledTimes(1);
  });

  it("keeps cart quantities and delivery details when UPayment is canceled", async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: "cancel" });
    const screen = render(<CartScreen lang={lang} onClose={jest.fn()} />);

    await preparePayment(screen);

    expect(Alert.alert).not.toHaveBeenCalledWith(notConfirmedTitle, expect.any(String));
    expectCheckoutStatePreserved(screen);
  });

  it.each([
    ["malformed", "not-a-payment-return"],
    ["mismatched", "dttours://store-payment-return?orderId=STORE-999&status=success"],
  ])("keeps checkout state after a %s payment return", async (_caseName, url) => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: "success", url });
    const fetchSpy = global.fetch as jest.Mock;
    const screen = render(<CartScreen lang={lang} onClose={jest.fn()} />);

    await preparePayment(screen);

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(notConfirmedTitle, preservedMessage));
    expect(fetchSpy.mock.calls.some(([input]: [unknown]) => String(input).includes("/store/orders/"))).toBe(false);
    expectCheckoutStatePreserved(screen);
  });

  it("shows the localized not-confirmed message and keeps checkout state when the order is unpaid", async () => {
    jest.restoreAllMocks();
    installFetchMock({ paid: false, status: "pending" });
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: "success",
      url: "dttours://store-payment-return?orderId=STORE-123&status=success",
    });
    const screen = render(<CartScreen lang={lang} onClose={jest.fn()} />);

    await preparePayment(screen);

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(notConfirmedTitle, preservedMessage));
    expectCheckoutStatePreserved(screen);
  });
});
