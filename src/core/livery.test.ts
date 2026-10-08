import { describe, expect, it } from "vitest";
import { freeLivery, LIVERIES, liveryOf, ORIGINAL_LIVERY } from "./livery";

describe("liveries", () => {
  it("hands out the first colours nobody wears", () => {
    expect(freeLivery([])).toBe(0);
    expect(freeLivery([0, 2, undefined])).toBe(1);
  });

  it("comes round again once every livery is taken", () => {
    const all = LIVERIES.map((_, i) => i);
    expect(freeLivery(all)).toBe(0);
    expect(freeLivery([...all, 0])).toBe(1);
  });

  it("dresses a player without colours as in the original drawing", () => {
    expect(liveryOf({})).toBe(ORIGINAL_LIVERY);
    expect(liveryOf({ livery: 99 })).toBe(ORIGINAL_LIVERY);
    expect(liveryOf({ livery: 1 })).toBe(LIVERIES[1]);
  });
});
