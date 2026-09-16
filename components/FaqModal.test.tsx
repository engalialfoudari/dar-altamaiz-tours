import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import fs from "node:fs";
import path from "node:path";

import { FAQS, FaqModal, type Language } from "./FaqModal";
import {
  BOOKING_RULES,
  CUSTOMER_BOOKING_GUIDANCE,
  calculatePackageBalance,
  calculatePackageDeposit,
} from "@/lib/bookingRules";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const source = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

const priceLockSource = source("../../api-server/src/routes/price-lock.ts");
const privacySource = source("../../api-server/src/routes/privacy.ts");
const authSource = source("../../api-server/src/routes/auth.ts");
const hotelPortalSource = source("../../api-server/src/routes/hotel-test.ts");
const paymentSource = source("../../api-server/src/routes/upayment.ts");
const webChatSource = source("../../api-server/src/routes/chat-page.ts");
const chatbotSource = source("./ChatbotScreen.tsx");

const faqAnswer = (lang: Language, question: string): string => {
  const item = FAQS[lang].find((candidate) => candidate.question === question);
  if (!item) throw new Error(`Missing ${lang} FAQ rule: ${question}`);
  return item.answer;
};

const pairedRuleQuestions = [
  ["How do hotel price holds work?", "كيف يعمل تثبيت سعر الفندق؟"],
  ["Does a hotel price hold guarantee every room detail?", "هل يضمن تثبيت السعر جميع تفاصيل الغرفة؟"],
  ["Who confirms and supplies the hotel room?", "من يؤكد ويوفر غرفة الفندق؟"],
  ["Are package deposits refundable?", "هل عربون الباقة قابل للاسترداد؟"],
  ["Is it safe to share my card details with support?", "هل من الآمن مشاركة بيانات البطاقة مع الدعم؟"],
  ["How can I sign in to My Account?", "كيف أسجل الدخول إلى حسابي؟"],
  ["What if my Google email is already linked to another account?", "ماذا لو كان بريد Google مرتبطاً بحساب آخر؟"],
  ["Can I access, correct, or delete my personal data?", "هل يمكنني الوصول إلى بياناتي الشخصية أو تصحيحها أو حذفها؟"],
  ["What happens when I request account deletion?", "ماذا يحدث عند طلب حذف الحساب؟"],
] as const;

