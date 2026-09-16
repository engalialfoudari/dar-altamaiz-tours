import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { LegalDocumentModal } from "./LegalDocumentModal";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("LegalDocumentModal", () => {
  it("shows the English privacy policy and closes", () => {
    const onClose = jest.fn();
    const screen = render(
      <LegalDocumentModal document="privacy" lang="en" onClose={onClose} />,
    );

    expect(screen.getByText("Privacy Policy")).toBeTruthy();
    expect(screen.getByText("Last updated: 4 September 2026")).toBeTruthy();
    expect(screen.getByText("5. Retention")).toBeTruthy();
    expect(screen.getByText("6. Your choices and requests")).toBeTruthy();
    expect(screen.getByText(/Special-request passport and traveler details are retained for 90 days after closure/)).toBeTruthy();
    expect(screen.getByText(/Legally required booking, payment, refund, supplier, accounting, fraud, and loyalty records are retained for 10 years/)).toBeTruthy();
    expect(screen.getByText(/Submit requests through your signed-in Account or email info@dt-tour.com/)).toBeTruthy();

    fireEvent.press(screen.getByTestId("legal-document-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the Arabic booking conditions", () => {
    const screen = render(
      <LegalDocumentModal document="terms" lang="ar" onClose={jest.fn()} />,
    );

    expect(screen.getByText("الشروط وأحكام الحجز")).toBeTruthy();
    expect(screen.getByText("آخر تحديث: 4 سبتمبر 2026")).toBeTruthy();
    expect(screen.getByText("5. التعديلات والإلغاءات والاسترداد")).toBeTruthy();
    expect(screen.getByText("6. بيانات المسافر ووثائقه")).toBeTruthy();
    const contact = screen.getByTestId("legal-document-contact").props.children;
    expect(contact).toBe("\u2066info@dt-tour.com\u2069");
  });

  it("shows the Arabic privacy retention schedule", () => {
    const screen = render(
      <LegalDocumentModal document="privacy" lang="ar" onClose={jest.fn()} />,
    );

    expect(screen.getByText("5. مدة الاحتفاظ")).toBeTruthy();
    expect(screen.getByText(/تفاصيل جواز السفر والمسافر الخاصة بالطلبات الخاصة لمدة 90 يوماً بعد إغلاق الطلب/)).toBeTruthy();
    expect(screen.getByText(/سجل تدقيق غير معرّف للطلبات لمدة 6 سنوات/)).toBeTruthy();
    expect(screen.getByTestId("legal-document-contact").props.children)
      .toBe("\u2066info@dt-tour.com\u2069");
  });
});