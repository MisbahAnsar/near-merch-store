import type { FulfillmentFile } from "../schema";

export const CENTERED_PLACEMENT_PRIORITY = [
  "front",
  "front_large",
  "front_dtf",
  "front_dtfabric",
  "embroidery_front_large",
  "embroidery_front",
  "embroidery_chest_center",
] as const;

export const SECONDARY_PLACEMENTS = new Set([
  "back",
  "embroidery_chest_left",
  "sleeve_left",
  "sleeve_right",
  "label_inside",
  "label_outside",
  "inside",
  "neck",
]);

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

  const fallback = search.find((placement) => !SECONDARY_PLACEMENTS.has(placement.placement));
  if (!fallback) {
    console.warn(
      `[PrintfulPlacements] No primary placement found — every usable placement (${usable.map((p) => `${p.placement}/${p.technique}`).join(', ')}) is secondary. "default" design files cannot be placed for this catalog product.`,
    );
    return undefined;
  }
  return { name: fallback.placement, technique: fallback.technique };
}

/**
 * Builds a placement -> technique map from the catalog product's placement list.
 * Printful returns placement × technique combos, so one placement name can appear
 * more than once (e.g. front/dtg and front/embroidery). Prefer the entry whose
 * technique matches the catalog's default technique, otherwise the first entry,
 * so the result is deterministic instead of last-wins.
 */
export function buildPlacementTechniques(
  placements: CatalogPlacement[],
  techniques?: CatalogTechnique[],
): Record<string, string> {
  const usable = placements.filter(
    (placement): placement is { placement: string; technique: string } =>
      Boolean(placement.placement && placement.technique),
  );
  const defaultTechnique = techniques?.find((technique) => technique.is_default)?.key;

  const map: Record<string, string> = {};
  for (const placement of usable) {
    const existing = map[placement.placement];
    if (existing === undefined) {
      map[placement.placement] = placement.technique;
    } else if (defaultTechnique && placement.technique === defaultTechnique) {
      map[placement.placement] = placement.technique;
    } else if (defaultTechnique && existing === defaultTechnique) {
      // keep the default-technique entry that is already in the map
    } else {
      // first-wins for non-default duplicates
    }
  }
  return map;
}

export function fulfillmentFileTechnique(file: FulfillmentFile): string | undefined {
  const technique = file.metadata?.technique;
  return typeof technique === "string" ? technique : undefined;
}

export function filesNeedCatalogLookup(files: FulfillmentFile[]): boolean {
  return files.some((file) => {
    const slot = file.slot || "default";
    return slot === "default" || !fulfillmentFileTechnique(file);
  });
}

export type RemapBlockedReason = 'collision' | 'technique-mismatch' | 'no-primary';

export type PlacementRemap = {
  slot: string;
  technique: string | undefined;
  /**
   * Set when a remap to the catalog's primary placement was wanted but did not
   * happen. "collision" and "technique-mismatch" keep a literal slot (e.g.
   * "default") which Printful may resolve to the same area as a sibling file —
   * callers should log this (Printful OR-12 DUPLICATED_FILE_TYPE risk).
   */
  blocked?: RemapBlockedReason;
};

export function remapPrintfulPlacement(
  slot: string,
  technique: string | null | undefined,
  catalog: CatalogPlacementData,
  siblingSlots: string[] = [],
): PlacementRemap {
  const normalizedSlot = slot || "default";
  const primary = catalog?.primaryPlacement;
  const placementTechniques = catalog?.placementTechniques;
  const isKnownSlot = Boolean(placementTechniques?.[normalizedSlot]);
  const needsRemap = normalizedSlot === "default" || (catalog != null && !isKnownSlot);

  if (!needsRemap) {
    return {
      slot: normalizedSlot,
      technique: technique ?? placementTechniques?.[normalizedSlot] ?? primary?.technique,
    };
  }

  const wouldCollide = Boolean(
    primary && primary.name !== normalizedSlot && siblingSlots.includes(primary.name),
  );
  const primaryTechnique = primary
    ? (placementTechniques?.[primary.name] ?? primary.technique)
    : undefined;
  const techniqueCompatible =
    !technique || !primaryTechnique || primaryTechnique === technique;

  if (!primary || wouldCollide || !techniqueCompatible) {
    return {
      slot: normalizedSlot,
      technique: technique ?? placementTechniques?.[normalizedSlot] ?? primary?.technique,
      blocked: !primary ? 'no-primary' : wouldCollide ? 'collision' : 'technique-mismatch',
    };
  }

  return {
    slot: primary.name,
    technique: technique ?? primaryTechnique,
  };
}
