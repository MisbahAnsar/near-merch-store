import { describe, expect, it } from "vitest";
import {
  getOrderedProductCategories,
  getProductsCategorySearch,
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

describe("getOrderedProductCategories", () => {
  it("orders product type filters to match the storefront category order", () => {
    const productTypes = [
      { slug: "sweatshirts", label: "Sweatshirts" },
      { slug: "books", label: "Books" },
      { slug: "apparel", label: "Apparel" },
      { slug: "tshirt", label: "T-Shirts" },
      { slug: "totebag", label: "Totebag" },
      { slug: "hoodies", label: "Hoodies" },
      { slug: "long-sleeved-shirts", label: "Long Sleeved Shirts" },
      { slug: "hats", label: "Hats" },
    ];

    expect(getOrderedProductCategories(productTypes).map((category) => category.label)).toEqual([
      "All",
      "T-Shirts",
      "Hats",
      "Hoodies",
      "Long Sleeved Shirts",
      "Sweatshirts",
      "Books",
      "Totebag",
    ]);
  });
});
