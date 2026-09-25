import { getAdminTokenExpiry, isAdminSessionExpiredMessage } from "./adminSession";

describe("admin session expiry detection", () => {
  it("detects the exact Arabic response returned for a stale /push session", () => {
    expect(
      isAdminSessionExpiredMessage(
        "❌ انتهت جلسة الأدمن. اضغط خروج ثم سجل دخول الأدمن مرة أخرى.",
      ),
    ).toBe(true);
  });

  it("does not treat a successful Arabic push response as expired", () => {
    expect(
      isAdminSessionExpiredMessage(
        "✅ تم إرسال الإشعار بنجاح: سجل دخول للحين واكتشف أكواد الخصم الخاصة بالأعضاء في قسم العروض",
      ),
    ).toBe(false);
  });

  it("reads the server expiry from a signed admin token payload", () => {
    const expiry = 1_789_735_200_000;
    const payload = Buffer.from(JSON.stringify({ exp: expiry })).toString("base64url");

    expect(getAdminTokenExpiry(`${payload}.signature`)).toBe(expiry);
  });

  it("returns null for an invalid admin token", () => {
    expect(getAdminTokenExpiry("not-a-token")).toBeNull();
  });
});