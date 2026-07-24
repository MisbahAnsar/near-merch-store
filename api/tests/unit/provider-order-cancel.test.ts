import { describe, expect, it } from "vitest";
import { isProviderOrderAlreadyGone } from "@/utils/provider-order-cancel";

describe("isProviderOrderAlreadyGone", () => {
  it("treats missing provider orders as already cleaned up", () => {
    expect(
      isProviderOrderAlreadyGone(
        "Failed to cancel Printful order: Not found",
      ),
    ).toBe(true);
    expect(isProviderOrderAlreadyGone("404 Order does not exist")).toBe(true);
    expect(isProviderOrderAlreadyGone("Order already cancelled")).toBe(true);
    expect(isProviderOrderAlreadyGone("already deleted")).toBe(true);
  });

  it("does not treat real cancel failures as already gone", () => {
    expect(isProviderOrderAlreadyGone("Unauthorized")).toBe(false);
    expect(isProviderOrderAlreadyGone("Rate limit exceeded")).toBe(false);
    expect(
      isProviderOrderAlreadyGone("Failed to cancel Printful order: timeout"),
    ).toBe(false);
  });
});
