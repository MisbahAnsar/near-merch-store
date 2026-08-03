export type PriceRange =
  | "all"
  | "under-50"
  | "50-100"
  | "100-200"
  | "over-200";
export type DiscountFilter = "all" | "on-sale" | "no-discount";
export type SortOption =
  | "relevance"
  | "price-low-high"
  | "price-high-low";

export type ProductsRouteSearch = {
  category: string;
  categoryId?: string;
  collection?: string;
  q?: string;
  size?: string;
  color?: string;
  brand?: string;
  price?: PriceRange;
  discount?: DiscountFilter;
  sort?: SortOption;
};

const priceRanges: PriceRange[] = [
  "all",
  "under-50",
  "50-100",
  "100-200",
  "over-200",
];
const discountFilters: DiscountFilter[] = [
  "all",
  "on-sale",
  "no-discount",
];
const sortOptions: SortOption[] = [
  "relevance",
  "price-low-high",
  "price-high-low",
];

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isOneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return typeof value === "string" && options.includes(value as T);
}

export function parseProductsRouteSearch(
  search: Record<string, unknown>,
): ProductsRouteSearch {
  return {
    category: optionalString(search.category) ?? "all",
    categoryId: optionalString(search.categoryId),
    collection: optionalString(search.collection),
    q: optionalString(search.q),
    size: optionalString(search.size),
    color: optionalString(search.color),
    brand: optionalString(search.brand),
    price: isOneOf(search.price, priceRanges) ? search.price : undefined,
    discount: isOneOf(search.discount, discountFilters)
      ? search.discount
      : undefined,
    sort: isOneOf(search.sort, sortOptions) ? search.sort : undefined,
  };
}

export function getProductsFilterSearch(
  current: ProductsRouteSearch,
  updates: Partial<ProductsRouteSearch>,
): ProductsRouteSearch {
  const next = { ...current, ...updates };

  return {
    category: next.category || "all",
    categoryId: next.categoryId || undefined,
    collection: next.collection || undefined,
    q: next.q || undefined,
    size: next.size && next.size !== "all" ? next.size : undefined,
    color: next.color && next.color !== "all" ? next.color : undefined,
    brand: next.brand && next.brand !== "all" ? next.brand : undefined,
    price:
      next.price && next.price !== "all" ? next.price : undefined,
    discount:
      next.discount && next.discount !== "all"
        ? next.discount
        : undefined,
    sort:
      next.sort && next.sort !== "relevance" ? next.sort : undefined,
  };
}

export function getProductsCategorySearch(category: string) {
  return {
    category,
    categoryId: undefined,
    collection: undefined,
  };
}
