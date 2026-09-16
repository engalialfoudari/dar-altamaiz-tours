import {
  formatHotelSearchTiming,
  DEFAULT_HOTEL_DISPLAY_PREFERENCES,
  formatHotelDisplayPrice,
  HOTEL_PAYMENT_APP_RETURN_URL,
  hotelPortalHostsFor,
  hotelPortalUrlWithLanguage,
  isHotelPortalExternalAppUrl,
  isTrustedHotelPortalNavigation,
  isTrustedHotelPaymentHost,
  parseHotelPortalAccountAction,
  parseHotelPortalHistoryMessage,
  parseHotelPortalLanguageMessage,
  parseHotelPaymentHandoffMessage,
  parseHotelDisplayPreferences,
  parseHotelPaymentReturnUrl,
  shouldOpenHotelPaymentExternally,
  serializeHotelDisplayPreferencesMessage,
} from "@/lib/hotelPortal";
import fs from "node:fs";
import path from "node:path";

describe("hotel portal navigation hosts", () => {
  it("accepts only exact HTTPS portal/payment hosts", () => {
    const portal = "https://preview.example.replit.dev/hotels";
    expect(isTrustedHotelPortalNavigation("https://preview.example.replit.dev/hotels", portal)).toBe(true);
    expect(isTrustedHotelPortalNavigation("https://dt-tour.com/hotels", portal)).toBe(true);
    expect(isTrustedHotelPortalNavigation("https://pay.upayments.com/checkout", portal)).toBe(true);
    expect(isTrustedHotelPortalNavigation("https://dt-tour.com.attacker.example/", portal)).toBe(false);
    expect(isTrustedHotelPortalNavigation("javascript:alert(1)", portal)).toBe(false);
    expect(isTrustedHotelPortalNavigation("data:text/html,pwned", portal)).toBe(false);
    expect(isTrustedHotelPortalNavigation("https://attacker.example/", portal)).toBe(false);
  });

  it("allows the active preview host for the SSO redirect", () => {
    const hosts = hotelPortalHostsFor("https://preview.example.replit.dev/hotels");

    expect(hosts.has("preview.example.replit.dev")).toBe(true);
    expect(hosts.has("dt-tour.com")).toBe(true);
  });

  it("passes the app language to the portal while preserving an SSO ticket", () => {
    expect(
      hotelPortalUrlWithLanguage("https://dt-tour.com/hotels/sso?ticket=abc123", "en"),
    ).toBe("https://dt-tour.com/hotels/sso?ticket=abc123&lang=en");
    expect(hotelPortalUrlWithLanguage("https://dt-tour.com/hotels", "ar"))
      .toBe("https://dt-tour.com/hotels?lang=ar");
  });

  it("labels cold and warm mobile timings separately", () => {
    expect(formatHotelSearchTiming("cold", 12_999, "en")).toBe("Live search · 12s");
    expect(formatHotelSearchTiming("warm", 850, "en")).toBe("Cached result · 0s");
    expect(formatHotelSearchTiming("cold", 4_000, "ar")).toBe("بحث مباشر · 4 ث");
  });

  it("allows UPayment and direct KNET checkout hosts without allowing lookalike domains", () => {
    expect(isTrustedHotelPaymentHost("pay.upayments.com")).toBe(true);
    expect(isTrustedHotelPaymentHost("payment.upayment.com")).toBe(true);
    expect(isTrustedHotelPaymentHost("UPAYMENTS.COM")).toBe(true);
    expect(isTrustedHotelPaymentHost("www.kpay.com.kw")).toBe(true);
    expect(isTrustedHotelPaymentHost("kpaytest.com.kw")).toBe(true);
    expect(isTrustedHotelPaymentHost("evilupayments.com")).toBe(false);
    expect(isTrustedHotelPaymentHost("upayments.com.attacker.example")).toBe(false);
    expect(isTrustedHotelPaymentHost("evilkpay.com.kw")).toBe(false);
    expect(isTrustedHotelPaymentHost("kpay.com.kw.attacker.example")).toBe(false);
    expect(isTrustedHotelPaymentHost("example.com")).toBe(false);
  });

  it("accepts only trusted hotel payment handoffs from the web iframe", () => {
    expect(parseHotelPaymentHandoffMessage(JSON.stringify({
      type: "dt-open-hotel-payment",
      url: "https://pay.upayments.com/invoice/abc",
    }))).toBe("https://pay.upayments.com/invoice/abc");
    expect(parseHotelPaymentHandoffMessage(JSON.stringify({
      type: "dt-open-hotel-payment",
      url: "https://upayments.com.attacker.example/steal",
    }))).toBeNull();
    expect(parseHotelPaymentHandoffMessage(JSON.stringify({
      type: "other",
      url: "https://pay.upayments.com/invoice/abc",
    }))).toBeNull();
  });

  it("hands genuine WhatsApp links to the phone without allowing lookalike hosts", () => {
    expect(isHotelPortalExternalAppUrl("https://wa.me/96590087797?text=hello")).toBe(true);
    expect(isHotelPortalExternalAppUrl("https://api.whatsapp.com/send?phone=96590087797")).toBe(true);
    expect(isHotelPortalExternalAppUrl("https://wa.me.attacker.example/96590087797")).toBe(false);
    expect(isHotelPortalExternalAppUrl("https://attacker.example/?next=https://wa.me")).toBe(false);
  });

  it("keeps the hotel WebView compatible with payments, Clerk authorization, and native account routing", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/index.tsx"),
      "utf8",
    );

    const hotelPortalKey = source.indexOf('key={`hotel-portal-');
    const hotelWebViewStart = source.lastIndexOf("<WebView", hotelPortalKey);
    const hotelWebView = source.slice(
      hotelWebViewStart,
      source.indexOf("</WebView>", hotelPortalKey),
    );
    expect(hotelWebView).toContain("ref={hotelPortalRef}");
    expect(hotelWebView).toContain("userAgent={ANDROID_CHROME_USER_AGENT}");
    expect(hotelWebView).toContain("javaScriptCanOpenWindowsAutomatically");
    expect(hotelWebView).toContain("thirdPartyCookiesEnabled");
    expect(hotelWebView).toContain("onMessage=");
    expect(hotelWebView).toContain("onNavigationStateChange");
    expect(source).toContain("handleHotelPortalBack");
    expect(source).toContain("hotelPortalRef.current.goBack()");
    expect(source).toContain("dt-hotel-history");
    expect(source).toContain("hotelPortalInPageCanGoBack.current");
    expect(source).toContain('BackHandler.addEventListener("hardwareBackPress", onBackPress)');
    expect(source).toContain('hotelPortalVisible && tab.key === "profile"');
    expect(source).toContain('onCloseHotelPortal("profile")');
    expect(source).toContain('if (destination === "profile") return;');
    expect(source).toContain("function hotelPortalInjectedJavaScript(token: string | null)");
    expect(source).toContain("const hotelPortalSource = useMemo");
    expect(source).toContain("[hotelPortalInstance, localizedHotelPortalUrl]");
    expect(source).toContain("source={hotelPortalSource}");
    expect(source).not.toContain("headers: { Authorization: `Bearer ${hotelPortalToken}` }");
    expect(source).not.toContain("hotelPortalToken !== undefined && <WebView");
    expect(source).not.toContain("{hotelPortalVisible && <WebView");
    expect(source).toContain("? [StyleSheet.absoluteFillObject, styles.hotelPortalVisible]");
    expect(source).toContain("width: 1");
    expect(source).toContain("height: 1");
    expect(source).toContain("hotelPortalPrefillJavaScript(hotelPortalOverrideUrl)");
    expect(source).toContain("requiresHotelPortalNavigation(hotelPortalOverrideUrl)");
    expect(source).toContain("setHotelPortalUrl(hotelPortalOverrideUrl)");
    expect(source).not.toContain("hotelPortalOverrideUrl ?? hotelPortalUrl");
    expect(source).toContain("headers.set('Authorization', 'Bearer ' + window.__dtPortalToken)");
    expect(source).toContain("window.__dtPortalToken=${JSON.stringify(hotelPortalToken ?? \"\")}");
    expect(source).toContain("source:'dt-clerk-auth',token:${JSON.stringify(hotelPortalToken ?? \"\")}");
    expect(source).toContain("if (isSignedIn === false)");
    expect(source).toContain('token: hotelPortalToken ?? ""');
    expect(source).toContain('const { getToken, isSignedIn, sessionId } = useAuth();');
    expect(source).toContain('message?.type === "dt-open-native-account"');
    expect(source).toContain("isHotelPortalExternalAppUrl(rawUrl)");
    expect(source).toContain("parseHotelPaymentHandoffMessage(rawMessage)");
    expect(source).toContain("window.location.assign(paymentUrl)");
    expect(source).toContain(".bkd-wa-btn{background:#147A4B!important;color:#fff!important}");
    expect(source).not.toContain("resumeHotelPortalAfterGoogleSignIn");
    expect(source).toContain('postAuthDestination === "home" ? "shell" : "welcome"');
  });

  it("closes a hotel-portal-origin login onto native Home without reopening the portal", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/index.tsx"),
      "utf8",
    );
    const profileStart = source.indexOf("<ProfileScreen", source.indexOf("function WebShell"));
    const profileEnd = source.indexOf("onAuthenticated=", profileStart);
    const profileJourney = source.slice(profileStart, profileEnd);

    expect(profileJourney).toContain("setShowProfile(false)");
    expect(profileJourney).toContain('setActiveTab("home")');
    expect(profileJourney).toContain("setShowNativeHome(true)");
    expect(profileJourney).not.toContain("setShowHotelPortal(true)");
  });

  it("cannot reconstruct the login gateway after Clerk has authenticated the customer", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/index.tsx"),
      "utf8",
    );

    expect(source).toContain("const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();");
    expect(source).toContain('if (!isAuthLoaded || !isSignedIn || phase === "shell") return;');
    expect(source).toContain("welcomeOpacity.setValue(0)");
    expect(source).toContain('setPhase("shell")');

    const returnHomeStart = source.indexOf("const returnToMainHome =");
    const returnHomeEnd = source.indexOf("const handleNativeHomeTabPress", returnHomeStart);
    const returnHome = source.slice(returnHomeStart, returnHomeEnd);
    expect(returnHome).toContain('if (phase !== "shell")');
    expect(returnHome).toContain('setPhase("shell")');
    expect(returnHome).toContain("setShowHotelPortal(false)");
    expect(returnHome).toContain("setForceShowProfile(false)");
    expect(returnHome).toContain("setNativeScreen(null)");
  });

  it("keeps Account mounted so profile data preloads before the tab is tapped", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/index.tsx"),
      "utf8",
    );

    expect(source.match(/<ProfileScreen/g)).toHaveLength(2);
    expect(source.match(/display: showProfile \? "flex" : "none"/g)).toHaveLength(2);
    expect(source).not.toContain("{showProfile && (");
  });

  it("does not destroy an open hotel page during token refresh or language synchronization", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/index.tsx"),
      "utf8",
    );

    expect(source).not.toContain("setHotelPortalToken(undefined)");
    expect(source).toContain('key={`hotel-portal-${hotelPortalInstance}`}');
    expect(source).not.toContain('key={`hotel-portal-${hotelPortalInstance}-${activeLang ?? "en"}`}');
    expect(source).toContain("hotelPortalSourceLanguage.current = activeLang ?? \"en\"");
    expect(source).toContain("window.dispatchEvent(new MessageEvent('message',{data:{source:'dt-clerk-auth'");
  });

  it("matches the portal booking WhatsApp button to the native Account button colors", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../api-server/src/routes/hotel-test.ts"),
      "utf8",
    );
    expect(source).toContain(".bkd-wa-btn{display:block;text-align:center;padding:13px;background:#147A4B;color:#fff;");
  });

  it("accepts only explicit hotel same-page history messages", () => {
    expect(parseHotelPortalHistoryMessage(JSON.stringify({
      type: "dt-hotel-history",
      canGoBack: true,
    }))).toBe(true);
    expect(parseHotelPortalHistoryMessage(JSON.stringify({
      type: "dt-hotel-history",
      canGoBack: false,
    }))).toBe(false);
    expect(parseHotelPortalHistoryMessage(JSON.stringify({
      type: "other-message",
      canGoBack: true,
    }))).toBeNull();
    expect(parseHotelPortalHistoryMessage("not-json")).toBeNull();
  });

  it("accepts only explicit portal language and account actions", () => {
    expect(parseHotelPortalLanguageMessage(JSON.stringify({
      type: "dt-portal-language",
      language: "ar",
    }))).toBe("ar");
    expect(parseHotelPortalLanguageMessage(JSON.stringify({
      type: "dt-portal-language",
      language: "fr",
    }))).toBeNull();
    expect(parseHotelPortalAccountAction(JSON.stringify({
      type: "dt-portal-google-signin",
    }))).toBe("google-signin");
    expect(parseHotelPortalAccountAction(JSON.stringify({
      type: "dt-portal-signed-out",
    }))).toBe("signed-out");
    expect(parseHotelPortalAccountAction(JSON.stringify({
      type: "other-message",
    }))).toBeNull();
  });

  it("validates, serializes, and parses only hotel display preferences", () => {
    const preferences = { priceDisplay: "total-stay" as const, currency: "USD" as const };
    expect(DEFAULT_HOTEL_DISPLAY_PREFERENCES).toEqual({ priceDisplay: "per-night", currency: "KWD" });
    expect(parseHotelDisplayPreferences(preferences)).toEqual(preferences);
    expect(parseHotelDisplayPreferences({ priceDisplay: "weekly", currency: "USD" })).toBeNull();
    expect(parseHotelDisplayPreferences({ priceDisplay: "total-stay", currency: "EUR" })).toBeNull();
    expect(serializeHotelDisplayPreferencesMessage(preferences)).toBe(
      '{"type":"dt-hotel-display-preferences","preferences":{"priceDisplay":"total-stay","currency":"USD"}}',
    );
  });

  it("formats display-only KWD and fixed USD hotel prices", () => {
    expect(formatHotelDisplayPrice(10, { priceDisplay: "per-night", currency: "KWD" })).toBe("KWD 10.000");
    expect(formatHotelDisplayPrice(10, { priceDisplay: "total-stay", currency: "USD" })).toBe("USD 32.00");
  });

  it("opens Android top-frame payment redirects in the system browser", () => {
    expect(shouldOpenHotelPaymentExternally(
      { url: "https://www.kpay.com.kw/kpg/PaymentHTTP.htm", isTopFrame: true },
      "android",
    )).toBe(true);
    expect(shouldOpenHotelPaymentExternally(
      { url: "https://pay.upayments.com/checkout/abc", isTopFrame: true },
      "android",
    )).toBe(true);
    expect(shouldOpenHotelPaymentExternally(
      { url: "https://www.kpay.com.kw/frame", isTopFrame: false },
      "android",
    )).toBe(false);
    expect(shouldOpenHotelPaymentExternally(
      { url: "https://www.kpay.com.kw/kpg/PaymentHTTP.htm", isTopFrame: true },
      "ios",
    )).toBe(false);
    expect(shouldOpenHotelPaymentExternally(
      { url: "https://kpay.com.kw.attacker.example/checkout", isTopFrame: true },
      "android",
    )).toBe(false);
  });

  it("accepts only the DT Tours payment return deep link", () => {
    expect(HOTEL_PAYMENT_APP_RETURN_URL).toBe("dttours://hotel-payment-return");
    expect(parseHotelPaymentReturnUrl(
      "dttours://hotel-payment-return?orderId=HTL-123_ABC&status=success",
    )).toEqual({ orderId: "HTL-123_ABC", status: "success" });
    expect(parseHotelPaymentReturnUrl(
      "dttours://hotel-payment-return?orderId=HTL-456&status=failed",
    )).toEqual({ orderId: "HTL-456", status: "failed" });
    expect(parseHotelPaymentReturnUrl(
      "https://attacker.example/?orderId=HTL-123",
    )).toBeNull();
    expect(parseHotelPaymentReturnUrl(
      "dttours://lookalike?orderId=HTL-123",
    )).toBeNull();
  });
});