import { describe, expect, it } from "vitest";
import { usesNativeDashboard } from "./home-navigation";

describe("mobile Home navigation", () => {
  it("keeps Home on the native travel dashboard", () => {
    expect(usesNativeDashboard("home")).toBe(true);
  });

  it("keeps booking destinations in their existing surfaces", () => {
    for (const destination of ["flights", "hotels", "packages", "bookings", "contact"]) {
      expect(usesNativeDashboard(destination)).toBe(false);
    }
  });
});