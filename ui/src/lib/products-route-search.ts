type ProductType = {
  slug: string;
  label: string;
};

const PRODUCT_CATEGORIES = [
  { key: "all", label: "All" },
  { key: "tshirt", label: "T-Shirts" },
  { key: "hats", label: "Hats" },
  { key: "hoodies", label: "Hoodies" },
  { key: "long-sleeved-shirts", label: "Long Sleeved Shirts" },
  { key: "sweatshirts", label: "Sweatshirts" },
  { key: "books", label: "Books" },
  { key: "totebag", label: "Totebag" },
];

export function getProductsCategorySearch(category: string) {
  return {
    category,
    categoryId: undefined,
    collection: undefined,
  };
}

export function getOrderedProductCategories(_productTypes: ProductType[]) {
  return PRODUCT_CATEGORIES;
}