describe("FaqModal", () => {
  it("filters verified guidance by service and expands answers", () => {
    const onClose = jest.fn();
    const view = render(<FaqModal visible lang="en" onClose={onClose} />);

    expect(view.getByText("Frequently asked questions")).toBeTruthy();
    expect(view.queryByText("Activities")).toBeNull();
    expect(view.getByText("How do I book a flight?")).toBeTruthy();
    expect(view.queryByText("How do I book a hotel?")).toBeNull();

    fireEvent.press(view.getAllByTestId("faq-question-flights")[0]);
    expect(view.getByText(/DGCA License No\. 2021\/20304/)).toBeTruthy();
    expect(view.getByText(/IATA Code 42228745/)).toBeTruthy();

    fireEvent.press(view.getByTestId("faq-tab-packages"));
    fireEvent.press(view.getAllByTestId("faq-question-packages")[1]);
    expect(view.getByText(/Commercial License No\. 7517\/2024/)).toBeTruthy();

    fireEvent.press(view.getByTestId("faq-tab-support"));
    fireEvent.press(view.getByText("What laws are relevant to online bookings in Kuwait?"));
    expect(view.getByText(/Electronic Transactions Law No\. 20\/2014/)).toBeTruthy();
    expect(view.getByText(/Consumer Protection Law No\. 39\/2014/)).toBeTruthy();

    fireEvent.press(view.getByTestId("faq-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("searches all verified categories and provides Arabic guidance", () => {
    const view = render(<FaqModal visible lang="ar" onClose={jest.fn()} />);

    expect(view.getByText("الأسئلة الشائعة")).toBeTruthy();
    fireEvent.changeText(view.getByTestId("faq-search"), "الدولار");
    expect(view.getByText("كيف تعمل إعدادات عرض أسعار الفنادق؟")).toBeTruthy();
    fireEvent.press(view.getByTestId("faq-question-account"));
    expect(view.getByText(/1 د\.ك = 3\.2 دولار/)).toBeTruthy();
    fireEvent.press(view.getByTestId("faq-search-clear"));
    expect(view.getByText("كيف أحجز رحلة طيران؟")).toBeTruthy();
  });

  it("provides a substantial professional FAQ in every service category", () => {
    const view = render(<FaqModal visible lang="en" onClose={jest.fn()} />);
    const categories = ["flights", "hotels", "packages", "payments", "account", "support"];

    categories.forEach((category) => {
      fireEvent.press(view.getByTestId(`faq-tab-${category}`));
      expect(view.getAllByTestId(`faq-question-${category}`).length).toBeGreaterThanOrEqual(9);
    });

    fireEvent.changeText(view.getByTestId("faq-search"), "AI trip builder");
    expect(view.getByText("Does the AI trip builder make a confirmed booking?")).toBeTruthy();

    fireEvent.changeText(view.getByTestId("faq-search"), "one-time password");
    expect(view.getByText("Is it safe to share my card details with support?")).toBeTruthy();

    fireEvent.changeText(view.getByTestId("faq-search"), "Consumer Protection Law");
    expect(view.getByText("What laws are relevant to online bookings in Kuwait?")).toBeTruthy();
  });

  it("keeps important Kuwait, privacy, and price-hold guidance available in Arabic", () => {
    const view = render(<FaqModal visible lang="ar" onClose={jest.fn()} />);

    fireEvent.changeText(view.getByTestId("faq-search"), "حماية المستهلك");
    expect(view.getByText("ما القوانين ذات الصلة بالحجوزات الإلكترونية في الكويت؟")).toBeTruthy();

    fireEvent.changeText(view.getByTestId("faq-search"), "حذف الحساب");
    expect(view.getByText("ماذا يحدث عند طلب حذف الحساب؟")).toBeTruthy();

    fireEvent.changeText(view.getByTestId("faq-search"), "350 نقطة");
    expect(view.getByText("كيف يعمل تثبيت سعر الفندق؟")).toBeTruthy();
  });

  it("keeps every rule-sensitive English FAQ paired with its Arabic entry", () => {
    pairedRuleQuestions.forEach(([englishQuestion, arabicQuestion]) => {
      expect(faqAnswer("en", englishQuestion)).not.toHaveLength(0);
      expect(faqAnswer("ar", arabicQuestion)).not.toHaveLength(0);
      expect(
        FAQS.en.find((item) => item.question === englishQuestion)?.category,
      ).toBe(FAQS.ar.find((item) => item.question === arabicQuestion)?.category);
    });
  });

  it("matches both price-hold FAQs to the live fee, points, eligibility, and confirmation rules", () => {
    expect(priceLockSource).toContain("BOOKING_RULES.hotelPriceHold.feeKwdByHours");
    expect(priceLockSource).toContain("BOOKING_RULES.hotelPriceHold.pointsByHours");
    expect(hotelPortalSource).toContain("BOOKING_RULES.hotelPriceHold.feeKwdByHours");
    expect(hotelPortalSource).toContain("BOOKING_RULES.hotelPriceHold.pointsByHours");
    expect(priceLockSource).toContain("verifyPriceQuote(String(priceQuoteToken))");
    expect(priceLockSource).toContain("free cancellation does not cover the full lock period");
    expect(priceLockSource).toContain('reservation.state === "confirmed"');

    const english = faqAnswer("en", "How do hotel price holds work?");
    const arabic = faqAnswer("ar", "كيف يعمل تثبيت سعر الفندق؟");
    expect(english).toBe(CUSTOMER_BOOKING_GUIDANCE.hotelPriceHoldFaq.en);
    expect(arabic).toBe(CUSTOMER_BOOKING_GUIDANCE.hotelPriceHoldFaq.ar);
    [english, arabic].forEach((answer) => {
      expect(answer).toMatch(/24/);
      expect(answer).toMatch(/48/);
      expect(answer).toMatch(/200/);
      expect(answer).toMatch(/350/);
    });
    expect(english).toMatch(/eligible signed hotel quote/i);
    expect(english).toMatch(/non-refundable/i);
    expect(english).toMatch(/supplier confirmation/i);
    expect(arabic).toMatch(/مؤهل وموقّع/);
    expect(arabic).toMatch(/غير قابلة للاسترداد/);
    expect(arabic).toMatch(/تأكيد المورد/);
  });

  it("matches privacy and account FAQs to authenticated, verified account behavior", () => {
    expect(privacySource).toContain('const TYPES = new Set(["access", "correction", "deletion"])');
    expect(privacySource).toContain('router.post("/privacy/requests", requireAuth');
    expect(privacySource).toContain('type === "deletion" ? "pending_verification" : "received"');
    expect(privacySource).toContain("60 * 60 * 1000");
    expect(authSource).toContain("getAuth(req)?.userId");
    expect(authSource).toContain("already linked to another sign-in");

    expect(faqAnswer("en", "Can I access, correct, or delete my personal data?")).toMatch(
      /Authenticated customers.*access, correction, or deletion/i,
    );
    expect(faqAnswer("ar", "هل يمكنني الوصول إلى بياناتي الشخصية أو تصحيحها أو حذفها؟")).toMatch(
      /للعملاء المسجلين.*للوصول أو التصحيح أو الحذف/,
    );
    expect(faqAnswer("en", "What happens when I request account deletion?")).toMatch(
      /one-time email verification.*not immediate or automatic/i,
    );
    expect(faqAnswer("ar", "ماذا يحدث عند طلب حذف الحساب؟")).toMatch(
      /رمز تحقق لمرة واحدة عبر البريد.*لا يتم فوراً أو تلقائياً/,
    );
    expect(faqAnswer("en", "How can I sign in to My Account?")).toMatch(/email\/password or Google/i);
    expect(faqAnswer("ar", "كيف أسجل الدخول إلى حسابي؟")).toMatch(/البريد الإلكتروني وكلمة المرور.*Google/);
  });

  it("matches package-deposit FAQs to the live percentage, refund deadline, and confirmation prerequisite", () => {
    expect(chatbotSource).toContain("grandTotal * BOOKING_RULES.packageDeposit.rate");
    expect(BOOKING_RULES.packageDeposit).toEqual({
      rate: 0.25,
      percent: 25,
      remainingRate: 0.75,
      remainingPercent: 75,
      refundableBeforeDepartureHours: 72,
      refundableBeforeDepartureDays: 3,
    });
    expect(calculatePackageDeposit(10)).toBe(2.5);
    expect(calculatePackageBalance(10)).toBe(7.5);
    expect(paymentSource).toContain("calculatePackageDeposit(total)");
    expect(hotelPortalSource).toContain("calculatePackageDeposit(totalKWD)");
    expect(webChatSource).toContain("BOOKING_RULES.packageDeposit.rate");

    const english = faqAnswer("en", "Are package deposits refundable?");
    const arabic = faqAnswer("ar", "هل عربون الباقة قابل للاسترداد؟");
    expect(english).toBe(CUSTOMER_BOOKING_GUIDANCE.packageDepositFaq.en);
    expect(arabic).toBe(CUSTOMER_BOOKING_GUIDANCE.packageDepositFaq.ar);
    expect(english).toMatch(/25%.*72 hours \(3 days\).*non-refundable.*official confirmation document/i);
    expect(arabic).toMatch(/25%.*72 ساعة \(3 أيام\).*لا يُسترد.*وثيقة تأكيد رسمية/);
  });

  it("keeps payment-safety instructions explicit in both languages", () => {
    expect(faqAnswer("en", "Is it safe to share my card details with support?")).toMatch(
      /Never send a full card number, PIN, CVV, one-time password.*authorized checkout page/i,
    );
    expect(faqAnswer("ar", "هل من الآمن مشاركة بيانات البطاقة مع الدعم؟")).toMatch(
      /لا ترسل أبداً رقم البطاقة كاملاً.*CVV.*رمز التحقق لمرة واحدة.*صفحة الدفع المعتمدة/,
    );
  });
});
