export const COLOR_MAP: Record<string, string> = {
  Black: "#000000",
  White: "#FFFFFF",
  Navy: "#1B3B6F",
  "Dark Grey Heather": "#333333",
  "Sport Grey": "#808080",
  Blue: "#0000FF",
  Red: "#FF0000",
  Green: "#008000",
  Light: "#F0F0F0",
  Dark: "#1A1A1A",
  Heather: "#999999",
  Royal: "#4169E1",
  Orange: "#FFA500",
  Purple: "#800080",
  Pink: "#FFC0CB",
  "Soft Pink": "#FFB6C1",
  Yellow: "#FFFF00",
  Gold: "#FFD700",
  Charcoal: "#36454F",
  Grey: "#808080",
  Gray: "#808080",
  "Athletic Heather": "#B0B0B0",
  "Black Heather": "#2B2B2B",
  "Heather Emerald": "#00A86B",
  "Heather Navy": "#1B2E4A",
  "Military Green": "#4B5320",
  "Heather Slate": "#708090",
  Cranberry: "#9B1B30",
  "Green Camo": "#4B6F44",
  // Additional apparel/merchandise colors
  Asphalt: "#3D3D3D",
  "Blue Jean": "#5B7C99",
  Brown: "#5C4033",
  Espresso: "#3C2415",
  Forest: "#228B22",
  "Heather Brown": "#8B7355",
  "Heather Forest": "#4A5D4A",
  Sage: "#9CAF88",
  // New colors from database
  "Baby Blue": "#89CFF0",
  "Carbon Grey": "#767873",
  "Heather True Royal": "#24509A",
  "Hemp": "#987D73",
  "Navy Blazer": "#282D3C",
  "Pepper": "#5D5951",
  "True Navy": "#3F5277",
};

export function getOptionValue(
  attributes: Array<{ name: string; value: string }> | undefined | null,
  optionName: string
): string | undefined {
  return attributes?.find(
    (opt) => opt.name.toLowerCase() === optionName.toLowerCase()
  )?.value;
}

export function getAttributeHex(
  attributes: Array<{ name: string; value: string }> | undefined,
  optionName: string
): string | undefined {
  if (!attributes) return undefined;
  const attr = attributes.find(
    (opt) => opt.name.toLowerCase() === optionName.toLowerCase()
  );
  return (attr as unknown as { hex?: string })?.hex;
}

interface VariantWithOptions {
  id?: string;
  attributes?: Array<{ name: string; value: string }> | null;
  availableForSale?: boolean;
  fulfillmentConfig?: { files?: Array<{ url: string }> };
}

interface ProductImageWithVariants {
  id?: string;
  url: string;
  type?: string;
  variantIds?: string[];
}

export function getAvailableSizesForColor({
  sizes,
  variants,
  selectedColor,
  hasColorOptions,
}: {
  sizes: string[];
  variants: VariantWithOptions[];
  selectedColor: string;
  hasColorOptions: boolean;
}): string[] {
  return sizes.filter((size) => {
    if (size === "N/A") return true;

    return variants.some((variant) => {
      const variantSize = getOptionValue(variant.attributes, "Size");
      const variantColor = getOptionValue(variant.attributes, "Color");
      const colorMatches = !hasColorOptions || variantColor === selectedColor;

      return variantSize === size && colorMatches && variant.availableForSale;
    });
  });
}

export function resolveSelectedSizeForColor(
  selectedSize: string,
  availableSizesForColor: string[]
): string {
  if (availableSizesForColor.includes(selectedSize)) {
    return selectedSize;
  }

  return availableSizesForColor[0] || "";
}

function isProductDisplayImage(image: ProductImageWithVariants): boolean {
  return image.type !== "mockup" && image.type !== "detail";
}

function getEmbeddedPrintfulVariantId(value: string | undefined): string | undefined {
  return value?.match(/(?:printful-variant-|file-.+-)(\d+)$/)?.[1];
}

function imageMatchesVariant(
  image: ProductImageWithVariants,
  variantId: string
): boolean {
  if (image.variantIds?.includes(variantId)) {
    return true;
  }

  const imageVariantId = getEmbeddedPrintfulVariantId(image.id);
  const selectedVariantId = getEmbeddedPrintfulVariantId(variantId);

  return Boolean(
    imageVariantId &&
      selectedVariantId &&
      imageVariantId === selectedVariantId
  );
}

export function getVariantImage(
  product: {
    images?: ProductImageWithVariants[];
    variants?: VariantWithOptions[];
  },
  variantId: string
): ProductImageWithVariants | undefined {
  const displayImages = product.images?.filter(isProductDisplayImage) || [];
  const exactImage = displayImages.find((image) =>
    imageMatchesVariant(image, variantId)
  );

  if (exactImage) {
    return exactImage;
  }

  const selectedVariant = product.variants?.find((variant) => variant.id === variantId);
  const selectedColor = getOptionValue(selectedVariant?.attributes, "Color");

  if (selectedColor) {
    const sameColorVariantIds =
      product.variants
        ?.filter(
          (variant) =>
            variant.id &&
            getOptionValue(variant.attributes, "Color") === selectedColor
        )
        .map((variant) => variant.id as string) || [];

    const sameColorImage = displayImages.find((image) =>
      sameColorVariantIds.some((sameColorVariantId) =>
        imageMatchesVariant(image, sameColorVariantId)
      )
    );

    if (sameColorImage) {
      return sameColorImage;
    }
  }

  return displayImages[0];
}

/**
 * Finds the image URL for a specific variant.
 * Prioritizes variant-specific images (with variantIds), excluding mockup and detail types.
 * Falls back to first variant image, then product image, then variant fulfillment design file.
 */
export function getVariantImageUrl(
  product: {
    images?: ProductImageWithVariants[];
    variants?: VariantWithOptions[];
  },
  variantId: string
): string | undefined {
  const variantImage = getVariantImage(product, variantId);
  if (variantImage) return variantImage.url;

  const variant = product.variants?.find((v) => v.id === variantId);
  return variant?.fulfillmentConfig?.files?.[0]?.url;
}
