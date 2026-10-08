import { describe, expect, it } from "vitest";
import {
  pickPrimaryPlacement,
  remapPrintfulPlacement,
} from "../../src/services/fulfillment/printful/placements";

const hoodiePlacements = [
  { placement: "embroidery_chest_left", technique: "embroidery" },
  { placement: "front", technique: "dtg" },
  { placement: "back", technique: "dtg" },
  { placement: "mockup", technique: "dtg" },
];

const techniques = [
  { key: "dtg", is_default: true },
  { key: "embroidery", is_default: false },
];

describe("pickPrimaryPlacement", () => {
  it("prefers the default technique's centered front placement over left-chest embroidery", () => {
    expect(pickPrimaryPlacement(hoodiePlacements, techniques)).toEqual({
      name: "front",
      technique: "dtg",
    });
  });

  it("keeps embroidery_front for hats that have no DTG front", () => {
    expect(
      pickPrimaryPlacement(
        [
          { placement: "embroidery_front", technique: "embroidery" },
          { placement: "embroidery_front_large", technique: "embroidery" },
        ],
        [{ key: "embroidery", is_default: true }],
      ),
    ).toEqual({
      name: "embroidery_front_large",
      technique: "embroidery",
    });
  });
});

describe("remapPrintfulPlacement", () => {
  const catalog = {
    primaryPlacement: { name: "front", technique: "dtg" },
    placementTechniques: {
      front: "dtg",
      back: "dtg",
      embroidery_chest_left: "embroidery",
    },
  };

  it("remaps left-chest files to the centered catalog placement", () => {
    expect(
      remapPrintfulPlacement("embroidery_chest_left", "embroidery", catalog),
    ).toEqual({
      slot: "front",
      technique: "dtg",
    });
  });

  it("does not remap back prints", () => {
    expect(remapPrintfulPlacement("back", "dtg", catalog)).toEqual({
      slot: "back",
      technique: "dtg",
    });
  });

  it("does not remap left-chest onto a sibling front file", () => {
    expect(
      remapPrintfulPlacement("embroidery_chest_left", "embroidery", catalog, [
        "embroidery_chest_left",
        "front",
      ]),
    ).toEqual({
      slot: "embroidery_chest_left",
      technique: "embroidery",
    });
  });
});
