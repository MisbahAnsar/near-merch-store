type ProductPriceLike = {
  price: number;
  variants?: Array<{
    id: string;
    price: number;
    availableForSale?: boolean;
  }>;
};

export function getLowestVariantPrice(product: ProductPriceLike): number {
  const variants = product.variants ?? [];
  if (variants.length === 0) {
    return product.price;
  }

  const availableVariants = variants.filter((variant) => variant.availableForSale !== false);
  const candidates = availableVariants.length > 0 ? availableVariants : variants;

  return candidates.reduce((lowest, variant) => Math.min(lowest, variant.price), candidates[0]!.price);
}

export function getProductVariantPrice(product: ProductPriceLike, variantId?: string): number {
  if (!variantId) {
    return product.price;
  }

  return product.variants?.find((variant) => variant.id === variantId)?.price ?? product.price;
}
