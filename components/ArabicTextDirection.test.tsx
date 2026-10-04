import React from "react";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Text, TextInput } from "@/localization/components";

let mockTranslate = (value: string) => value;
jest.mock("@/localization/provider", () => ({
  useAppLanguage: () => ({ locale: "en", version: 0 }),
}));
jest.mock("@/localization/engine", () => ({
  localizeUi: (value: string) => mockTranslate(value),
  lookupTurkish: () => undefined,
  getAppLocale: () => "en",
  translateUiImmediately: (value: string) => value,
}));

describe("app-wide Arabic text direction", () => {
  beforeEach(() => { mockTranslate = value => value; });

  it("right-aligns Arabic with Latin product names even when the surrounding locale is English", () => {
    const view = render(<Text testID="heading" style={{ textAlign: "left", fontSize: 17 }}>استعادة شريحة eSIM</Text>);
    expect(view.getByText("استعادة شريحة eSIM")).toBeTruthy();
    expect(StyleSheet.flatten(view.getByTestId("heading").props.style)).toMatchObject({
      direction: "rtl", writingDirection: "rtl", textAlign: "right", fontSize: 17,
    });
  });

  it("handles composed sentences without changing embedded email data", () => {
    const view = render(<Text testID="sentence">{"تواصل معنا: "}{ "\u2068support@example.com\u2069"}</Text>);
    expect(StyleSheet.flatten(view.getByTestId("sentence").props.style)).toMatchObject({
      writingDirection: "rtl", textAlign: "right",
    });
    expect(view.getByTestId("sentence").props.children).toEqual(["تواصل معنا: ", "\u2068support@example.com\u2069"]);
  });

  it("keeps centred button labels centred while reading RTL", () => {
    const view = render(<Text testID="button" style={{ textAlign: "center" }}>أرسل رمزاً إلى بريدي</Text>);
    expect(StyleSheet.flatten(view.getByTestId("button").props.style)).toMatchObject({
      writingDirection: "rtl", textAlign: "center",
    });
  });

  it("uses the translated display text, not the original Arabic, to choose direction", () => {
    mockTranslate = value => value === "بريد الشراء" ? "Satın alma e-postası" : value;
    const view = render(<Text testID="translated" style={{ textAlign: "left" }}>بريد الشراء</Text>);
    expect(view.getByText("Satın alma e-postası")).toBeTruthy();
    expect(StyleSheet.flatten(view.getByTestId("translated").props.style)).toEqual({ textAlign: "left" });
  });

  it("keeps email, phone, password and centred verification inputs LTR without rewriting values", () => {
    const view = render(<>
      <TextInput testID="email" keyboardType="email-address" value="guest@example.com" placeholder="بريد الشراء" style={{ textAlign: "right" }} />
      <TextInput testID="phone" keyboardType="phone-pad" value="+965 12345678" />
      <TextInput testID="code" keyboardType="number-pad" value="123456" style={{ textAlign: "center" }} />
      <TextInput testID="password" secureTextEntry value="كلمة سر" />
    </>);
    for (const id of ["email", "phone", "code", "password"]) {
      expect(StyleSheet.flatten(view.getByTestId(id).props.style).writingDirection).toBe("ltr");
    }
    expect(view.getByTestId("email").props.value).toBe("guest@example.com");
    expect(view.getByTestId("phone").props.value).toBe("+965 12345678");
    expect(view.getByTestId("password").props.value).toBe("كلمة سر");
    expect(StyleSheet.flatten(view.getByTestId("code").props.style).textAlign).toBe("center");
  });

  it("right-aligns Arabic editable names and empty Arabic placeholder fields", () => {
    const view = render(<>
      <TextInput testID="name" value="اسم العميل" style={{ textAlign: "left" }} />
      <TextInput testID="search" value="" placeholder="ابحث عن وجهة" />
    </>);
    for (const id of ["name", "search"]) {
      expect(StyleSheet.flatten(view.getByTestId(id).props.style)).toMatchObject({ writingDirection: "rtl", textAlign: "right" });
    }
    expect(view.getByTestId("name").props.value).toBe("اسم العميل");
  });

  it("keeps readonly private contact data LTR without changing its column alignment", () => {
    const view = render(<Text testID="contact" dtDisplayData style={{ textAlign: "right", writingDirection: "rtl" }}>+965 12345678</Text>);
    expect(StyleSheet.flatten(view.getByTestId("contact").props.style)).toMatchObject({ writingDirection: "ltr", textAlign: "right" });
    expect(view.getByText("+965 12345678")).toBeTruthy();
  });

  it("isolates contacts inside Arabic sentences without adding another layer to existing isolates", () => {
    const view = render(<Text testID="mixed">{"راسل support@example.com أو اتصل +965 12345678"}</Text>);
    expect(view.getByTestId("mixed").props.children).toBe("راسل \u2066support@example.com\u2069 أو اتصل \u2066+965 12345678\u2069");
  });

  it("reads an empty email field's Arabic placeholder RTL, then switches typed email data to LTR", () => {
    const view = render(<TextInput testID="placeholder" keyboardType="email-address" value="" placeholder="البريد الإلكتروني" />);
    expect(StyleSheet.flatten(view.getByTestId("placeholder").props.style).writingDirection).toBe("rtl");
    view.rerender(<TextInput testID="placeholder" keyboardType="email-address" value="guest@example.com" placeholder="البريد الإلكتروني" />);
    expect(StyleSheet.flatten(view.getByTestId("placeholder").props.style).writingDirection).toBe("ltr");
    expect(view.getByTestId("placeholder").props.value).toBe("guest@example.com");
  });

  it("right-aligns a sentence whose Arabic copy is inside nested text", () => {
    const view = render(<Text testID="nested"><Text>أدخل بريد الشراء</Text></Text>);
    expect(StyleSheet.flatten(view.getByTestId("nested").props.style)).toMatchObject({ writingDirection: "rtl", textAlign: "right" });
  });
});