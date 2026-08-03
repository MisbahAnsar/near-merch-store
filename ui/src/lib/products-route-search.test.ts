import { describe, expect, it } from "vitest";
import {
  getProductsCategorySearch,
  getProductsFilterSearch,
  parseProductsRouteSearch,
} from "./products-route-search";

describe("getProductsCategorySearch", () => {
  it("writes the selected product type into the products category query param", () => {
    expect(getProductsCategorySearch("hats")).toEqual({
      category: "hats",
      categoryId: undefined,
      collection: undefined,
    });
  });
});

describe("products filter route search", () => {
  it("restores every supported filter from the URL", () => {
    expect(
      parseProductsRouteSearch({
        category: "t-shirts",
        collection: "near-essentials",
        q: "near",
        size: "M",
        color: "Black",
        brand: "NEAR",
        price: "50-100",
        discount: "on-sale",
        sort: "price-low-high",
      }),
    ).toEqual({
      category: "t-shirts",
      categoryId: undefined,
      collection: "near-essentials",
      q: "near",
      size: "M",
      color: "Black",
      brand: "NEAR",
      price: "50-100",
      discount: "on-sale",
      sort: "price-low-high",
    });
  });

  it("preserves active filters when one filter changes", () => {
    const current = parseProductsRouteSearch({
      category: "t-shirts",
      size: "M",
      color: "Black",
      sort: "price-high-low",
    });

    expect(getProductsFilterSearch(current, { brand: "NEAR" })).toEqual({
      category: "t-shirts",
      categoryId: undefined,
      collection: undefined,
      q: undefined,
      size: "M",
      color: "Black",
      brand: "NEAR",
      price: undefined,
      discount: undefined,
      sort: "price-high-low",
    });
  });

  it("omits default filter values from the URL", () => {
    const current = parseProductsRouteSearch({
      category: "hats",
      size: "M",
      sort: "price-low-high",
    });

    expect(
      getProductsFilterSearch(current, {
        size: "all",
        sort: "relevance",
      }),
    ).toEqual({
      category: "hats",
      categoryId: undefined,
      collection: undefined,
      q: undefined,
      size: undefined,
      color: undefined,
      brand: undefined,
      price: undefined,
      discount: undefined,
      sort: undefined,
    });
  });
});
