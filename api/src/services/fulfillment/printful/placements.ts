export const CENTERED_PLACEMENT_PRIORITY = [
  "front",
  "front_large",
  "front_dtf",
  "front_dtfabric",
  "embroidery_front_large",
  "embroidery_front",
  "embroidery_chest_center",
] as const;

const MISMAPPED_DEFAULT_SLOTS = new Set(["default", "embroidery_chest_left"]);

export type CatalogPlacement = {
  placement?: string;
  technique?: string;
};

export type CatalogTechnique = {
  key?: string;
  is_default?: boolean;
};

export type CatalogPlacementData = {
  primaryPlacement?: { name: string; technique: string };
  placementTechniques?: Record<string, string>;
} | null;

export function pickPrimaryPlacement(
  placements: CatalogPlacement[],
  techniques?: CatalogTechnique[],
): { name: string; technique: string } | undefined {
  const usable = placements.filter(
    (placement): placement is { placement: string; technique: string } =>
      Boolean(placement.placement && placement.placement !== "mockup" && placement.technique),
  );
  if (usable.length === 0) return undefined;

  const defaultTechnique = techniques?.find((technique) => technique.is_default)?.key;
  const defaultPool = defaultTechnique
    ? usable.filter((placement) => placement.technique === defaultTechnique)
    : [];
  const search = defaultPool.length > 0 ? defaultPool : usable;

  for (const name of CENTERED_PLACEMENT_PRIORITY) {
    const match = search.find((placement) => placement.placement === name);
    if (match) {
      return { name: match.placement, technique: match.technique };
    }
  }

  return { name: search[0].placement, technique: search[0].technique };
}

export function remapPrintfulPlacement(
  slot: string,
  technique: string | null | undefined,
  catalog: CatalogPlacementData,
  siblingSlots: string[] = [],
): { slot: string; technique: string | undefined } {
  const normalizedSlot = slot || "default";
  const primary = catalog?.primaryPlacement;

  if (MISMAPPED_DEFAULT_SLOTS.has(normalizedSlot) && primary) {
    const wouldCollide =
      primary.name !== normalizedSlot && siblingSlots.includes(primary.name);
    if (!wouldCollide) {
      return { slot: primary.name, technique: primary.technique };
    }
  }

  if (technique) {
    return { slot: normalizedSlot, technique };
  }

  if (normalizedSlot === "default") {
    return {
      slot: primary?.name ?? "default",
      technique: primary?.technique,
    };
  }

  return {
    slot: normalizedSlot,
    technique:
      catalog?.placementTechniques?.[normalizedSlot] ?? primary?.technique,
  };
}
