import { parseClerkRuntimeConfig } from "./clerkRuntimeConfig";

describe("parseClerkRuntimeConfig", () => {
  it("accepts a proxied Clerk configuration", () => {
    expect(
      parseClerkRuntimeConfig({
        publishableKey: "pk_live_example",
        proxyUrl: "https://dt-tour.com/api/__clerk",
      }),
    ).toEqual({
      publishableKey: "pk_live_example",
      proxyUrl: "https://dt-tour.com/api/__clerk",
    });
  });

  it.each([
    null,
    {},
    { publishableKey: "", proxyUrl: "https://dt-tour.com/api/__clerk" },
    { publishableKey: "pk_live_example", proxyUrl: "https://clerk.dt-tour.com" },
    { publishableKey: "pk_live_example", proxyUrl: "http://dt-tour.com/api/__clerk" },
  ])("rejects unsafe or incomplete configuration", (value) => {
    expect(() => parseClerkRuntimeConfig(value)).toThrow(
      "Invalid authentication configuration",
    );
  });
});