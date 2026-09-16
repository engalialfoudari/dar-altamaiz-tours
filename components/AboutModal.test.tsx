import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { AboutModal } from "./AboutModal";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.1" } },
}));

describe("AboutModal", () => {
  it("shows verified company information and licensing in English", () => {
    const onClose = jest.fn();
    const view = render(<AboutModal visible lang="en" onClose={onClose} />);

    expect(view.getByText("About DT Tours")).toBeTruthy();
    expect(view.getByText("Version 1.0.1")).toBeTruthy();
    expect(view.getByText(/established in 2008/)).toBeTruthy();

    fireEvent.press(view.getByText("Licensing and accredited operators"));
    expect(view.getByText(/DGCA License No\. 2021\/20304/)).toBeTruthy();
    expect(view.getByText(/IATA Code 42228745/)).toBeTruthy();
    expect(view.getByText(/Commercial License No\. 7517\/2024/)).toBeTruthy();
    expect(view.getByText("42228745")).toBeTruthy();
    expect(view.getByLabelText("IATA logo")).toBeTruthy();
    expect(view.getByText(/All rights reserved/)).toBeTruthy();

    fireEvent.press(view.getByTestId("about-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("includes Arabic legal and privacy disclosures", () => {
    const view = render(<AboutModal visible lang="ar" onClose={jest.fn()} />);

    fireEvent.press(view.getByText("الإطار القانوني في دولة الكويت"));
    expect(view.getByText(/القانون رقم 20 لسنة 2014/)).toBeTruthy();
    expect(view.getByText(/القانون رقم 39 لسنة 2014/)).toBeTruthy();
    expect(view.getByText(/رقم 42 لسنة 2021/)).toBeTruthy();
    expect(view.getByText(/رقم 10 لسنة 2026/)).toBeTruthy();
    expect(view.getByText(/جميع الحقوق محفوظة/)).toBeTruthy();
  });
});