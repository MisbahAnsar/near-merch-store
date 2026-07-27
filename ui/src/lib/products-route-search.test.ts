import { describe, expect, it } from "vitest";
import { getProductsCategorySearch } from "./products-route-search";

describe("getProductsCategorySearch", () => {
  it("writes the selected product type into the products category query param", () => {
    expect(getProductsCategorySearch("hats")).toEqual({
      category: "hats",
      categoryId: undefined,
      collection: undefined,
    });
  });
});
